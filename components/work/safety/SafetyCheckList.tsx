import React, { useState, useEffect } from 'react';
import { Shield, AlertCircle, CheckCircle, Camera, X } from 'lucide-react';
import { getSafetyChecks, getSafetyChecklistItems, saveSafetyChecklist, getSafetyCheckResultInfo, SafetyCheck, SafetyChecklistItem } from '../../../services/apiService';

interface SafetyCheckListProps {
  onBack: () => void;
  userInfo?: {
    userId: string;
    userName: string;
    userRole: string;
    soId?: string;
    crrId?: string;
  } | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface ChecklistItemState {
  id: number;
  label: string;
  required: boolean;
  imageRequired: boolean;
  checked: boolean;
  photo?: string;
}

const SafetyCheckList: React.FC<SafetyCheckListProps> = ({ onBack, userInfo, showToast }) => {
  const [lastInspection, setLastInspection] = useState<SafetyCheck | null>(null);
  const [inspectionExpired, setInspectionExpired] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alreadySubmittedToday, setAlreadySubmittedToday] = useState<boolean>(false);

  // Checklist items from DB
  const [checklistItems, setChecklistItems] = useState<ChecklistItemState[]>([]);

  useEffect(() => {
    loadChecklistItems();
    checkLastInspection();
  }, [userInfo]);

  // Load checklist items from API
  const loadChecklistItems = async () => {
    setIsLoading(true);
    try {
      const items = await getSafetyChecklistItems({
        SO_ID: userInfo?.soId,
        CRR_ID: userInfo?.crrId,
        WRKR_ID: userInfo?.userId,
      });

      console.log('[SafetyCheckList] Raw API items:', items);

      if (items && items.length > 0) {
        // Also load today's submitted results to pre-populate
        let todayResults: { ITEM_ID?: string; ANSWER_VALUE?: string }[] = [];
        if (userInfo?.userId) {
          todayResults = await getSafetyCheckResultInfo(userInfo.userId);
          console.log('[SafetyCheckList] Today results:', todayResults);
          if (todayResults.length > 0) {
            setAlreadySubmittedToday(true);
          }
        }

        // Create maps for answers and saved image paths
        const answerMap = new Map<string, string>();
        const imagePathMap = new Map<string, string>();
        todayResults.forEach(r => {
          if (r.ITEM_ID) {
            answerMap.set(String(r.ITEM_ID), r.ANSWER_VALUE || 'N');
            if (r.IMAGE_PATH) {
              imagePathMap.set(String(r.ITEM_ID), r.IMAGE_PATH);
            }
          }
        });

        const mappedItems: ChecklistItemState[] = items
          .sort((a, b) => (a.DISPLAY_ORDER || 0) - (b.DISPLAY_ORDER || 0))
          .map((item) => ({
            id: item.ITEM_ID,
            label: item.QUESTION_TEXT,
            required: item.IS_REQUIRED === 'Y',
            imageRequired: item.IMAGE_REQUIRED_YN === 'Y',
            checked: answerMap.get(String(item.ITEM_ID)) === 'Y',
            photo: imagePathMap.get(String(item.ITEM_ID)) || undefined,
          }));

        console.log('[SafetyCheckList] Mapped items:', mappedItems);
        setChecklistItems(mappedItems);
      } else {
        console.log('[SafetyCheckList] No items from API');
        if (showToast) showToast('안전점검 항목을 불러올 수 없습니다.', 'warning');
      }
    } catch (error) {
      console.error('[SafetyCheckList] Failed to load checklist:', error);
      if (showToast) showToast('안전점검 항목 로딩 실패', 'error', true);
    } finally {
      setIsLoading(false);
    }
  };

  const checkLastInspection = async () => {
    const soId = userInfo?.soId || '';
    const crrId = userInfo?.crrId || '';

    if (!soId || !crrId) {
      return;
    }

    try {
      const checks = await getSafetyChecks({ SO_ID: soId, CRR_ID: crrId });

      if (checks && checks.length > 0) {
        const latest = checks.sort((a, b) =>
          b.INSP_END_DT.localeCompare(a.INSP_END_DT)
        )[0];

        setLastInspection(latest);

        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        if (latest.INSP_END_DT < today) {
          setInspectionExpired(true);
          if (showToast) {
            showToast('안전점검이 만료되었습니다. 새로 점검을 진행해주세요.', 'warning');
          }
        }
      }
    } catch (err) {
      console.error('안전점검 조회 실패:', err);
    }
  };

