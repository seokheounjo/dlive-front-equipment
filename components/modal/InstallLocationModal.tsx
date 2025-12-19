import React, { useState, useEffect } from 'react';
import Select from '../ui/Select';
import BaseModal from '../common/BaseModal';
import { getCommonCodes } from '../../services/apiService';
import '../../styles/buttons.css';

interface InstallLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InstallLocationData) => void;
  workId: string;
  ctrtId: string;
  prodGrp?: string; // D=DTV, V=VoIP, I=Internet, C=Cable
  initialInstlLoc?: string; // 기존 설치위치 (거실, 안방 등)
  initialViewModCd?: string; // 기존 시청모드 코드
  initialViewModNm?: string; // 기존 시청모드 이름
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  readOnly?: boolean; // 읽기 전용 모드 (완료된 작업)
}

export interface InstallLocationData {
  INSTL_LOC: string; // 설치위치 텍스트 (거실, 1층 등)
  VIEW_MOD_CD: string; // 시청모드 코드 (01, 02, 03)
  VIEW_MOD_NM: string; // 시청모드 이름 (HDMI1, HDMI2 등)
  INSTL_LOC_FULL: string; // DB 저장용 전체값 (설치위치¶시청모드코드)
}

// 설치위치 옵션 (레거시 마이플랫폼 참고)
const instlLocOptions = [
  { value: '거실', label: '거실' },
  { value: '안방', label: '안방' },
  { value: '작은방', label: '작은방' },
  { value: '원룸', label: '원룸' },
  { value: '세대단자함(현관입구)', label: '세대단자함(현관입구)' },
  { value: '세대단자함(신발장)', label: '세대단자함(신발장)' },
  { value: '세대단자함(주방)', label: '세대단자함(주방)' },
  { value: '99', label: '기타(직접입력)' },
];

// 시청모드 기본 옵션 (API에서 CMWO048 조회 실패 시 사용) - 레거시 DB 동일
const defaultViewModOptions = [
  { value: '01', label: 'HDMI1' },
  { value: '02', label: 'HDMI2' },
  { value: '03', label: 'HDMI3' },
  { value: '04', label: 'HDMI4' },
  { value: '05', label: '콤포넌트' },
  { value: '06', label: '외부입력1' },
  { value: '07', label: '외부입력2' },
  { value: '08', label: '외부입력3' },
  { value: '09', label: '외부입력4' },
  { value: '11', label: 'RF 입력' },
];

