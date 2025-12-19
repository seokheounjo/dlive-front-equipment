import React, { useEffect, useState } from 'react';
import { WorkItem } from '../../../types';
import { getWorkTypeGuideMessage } from '../../../utils/workValidation';
import { getFullContractInfo } from '../../../services/apiService';
import { formatId } from '../../../utils/dateFormatter';

interface ContractInfoProps {
  workItem: WorkItem;
  onNext: () => void;
  onBack: () => void;
}

// 계약정보 확장 데이터 (API에서 추가로 가져오는 정보)
interface ContractDetailData {
  // 약정정보
  CTRT_APLY_STRT_DT?: string;
  CTRT_APLY_END_DT?: string;
  PROM_CNT?: string | number;
  // 단체정보
  GRP_ID?: string;
  GRP_NM?: string;
  // IP수
  IP_CNT?: string | number;
  // 지사명
  SO_NM?: string;
}

const ContractInfo: React.FC<ContractInfoProps> = ({ workItem, onNext, onBack }) => {
  const [contractDetail, setContractDetail] = useState<ContractDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 컴포넌트 마운트 시 계약 상세 정보 로드
  useEffect(() => {
    const loadContractDetail = async () => {
      // CUST_ID가 없으면 API 호출 스킵
      if (!workItem.CUST_ID) {
        console.log('[ContractInfo] CUST_ID 없음 - API 호출 스킵');
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        console.log('[ContractInfo] 계약 상세 정보 로드 시작:', {
          CUST_ID: workItem.CUST_ID,
          CTRT_ID: workItem.CTRT_ID
        });

        const result = await getFullContractInfo({
          CUST_ID: workItem.CUST_ID,
          CTRT_ID: workItem.CTRT_ID
        });

        console.log('[ContractInfo] API 응답:', result);
        console.log('[ContractInfo] currentContract:', result.currentContract);
        console.log('[ContractInfo] 약정정보 필드:', {
          PROM_CNT: result.currentContract?.PROM_CNT,
          CTRT_APLY_STRT_DT: result.currentContract?.CTRT_APLY_STRT_DT,
          CTRT_APLY_END_DT: result.currentContract?.CTRT_APLY_END_DT,
        });
        console.log('[ContractInfo] 단체정보 필드:', {
          GRP_ID: result.currentContract?.GRP_ID,
          GRP_NM: result.currentContract?.GRP_NM,
        });

        // currentContract 정보 설정
        const mergedData: ContractDetailData = {
          ...(result.currentContract || {})
        };

        setContractDetail(mergedData);
        console.log('[ContractInfo] 계약 상세 정보 로드 완료:', mergedData);

      } catch (error: any) {
        console.error('[ContractInfo] 계약 정보 로드 실패:', error);
        setLoadError(error.message || '계약 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadContractDetail();
  }, [workItem.CUST_ID, workItem.CTRT_ID]);

  // workItem과 contractDetail을 병합하여 표시 데이터 결정
  const displayData = {
    // 약정정보
    PROM_CNT: contractDetail?.PROM_CNT || workItem.PROM_CNT,
    CTRT_APLY_STRT_DT: contractDetail?.CTRT_APLY_STRT_DT || workItem.CTRT_APLY_STRT_DT,
    CTRT_APLY_END_DT: contractDetail?.CTRT_APLY_END_DT || workItem.CTRT_APLY_END_DT,
    // 단체정보
    GRP_ID: contractDetail?.GRP_ID || workItem.GRP_ID,
    GRP_NM: contractDetail?.GRP_NM || workItem.GRP_NM,
    // IP수
    IP_CNT: contractDetail?.IP_CNT || workItem.IP_CNT,
    // 지사명 (API 우선)
    SO_NM: contractDetail?.SO_NM || workItem.SO_NM,
  };

  return (
    <div className="px-3 sm:px-4 py-4 sm:py-6 pb-4 space-y-3 sm:space-y-4 overflow-x-hidden">
      {/* 로딩 상태 표시 */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="animate-spin w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0"></div>
            <span className="text-xs sm:text-sm text-blue-700">계약 상세 정보 로딩 중...</span>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {loadError && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs sm:text-sm text-yellow-700">{loadError}</span>
          </div>
        </div>
      )}

      {/* 작업 유형별 안내 메시지 - 완료된 작업에서는 숨김 */}
      {workItem.WRK_CD && workItem.WRK_STAT_CD !== '4' && workItem.status !== '완료' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-blue-900 leading-relaxed">
                {getWorkTypeGuideMessage(workItem.WRK_CD)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 고객 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">고객 정보</h4>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-16 sm:w-20 flex-shrink-0">고객명</span>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">{workItem.customer.name}</span>
              {workItem.customer.isVip && (
                <span className={`
                  px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold flex-shrink-0
                  ${workItem.customer.vipLevel === 'VVIP'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-yellow-100 text-yellow-700'}
                `}>
                  {workItem.customer.vipLevel}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-16 sm:w-20 flex-shrink-0">연락처</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{workItem.customer.phone || '-'}</span>
          </div>
          <div className="flex items-start pt-1 border-t border-gray-100">
            <span className="text-xs sm:text-sm text-gray-500 w-16 sm:w-20 flex-shrink-0">주소</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900 leading-relaxed flex-1 break-words">{workItem.customer.address}</span>
          </div>
        </div>
      </div>

      {/* 납부방법 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">납부방법</h4>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">납부계정</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900 break-all">{workItem.PYM_ACNT_ID || '-'}</span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">납부방법</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{workItem.PYM_MTHD || '-'}</span>
          </div>
        </div>
      </div>

      {/* 약정정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">약정정보</h4>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">약정개월</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">
              {displayData.PROM_CNT ? `${displayData.PROM_CNT}개월` : '-'}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">시작</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">
              {displayData.CTRT_APLY_STRT_DT ? formatDate(displayData.CTRT_APLY_STRT_DT) : '-'}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">종료</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">
              {displayData.CTRT_APLY_END_DT ? formatDate(displayData.CTRT_APLY_END_DT) : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 단체정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">단체정보</h4>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">단체번호</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{displayData.GRP_ID || '-'}</span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">단체명</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900 break-words">{displayData.GRP_NM || '-'}</span>
          </div>
        </div>
      </div>

      {/* 상품 및 프로모션 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">상품 및 프로모션 정보</h4>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">계약ID</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">{formatId(workItem.CTRT_ID)}</span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">계약상태</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{workItem.CTRT_STAT_NM || getContractStatusText(workItem.CTRT_STAT)}</span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">지사명</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{displayData.SO_NM || '-'}</span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">상품명</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900 break-words flex-1">{workItem.productName || '-'}</span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">작업유형</span>
            <span className="text-xs sm:text-sm font-medium text-blue-600">{workItem.typeDisplay}</span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">IP수</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{displayData.IP_CNT || '-'}</span>
          </div>
        </div>
      </div>

    </div>
  );
};

// Helper functions
const getContractStatusText = (status?: string): string => {
  const statusMap: { [key: string]: string } = {
    '10': '설치예정',
    '20': '정상',
    '30': '일시정지',
    '37': '일시정지(특정)',
    '90': '해지완료',
  };
  return statusMap[status || ''] || '알 수 없음';
};

// 날짜 포맷 (다양한 형식 지원 -> YYYY.MM.DD)
const formatDate = (dateStr?: string | number): string => {
  if (!dateStr) return '-';

  // 숫자인 경우 문자열로 변환
  const str = String(dateStr);

  // 숫자만 추출 (YYYYMMDD 형식으로 변환)
  const digitsOnly = str.replace(/\D/g, '');

  // 8자리 이상이면 앞 8자리만 사용
  if (digitsOnly.length >= 8) {
    return `${digitsOnly.slice(0, 4)}.${digitsOnly.slice(4, 6)}.${digitsOnly.slice(6, 8)}`;
  }

  // 원본 반환 (파싱 불가)
  return str || '-';
};

export default ContractInfo;