  const handleCheckboxChange = (itemId: number) => {
    setChecklistItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  // 이미지에 타임스탬프 삽입 후 Base64로 변환
  const processImageWithTimestamp = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');

          // 이미지 리사이즈 (최대 1920px)
          const maxSize = 1920;
          let width = img.width;
          let height = img.height;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // 이미지 그리기
          ctx.drawImage(img, 0, 0, width, height);

          // 타임스탬프 생성
          const now = new Date();
          const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

          // 타임스탬프 스타일 (우측 하단)
          const fontSize = Math.max(16, Math.floor(width / 25));
          ctx.font = `bold ${fontSize}px Arial`;
          const textWidth = ctx.measureText(timestamp).width;
          const padding = 10;
          const boxHeight = fontSize + padding * 2;
          const boxWidth = textWidth + padding * 2;

          // 반투명 배경
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(width - boxWidth - 10, height - boxHeight - 10, boxWidth, boxHeight);

          // 흰색 텍스트
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(timestamp, width - textWidth - padding - 10, height - padding - 15);

          // Base64로 변환 (JPEG, 85% 품질)
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          resolve(base64);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePhotoUpload = async (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        // 타임스탬프 삽입 + Base64 변환
        const base64Image = await processImageWithTimestamp(files[0]);

        setChecklistItems(prev =>
          prev.map(item =>
            item.id === itemId ? { ...item, photo: base64Image, checked: true } : item
          )
        );

        console.log('[SafetyCheckList] 사진 촬영 완료 (타임스탬프 삽입, Base64 변환)');
      } catch (error) {
        console.error('[SafetyCheckList] 사진 처리 실패:', error);
        if (showToast) showToast('사진 처리에 실패했습니다.', 'error');
      }
    }
  };

  const removePhoto = (itemId: number) => {
    setChecklistItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, photo: undefined } : item
      )
    );
  };

  const validateInspection = (): boolean => {
    // Check all required items are checked
    const uncheckedRequired = checklistItems.filter(item => item.required && !item.checked);
    if (uncheckedRequired.length > 0) {
      if (showToast) showToast('필수 안전점검 항목을 모두 체크해주세요.', 'warning');
      return false;
    }

    // Check all image-required items have photos
    const missingPhotos = checklistItems.filter(item => item.imageRequired && !item.photo);
    if (missingPhotos.length > 0) {
      if (showToast) showToast('필수 사진을 모두 업로드해주세요.', 'warning');
      return false;
    }

    return true;
  };

  const uploadSafeImages = async (userId: string): Promise<{ imgPaths: string; perItemPaths: string[] }> => {
    // Per-item 이미지 경로 (ANS_ITEM_IDS 순서와 동일)
    const perItemPaths: string[] = [];
    const newBase64Entries: { itemIndex: number; data: string }[] = [];

    for (let i = 0; i < checklistItems.length; i++) {
      const item = checklistItems[i];
      if (item.photo && item.photo.startsWith('data:image/')) {
        // 새 사진 (Base64) → 업로드 필요
        newBase64Entries.push({ itemIndex: i, data: item.photo });
        perItemPaths.push(''); // placeholder
      } else if (item.photo) {
        // 기존 서버 경로 → 그대로 유지
        perItemPaths.push(item.photo);
      } else {
        perItemPaths.push('');
      }
    }

    // 새 Base64 사진 업로드
    if (newBase64Entries.length > 0) {
      const response = await fetch('/upload/safe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: newBase64Entries.map(e => e.data), userId }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.paths) {
        console.log('[SafetyCheckList] 새 이미지 업로드 완료:', result.paths);
        for (let j = 0; j < newBase64Entries.length; j++) {
          perItemPaths[newBase64Entries[j].itemIndex] = result.paths[j] || '';
        }
      }
    }

    const imgPaths = perItemPaths.filter(p => p).join(',') || 'N';
    return { imgPaths, perItemPaths };
  };

  const handleSubmit = async () => {
    if (!validateInspection()) {
      return;
    }

    const userId = userInfo?.userId || 'mobile_user';

    if (!userId) {
      if (showToast) showToast('사용자 정보가 없습니다.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      // Build comma-separated item IDs and values
      const ansItemIds = checklistItems.map(item => String(item.id)).join(',');
      const ansValues = checklistItems.map(item => item.checked ? 'Y' : 'N').join(',');

      // 이미지 업로드 후 경로 받기
      let imgPaths = 'N';
      let perItemPaths: string[] = [];
      try {
        const uploadResult = await uploadSafeImages(userId);
        imgPaths = uploadResult.imgPaths;
        perItemPaths = uploadResult.perItemPaths;
      } catch (uploadErr) {
        console.error('[SafetyCheckList] 이미지 업로드 실패, N으로 진행:', uploadErr);
        if (showToast) showToast('이미지 업로드 실패. 점검 내용만 저장합니다.', 'warning');
      }

      console.log('[SafetyCheckList] 안전점검 저장 요청:', {
        USR_ID: userId,
        ANS_ITEM_IDS: ansItemIds,
        ANS_VALUES: ansValues,
        IMG_PATHS: imgPaths,
      });

      const result = await saveSafetyChecklist({
        USR_ID: userId,
        IMG_PATHS: imgPaths,
        ANS_ITEM_IDS: ansItemIds,
        ANS_VALUES: ansValues
      });

      console.log('안전점검 등록 성공:', result);

      if (result.code === 'SUCCESS' || result.code === 'OK') {
        if (showToast) showToast('안전점검이 완료되었습니다.', 'success');
        setAlreadySubmittedToday(true);
        // Base64 사진을 서버 경로로 교체 (썸네일 유지)
        if (perItemPaths.length > 0) {
          setChecklistItems(prev => prev.map((item, i) => ({
            ...item,
            photo: perItemPaths[i] || item.photo || undefined,
          })));
        }
        await checkLastInspection();
      } else {
        if (showToast) showToast(`안전점검 등록 실패: ${result.message || '알 수 없는 오류'}`, 'error', true);
      }
    } catch (error: any) {
      console.error('안전점검 등록 오류:', error);
      if (showToast) {
        showToast('안전점검 등록 API가 응답하지 않습니다.', 'warning');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setChecklistItems(prev => prev.map(item => ({ ...item, checked: false, photo: undefined })));
  };

  const getCompletionPercentage = (): number => {
    if (checklistItems.length === 0) return 0;
    const checked = checklistItems.filter(item => item.checked).length;
    return Math.round((checked / checklistItems.length) * 100);
  };

  const getRequiredCompletionPercentage = (): number => {
    const requiredItems = checklistItems.filter(item => item.required);
    if (requiredItems.length === 0) return 100;
    const checked = requiredItems.filter(item => item.checked).length;
    return Math.round((checked / requiredItems.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="text-center p-10">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
        <p className="mt-2 text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (checklistItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto pb-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-yellow-800 font-bold mb-1">안전점검 항목 없음</h4>
              <p className="text-sm text-yellow-700">
                DB에 안전점검 항목이 설정되어 있지 않습니다. 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-6">
      {/* Header with Safety Character */}
      <div className="bg-gradient-to-r from-primary-500 to-cyan-500 text-white p-4 sm:p-5 rounded-xl shadow-lg mb-6 relative">
        <div className="flex items-start gap-2 sm:gap-4">
          <div className="flex-1 z-10 min-w-0 flex flex-col justify-between h-36 sm:h-44">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg flex-shrink-0">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold">안전점검</h2>
            </div>
            <p className="text-xs sm:text-sm text-white/90">필수 점검을 진행해주세요</p>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs">
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/20 rounded-full">안전모</span>
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/20 rounded-full">안전벨트</span>
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/20 rounded-full">장갑</span>
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/20 rounded-full">안전화</span>
            </div>
          </div>
          {/* Safety Character Image */}
          <div className="flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 relative">
            <img
              src="/safeimage1-Photoroom.png"
              alt="안전점검 캐릭터"
              className="absolute -right-4 -bottom-10 drop-shadow-xl !w-[170px] !h-auto !max-w-none"
            />
          </div>
        </div>
      </div>

      {/* Warning if expired */}
      {inspectionExpired && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-800 font-bold mb-1">안전점검 만료</h4>
              <p className="text-sm text-red-700">
                안전점검이 만료되었습니다. 작업 처리를 위해 새로운 안전점검을 완료해주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last Inspection Info */}
      {lastInspection && !inspectionExpired && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-green-800 font-bold mb-1">최근 안전점검 완료</h4>
              <p className="text-sm text-green-700">
                점검일: {lastInspection.INSP_END_DT.slice(0,4)}-{lastInspection.INSP_END_DT.slice(4,6)}-{lastInspection.INSP_END_DT.slice(6,8)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Already submitted today notice */}
      {alreadySubmittedToday && (
        <div className="bg-primary-50 border-l-4 border-primary-500 p-4 mb-6 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-primary-700 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-primary-700 font-bold mb-1">오늘 안전점검 제출 완료</h4>
              <p className="text-sm text-primary-600">
                이미 오늘 안전점검을 제출하셨습니다. 수정이 필요한 경우 다시 제출해주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Items */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-4">
        <div className="bg-gradient-to-r from-primary-500 to-primary-500 p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          <h3 className="text-base sm:text-lg font-bold text-white">안전점검 항목</h3>
          <span className="ml-auto text-white/80 text-sm">{checklistItems.length}개 항목</span>
        </div>
        <div className="p-3 sm:p-4 space-y-3">
          {checklistItems.map((item, index) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border ${item.checked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
            >
              {/* Checkbox row */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleCheckboxChange(item.id)}
                  className="mt-1 w-5 h-5 text-primary-700 border-gray-300 rounded focus:ring-primary-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 whitespace-pre-line">
                    {index + 1}. {item.label?.replace(/\r\n/g, '\n').replace(/  - /g, '\n- ')}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  {item.imageRequired && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs">
                      <Camera className="w-3 h-3" />
                      사진필수
                    </span>
                  )}
                </div>
                {item.checked && (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                )}
              </label>

              {/* Photo upload for image-required items */}
              {item.imageRequired && (
                <div className="mt-3 ml-8">
                  {item.photo ? (
                    <div className="relative inline-block">
                      <img
                        src={item.photo}
                        alt="업로드된 사진"
                        className="w-24 h-24 object-cover rounded-lg border-2 border-green-300"
                      />
                      <button
                        onClick={() => removePhoto(item.id)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <label className="absolute -bottom-2 -right-2 p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 cursor-pointer">
                        <Camera className="w-3 h-3" />
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handlePhotoUpload(item.id, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all">
                      <Camera className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-medium text-orange-600">사진 촬영</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(item.id, e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-4">
        <button
          onClick={handleSubmit}
          disabled={isSaving || getRequiredCompletionPercentage() < 100}
          className="w-full py-3 sm:py-4 bg-gradient-to-r from-primary-500 to-cyan-500 text-white rounded-xl font-bold text-base sm:text-lg shadow-lg hover:from-primary-600 hover:to-cyan-600 active:scale-[0.98] transition-all disabled:bg-gray-400 disabled:from-gray-400 disabled:to-gray-400 disabled:text-white disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              저장 중...
            </span>
          ) : (
            '안전점검 완료'
          )}
        </button>

        {getRequiredCompletionPercentage() < 100 && (
          <p className="text-center text-sm text-red-600 mt-2">
            필수 항목을 모두 체크해주세요
          </p>
        )}
      </div>

      {/* Required Items Legend */}
      <div className="mt-3 p-2.5 bg-primary-50 rounded-lg">
        <p className="text-xs text-primary-700">
          <span className="text-red-500 font-bold">*</span> 표시된 항목은 필수 점검 항목입니다
        </p>
      </div>
    </div>
  );
};

export default SafetyCheckList;
