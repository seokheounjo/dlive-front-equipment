import React, { useState, useEffect } from 'react';
import { Shield, AlertCircle, CheckCircle, Camera, Check, X } from 'lucide-react';
import { saveSafetyCheck, getSafetyChecks, SafetyCheck } from '../../services/apiService';

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

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  required: boolean;
  checked: boolean;
}

interface SafetyInspection {
  personalSafety: ChecklistItem[];
  vehicleSafety: ChecklistItem[];
  equipmentSafety: ChecklistItem[];
  workSiteSafety: ChecklistItem[];
}

const SafetyCheckList: React.FC<SafetyCheckListProps> = ({ onBack, userInfo, showToast }) => {
  const [lastInspection, setLastInspection] = useState<SafetyCheck | null>(null);
  const [inspectionExpired, setInspectionExpired] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Safety inspection checklist state
  const [inspection, setInspection] = useState<SafetyInspection>({
    personalSafety: [
      { id: 'ps1', category: 'personal', label: '안전모 착용', required: true, checked: false },
      { id: 'ps2', category: 'personal', label: '안전화 착용', required: true, checked: false },
      { id: 'ps3', category: 'personal', label: '안전조끼 착용', required: true, checked: false },
      { id: 'ps4', category: 'personal', label: '안전장갑 착용', required: false, checked: false },
      { id: 'ps5', category: 'personal', label: '보호안경 착용', required: false, checked: false },
    ],
    vehicleSafety: [
      { id: 'vs1', category: 'vehicle', label: '차량 외관 상태 확인', required: true, checked: false },
      { id: 'vs2', category: 'vehicle', label: '타이어 공기압 확인', required: true, checked: false },
      { id: 'vs3', category: 'vehicle', label: '엔진오일 점검', required: false, checked: false },
      { id: 'vs4', category: 'vehicle', label: '브레이크 작동 확인', required: true, checked: false },
      { id: 'vs5', category: 'vehicle', label: '라이트 및 방향지시등 점검', required: true, checked: false },
    ],
    equipmentSafety: [
      { id: 'es1', category: 'equipment', label: '공구함 점검 완료', required: true, checked: false },
      { id: 'es2', category: 'equipment', label: '측정장비 정상 작동 확인', required: true, checked: false },
      { id: 'es3', category: 'equipment', label: '사다리/발판 안전 확인', required: true, checked: false },
      { id: 'es4', category: 'equipment', label: '전기 작업 도구 절연 상태', required: true, checked: false },
      { id: 'es5', category: 'equipment', label: '응급처치 키트 구비', required: false, checked: false },
    ],
    workSiteSafety: [
      { id: 'ws1', category: 'worksite', label: '작업 현장 위험요소 파악', required: true, checked: false },
      { id: 'ws2', category: 'worksite', label: '날씨 및 환경 조건 확인', required: true, checked: false },
      { id: 'ws3', category: 'worksite', label: '고객 안전 주의사항 숙지', required: true, checked: false },
      { id: 'ws4', category: 'worksite', label: '비상연락망 확인', required: true, checked: false },
      { id: 'ws5', category: 'worksite', label: '작업 동선 계획 수립', required: false, checked: false },
    ],
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<boolean>(false);

  useEffect(() => {
    checkLastInspection();
  }, [userInfo]);

  const checkLastInspection = async () => {
    const soId = userInfo?.soId || '';
    const crrId = userInfo?.crrId || '';

    if (!soId || !crrId) {
      console.log('⚠️ SO_ID 또는 CRR_ID가 없어 조회를 건너뜁니다');
      return;
    }

    try {
      setIsLoading(true);
      const checks = await getSafetyChecks({ SO_ID: soId, CRR_ID: crrId });

      if (checks && checks.length > 0) {
        // Get the most recent inspection
        const latest = checks.sort((a, b) =>
          b.INSP_END_DT.localeCompare(a.INSP_END_DT)
        )[0];

        setLastInspection(latest);

        // Check if inspection is expired (older than today)
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        if (latest.INSP_END_DT < today) {
          setInspectionExpired(true);
          if (showToast) {
            showToast('안전점검이 만료되었습니다. 새로 점검을 진행해주세요.', 'warning');
          }
        }
      }
    } catch (err) {
      console.error('❌ 안전점검 조회 실패:', err);
      // Silently fail - allow user to continue work even if API fails
      // Set inspection as not expired to allow work to proceed
      setInspectionExpired(false);
      setLastInspection(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (category: keyof SafetyInspection, itemId: string) => {
    setInspection(prev => ({
      ...prev,
      [category]: prev[category].map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPhotos = Array.from(files).map(file => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 3)); // Max 3 photos
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const validateInspection = (): boolean => {
    // Check all required items
    const allCategories = [
      ...inspection.personalSafety,
      ...inspection.vehicleSafety,
      ...inspection.equipmentSafety,
      ...inspection.workSiteSafety
    ];

    const allRequiredChecked = allCategories
      .filter(item => item.required)
      .every(item => item.checked);

    if (!allRequiredChecked) {
      if (showToast) showToast('필수 안전점검 항목을 모두 체크해주세요.', 'warning');
      return false;
    }

    if (!signature) {
      if (showToast) showToast('안전점검 확인 서명을 완료해주세요.', 'warning');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateInspection()) {
      return;
    }

    const soId = userInfo?.soId || '';
    const crrId = userInfo?.crrId || '';
    const userId = userInfo?.userId || 'mobile_user';

    if (!soId || !crrId) {
      if (showToast) showToast('사용자 정보가 없습니다.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      const result = await saveSafetyCheck({
        SO_ID: soId,
        CRR_ID: crrId,
        INSP_END_DT: today,
        REG_UID: userId
      });

      console.log('✅ 안전점검 등록 성공:', result);

      if (result.code === 'SUCCESS' || result.code === 'OK') {
        if (showToast) showToast('안전점검이 완료되었습니다.', 'success');

        // Reset form
        resetForm();

        // Refresh inspection data
        checkLastInspection();
      } else {
        if (showToast) showToast(`안전점검 등록 실패: ${result.message || '알 수 없는 오류'}`, 'error');
      }
    } catch (error: any) {
      console.error('❌ 안전점검 등록 오류:', error);
      // Gracefully handle API error - show optional warning but allow user to proceed
      if (showToast) {
        showToast('안전점검 등록 API가 응답하지 않습니다. 작업을 계속 진행할 수 있습니다.', 'warning');
      }
      // Reset form and allow user to continue
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setInspection({
      personalSafety: inspection.personalSafety.map(item => ({ ...item, checked: false })),
      vehicleSafety: inspection.vehicleSafety.map(item => ({ ...item, checked: false })),
      equipmentSafety: inspection.equipmentSafety.map(item => ({ ...item, checked: false })),
      workSiteSafety: inspection.workSiteSafety.map(item => ({ ...item, checked: false })),
    });
    setPhotos([]);
    setSignature(false);
  };

  const getCompletionPercentage = (): number => {
    const allItems = [
      ...inspection.personalSafety,
      ...inspection.vehicleSafety,
      ...inspection.equipmentSafety,
      ...inspection.workSiteSafety
    ];
    const checked = allItems.filter(item => item.checked).length;
    return Math.round((checked / allItems.length) * 100);
  };

  const renderChecklistSection = (
    title: string,
    icon: React.ReactNode,
    items: ChecklistItem[],
    category: keyof SafetyInspection,
    color: string
  ) => {
    return (
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mb-4">
        <div className={`${color} p-4 flex items-center gap-3`}>
          {icon}
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <div className="p-4 space-y-3">
          {items.map(item => (
            <label
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleCheckboxChange(category, item.id)}
                className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">
                  {item.label}
                  {item.required && <span className="text-red-500 ml-1">*</span>}
                </span>
              </div>
              {item.checked && (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              )}
            </label>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center p-10">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
        <p className="mt-2 text-gray-600">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white p-5 rounded-xl shadow-lg mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Shield className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">작업 전 안전점검</h2>
            <p className="text-sm text-white/90">작업 처리 전 필수 안전점검을 진행해주세요</p>
          </div>
        </div>

        {/* Completion Progress */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">점검 진행률</span>
            <span className="text-sm font-bold">{getCompletionPercentage()}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <div
              className="bg-white h-full transition-all duration-300 rounded-full"
              style={{ width: `${getCompletionPercentage()}%` }}
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
                {lastInspection.PASS_YN === 'Y' && ' | 결과: 적합'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Sections */}
      <div className="space-y-4">
        {renderChecklistSection(
          '개인 안전장구',
          <Shield className="w-6 h-6" />,
          inspection.personalSafety,
          'personalSafety',
          'bg-gradient-to-r from-blue-600 to-blue-500'
        )}

        {renderChecklistSection(
          '차량 안전점검',
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>,
          inspection.vehicleSafety,
          'vehicleSafety',
          'bg-gradient-to-r from-cyan-600 to-cyan-500'
        )}

        {renderChecklistSection(
          '장비 안전점검',
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>,
          inspection.equipmentSafety,
          'equipmentSafety',
          'bg-gradient-to-r from-indigo-600 to-indigo-500'
        )}

        {renderChecklistSection(
          '작업 현장 안전',
          <AlertCircle className="w-6 h-6" />,
          inspection.workSiteSafety,
          'workSiteSafety',
          'bg-gradient-to-r from-purple-600 to-purple-500'
        )}
      </div>

      {/* Photo Upload Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mt-4">
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-4 flex items-center gap-3">
          <Camera className="w-6 h-6 text-white" />
          <h3 className="text-lg font-bold text-white">안전장구 착용 사진</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">안전장구 착용 상태를 사진으로 등록해주세요 (최대 3장)</p>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {photos.map((photo, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                <img src={photo} alt={`안전장구 ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {photos.length < 3 && (
            <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all">
              <Camera className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">사진 추가</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Signature Section */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden mt-4">
        <div className="bg-gradient-to-r from-green-600 to-green-500 p-4 flex items-center gap-3">
          <Check className="w-6 h-6 text-white" />
          <h3 className="text-lg font-bold text-white">안전점검 확인 서명</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            상기 안전점검을 완료하였으며, 안전수칙을 준수하여 작업을 진행하겠습니다.
          </p>

          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={signature}
              onChange={(e) => setSignature(e.target.checked)}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <div className="flex-1">
              <span className="text-sm font-bold text-gray-900">안전점검 확인</span>
              <p className="text-xs text-gray-600 mt-1">
                작업자: {userInfo?.userName || '미확인'}
              </p>
            </div>
            {signature && (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <div className="mt-6 sticky bottom-4 z-10">
        <button
          onClick={handleSubmit}
          disabled={isSaving || getCompletionPercentage() < 100 || !signature}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl font-bold text-lg shadow-lg hover:from-blue-700 hover:to-cyan-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              저장 중...
            </span>
          ) : (
            '안전점검 완료 및 저장'
          )}
        </button>

        {(!signature || getCompletionPercentage() < 100) && (
          <p className="text-center text-sm text-red-600 mt-2">
            {!signature ? '서명 확인을 완료해주세요' : '모든 필수 항목을 체크해주세요'}
          </p>
        )}
      </div>

      {/* Required Items Legend */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-800">
          <span className="text-red-500 font-bold">*</span> 표시된 항목은 필수 점검 항목입니다
        </p>
      </div>
    </div>
  );
};

export default SafetyCheckList;