const InstallLocationModal: React.FC<InstallLocationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  workId,
  ctrtId,
  prodGrp,
  initialInstlLoc,
  initialViewModCd,
  initialViewModNm,
  showToast,
  readOnly = false
}) => {
  // 설치위치 관련 state
  const [instlLocCode, setInstlLocCode] = useState(''); // 콤보박스 선택값
  const [instlLocText, setInstlLocText] = useState(''); // 직접입력 텍스트 (기타 선택 시)
  const [viewModCd, setViewModCd] = useState(''); // 시청모드 코드
  const [viewModOptions, setViewModOptions] = useState(defaultViewModOptions); // 시청모드 옵션 (API에서 로드)

  // DTV 상품 여부
  const isDtvProduct = prodGrp === 'D';

  // 시청모드 공통코드 로드 (CMWO048)
  useEffect(() => {
    const loadViewModOptions = async () => {
      try {
        const codes = await getCommonCodes('CMWO048');
        console.log('[InstallLocationModal] API 응답 원본:', codes);
        if (codes && codes.length > 0) {
          // API 응답 필드: code, name (또는 COMMON_CD, COMMON_CD_NM)
          const options = codes.map((item: any) => ({
            value: item.code || item.COMMON_CD || '',
            label: item.name || item.COMMON_CD_NM || ''
          })).filter((opt: any) => opt.value && opt.label);

          if (options.length > 0) {
            setViewModOptions(options);
            console.log('[InstallLocationModal] 시청모드 옵션 로드 완료:', options);
          } else {
            console.log('[InstallLocationModal] 유효한 옵션 없음, 기본값 사용');
          }
        }
      } catch (error) {
        console.error('[InstallLocationModal] 시청모드 공통코드 로드 실패, 기본값 사용:', error);
        // 기본 옵션 유지
      }
    };

    if (isOpen && isDtvProduct) {
      loadViewModOptions();
    }
  }, [isOpen, isDtvProduct]);

  // 초기값 설정
  useEffect(() => {
    if (isOpen) {
      // 기존 설치위치가 있으면 매핑
      if (initialInstlLoc) {
        // 거실, 안방 등 목록에 있는지 확인
        const matchedOption = instlLocOptions.find(opt => opt.value === initialInstlLoc || opt.label === initialInstlLoc);
        if (matchedOption && matchedOption.value !== '99') {
          setInstlLocCode(matchedOption.value);
          setInstlLocText('');
        } else {
          // 기타(직접입력)
          setInstlLocCode('99');
          setInstlLocText(initialInstlLoc);
        }
      } else {
        setInstlLocCode('');
        setInstlLocText('');
      }

      // 기존 시청모드 설정
      if (initialViewModCd) {
        setViewModCd(initialViewModCd);
      } else {
        setViewModCd('');
      }
    }
  }, [isOpen, initialInstlLoc, initialViewModCd]);

  // 검증
  const validate = (): string | null => {
    if (!instlLocCode || instlLocCode === '[]') {
      return '설치위치를 선택해주세요.';
    }
    if (instlLocCode === '99' && !instlLocText.trim()) {
      return '작업주소에 대한 설치위치를 입력하십시오. (건물상세위치)';
    }
    if (isDtvProduct && (!viewModCd || viewModCd === '[]')) {
      return '시청모드를 선택해주세요.';
    }
    return null;
  };

  // 저장
  const handleSave = async () => {
    const error = validate();
    if (error) {
      if (showToast) {
        showToast(error, 'warning');
      } else {
        alert(error);
      }
      return;
    }

    // 설치위치 텍스트 결정 (value가 label과 동일, 기타만 별도 처리)
    const instlLocLabel = instlLocCode === '99'
      ? instlLocText
      : instlLocCode; // 거실, 안방 등 value 자체가 텍스트

    // 시청모드 이름
    const viewModNm = viewModOptions.find(opt => opt.value === viewModCd)?.label || '';

    // DB 저장용 전체값: "설치위치¶시청모드코드"
    const instlLocFull = isDtvProduct && viewModCd
      ? `${instlLocLabel}¶${viewModCd}`
      : instlLocLabel;

    // 레거시 방식: 별도 API 호출 없이 로컬에만 저장
    // 작업완료(modWorkComplete) 시 INSTL_LOC 파라미터로 함께 전송됨
    if (showToast) {
      showToast('설정되었습니다.', 'success');
    }

    // 부모 컴포넌트에 데이터 전달 (로컬 저장용)
    onSave({
      INSTL_LOC: instlLocLabel,
      VIEW_MOD_CD: viewModCd,
      VIEW_MOD_NM: viewModNm,
      INSTL_LOC_FULL: instlLocFull,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="작업완료(설치위치, 시청모드)"
      size="md"
    >
      <div className="space-y-5 p-4">
        {/* 설치위치 */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
            설치위치 {!readOnly && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={instlLocCode}
            onValueChange={(value) => {
              if (readOnly) return;
              setInstlLocCode(value);
              if (value !== '99') {
                setInstlLocText('');
              }
            }}
            options={instlLocOptions}
            placeholder="설치위치 선택"
            required={!readOnly}
            disabled={readOnly}
          />
        </div>

        {/* 작업주소 상세위치 (기타 선택 시) */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
            작업주소 상세위치 {!readOnly && instlLocCode === '99' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={instlLocText}
            onChange={(e) => !readOnly && setInstlLocText(e.target.value)}
            placeholder={instlLocCode === '99' ? '거실, 안방, 작은방 등 상세 위치 입력' : '기타 선택 시 입력 가능'}
            disabled={readOnly || instlLocCode !== '99'}
            maxLength={512}
            rows={3}
            className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg text-sm sm:text-base resize-none
              ${readOnly
                ? 'border-gray-200 bg-gray-100 text-gray-700 cursor-not-allowed'
                : instlLocCode === '99'
                  ? 'border-gray-300 bg-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
                  : 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
              }`}
          />
          {!readOnly && (
            <p className="mt-1 text-xs text-red-500 font-medium">
              * 건물상세위치
            </p>
          )}
        </div>

        {/* 시청모드 (DTV 상품일 때만) */}
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
            시청모드 {!readOnly && isDtvProduct && <span className="text-red-500">*</span>}
          </label>
          <Select
            value={viewModCd}
            onValueChange={(value) => !readOnly && setViewModCd(value)}
            options={viewModOptions}
            placeholder="시청모드 선택"
            disabled={readOnly || !isDtvProduct}
            required={!readOnly && isDtvProduct}
          />
          {!readOnly && !isDtvProduct && (
            <p className="mt-1 text-xs text-gray-500">
              DTV 상품일 경우에만 선택 가능합니다.
            </p>
          )}
        </div>
      </div>

      {/* 버튼 영역 */}
      <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 border-t border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={onClose}
          className={`py-2 sm:py-3 px-3 sm:px-4 font-semibold rounded-lg transition-colors text-sm sm:text-base ${
            readOnly
              ? 'flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          닫기
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2 sm:py-3 px-3 sm:px-4 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition-colors text-sm sm:text-base"
          >
            저장
          </button>
        )}
      </div>
    </BaseModal>
  );
};

export default InstallLocationModal;
