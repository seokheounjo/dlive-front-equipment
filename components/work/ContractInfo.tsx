import React, { useEffect, useState } from 'react';
import { WorkItem } from '../../types';
import { getWorkTypeGuideMessage } from '../../utils/workValidation';
import { getFullContractInfo } from '../../services/apiService';

interface ContractInfoProps {
  workItem: WorkItem;
  onNext: () => void;
  onBack: () => void;
}

// 계약정보 확장 데이터 (API에서 추가로 가져오는 정보)
interface ContractDetailData {
  // 약정정보
  RATE_STRT_DT?: string;
  RATE_END_DT?: string;
  PROM_CNT?: string | number;
  CTRT_APLY_STRT_DT?: string;
  CTRT_APLY_END_DT?: string;
  // 단체정보
  GRP_ID?: string;
  GRP_NM?: string;
  SUBS_MOT?: string;
  SUBS_MOT_NM?: string;
  // 신분할인/위약금
  CUST_CL_DC_APLY_YN?: string;
  PNTY_EXMP_YN?: string;
  TERM_CALC_YN?: string;
  IP_CNT?: string | number;
  // 청구/미납
  BILL_AMT_NOW?: string | number;
  BILL_AMT_BEFORE?: string | number;
  UPYM_AMT?: string | number;
  // 청구 집계 (billing API)
  ACC_1?: string | number;  // 선불금 잔액
  ACC_2?: string | number;  // 선결제 잔액
  ACC_3?: string | number;  // 선불료 잔액
  ACC_4?: string | number;  // 미납 청구액 (총 미납금)
  DTV_CNT?: string | number;
  ISP_CNT?: string | number;
  VOIP_CNT?: string | number;
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

        // currentContract와 billing 정보 병합
        const mergedData: ContractDetailData = {
          ...(result.currentContract || {}),
          ...(result.billing || {})
        };

        // 미납금 정보: ACC_4가 총 미납금
        if (result.billing?.ACC_4 && !mergedData.UPYM_AMT) {
          mergedData.UPYM_AMT = result.billing.ACC_4;
        }

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
  // API에서 가져온 값이 있으면 우선 사용, 없으면 workItem 값 사용
  const displayData = {
    // 약정정보
    RATE_STRT_DT: contractDetail?.RATE_STRT_DT || workItem.RATE_STRT_DT,
    RATE_END_DT: contractDetail?.RATE_END_DT || workItem.RATE_END_DT,
    PROM_CNT: contractDetail?.PROM_CNT || workItem.PROM_CNT,
    CTRT_APLY_STRT_DT: contractDetail?.CTRT_APLY_STRT_DT || workItem.CTRT_APLY_STRT_DT,
    CTRT_APLY_END_DT: contractDetail?.CTRT_APLY_END_DT || workItem.CTRT_APLY_END_DT,
    // 단체정보
    GRP_ID: contractDetail?.GRP_ID || workItem.GRP_ID,
    GRP_NM: contractDetail?.GRP_NM || workItem.GRP_NM,
    SUBS_MOT_NM: contractDetail?.SUBS_MOT_NM || workItem.SUBS_MOT_NM,
    // 신분할인/위약금
    CUST_CL_DC_APLY_YN: contractDetail?.CUST_CL_DC_APLY_YN || workItem.CUST_CL_DC_APLY_YN,
    PNTY_EXMP_YN: contractDetail?.PNTY_EXMP_YN || workItem.PNTY_EXMP_YN,
    TERM_CALC_YN: contractDetail?.TERM_CALC_YN || workItem.TERM_CALC_YN,
    IP_CNT: contractDetail?.IP_CNT || workItem.IP_CNT,
    // 청구/미납 (API 우선)
    BILL_AMT_BEFORE: contractDetail?.BILL_AMT_BEFORE || workItem.BILL_AMT_BEFORE,
    BILL_AMT: contractDetail?.BILL_AMT_NOW || workItem.BILL_AMT,
    UPYM_AMT: contractDetail?.UPYM_AMT || contractDetail?.ACC_4 || workItem.UPYM_AMT,
    // 계약수 (billing API)
    DTV_CNT: contractDetail?.DTV_CNT,
    ISP_CNT: contractDetail?.ISP_CNT,
    VOIP_CNT: contractDetail?.VOIP_CNT,
  };

  return (
    <div className="px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
      {/* 로딩 상태 표시 */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-sm text-blue-700">계약 상세 정보 로딩 중...</span>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {loadError && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-yellow-700">{loadError}</span>
          </div>
        </div>
      )}

      {/* 작업 유형별 안내 메시지 - 완료된 작업에서는 숨김 */}
      {workItem.WRK_CD && workItem.WRK_STAT_CD !== '4' && workItem.status !== '완료' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 leading-relaxed">
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

      {/* 계약 상세 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">계약 상세</h4>
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-xs text-gray-500">계약 ID</span>
            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{workItem.CTRT_ID || '-'}</p>
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <span className="text-[10px] sm:text-xs text-gray-500">계약 상태</span>
            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{workItem.CTRT_STAT_NM || getContractStatusText(workItem.CTRT_STAT)}</p>
          </div>
          <div className="space-y-0.5 sm:space-y-1 col-span-2">
            <span className="text-[10px] sm:text-xs text-gray-500">지사명</span>
            <p className="text-xs sm:text-sm font-medium text-gray-900">{workItem.SO_NM || '-'}</p>
          </div>
          <div className="space-y-0.5 sm:space-y-1 col-span-2">
            <span className="text-[10px] sm:text-xs text-gray-500">상품명</span>
            <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">{workItem.productName || '-'}</p>
          </div>
          <div className="space-y-0.5 sm:space-y-1 col-span-2">
            <span className="text-[10px] sm:text-xs text-gray-500">작업 유형</span>
            <p className="text-xs sm:text-sm font-medium text-blue-600">{workItem.typeDisplay}</p>
          </div>
        </div>
      </div>

      {/* 납부방법 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">납부방법</h4>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">납부계정ID</span>
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
          <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-500 sm:w-24 flex-shrink-0">요금기간</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">
              {displayData.RATE_STRT_DT ? formatDate(displayData.RATE_STRT_DT) : '-'} ~ {displayData.RATE_END_DT ? formatDate(displayData.RATE_END_DT) : '-'}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-0">
            <span className="text-xs sm:text-sm text-gray-500 sm:w-24 flex-shrink-0">프로모션</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">
              {displayData.PROM_CNT ? `${displayData.PROM_CNT}개월` : '-'}
              {displayData.CTRT_APLY_STRT_DT && (
                <span className="text-gray-500 block sm:inline sm:ml-2 text-[10px] sm:text-sm">
                  ({formatDate(displayData.CTRT_APLY_STRT_DT)} ~ {formatDate(displayData.CTRT_APLY_END_DT)})
                </span>
              )}
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">VoIP번호</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{workItem.VOIP_TEL_NO || '-'}</span>
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
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">가입동기</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{displayData.SUBS_MOT_NM || '-'}</span>
          </div>
        </div>
      </div>

      {/* 청구/미납 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">청구/미납 정보</h4>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between py-1.5 sm:py-2 px-2 sm:px-3 bg-gray-50 rounded-lg">
            <span className="text-xs sm:text-sm text-gray-600">전월요금</span>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">{formatCurrency(displayData.BILL_AMT_BEFORE)}원</span>
          </div>
          <div className="flex items-center justify-between py-1.5 sm:py-2 px-2 sm:px-3 bg-gray-50 rounded-lg">
            <span className="text-xs sm:text-sm text-gray-600">당월요금</span>
            <span className="text-xs sm:text-sm font-semibold text-gray-900">{formatCurrency(displayData.BILL_AMT)}원</span>
          </div>
          <div className="flex items-center justify-between py-1.5 sm:py-2 px-2 sm:px-3 bg-red-50 rounded-lg">
            <span className="text-xs sm:text-sm font-medium text-red-700">총미납금</span>
            <span className="text-sm sm:text-base font-bold text-red-600">{formatCurrency(displayData.UPYM_AMT)}원</span>
          </div>
          {/* 계약수 정보 (API에서 가져온 경우만 표시) */}
          {(displayData.DTV_CNT || displayData.ISP_CNT || displayData.VOIP_CNT) && (
            <div className="pt-3 mt-3 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-2 text-center">
                {displayData.DTV_CNT !== undefined && (
                  <div className="py-2 px-2 bg-blue-50 rounded-lg">
                    <span className="text-xs text-blue-600 block">DTV</span>
                    <span className="text-sm font-semibold text-blue-900">{displayData.DTV_CNT}건</span>
                  </div>
                )}
                {displayData.ISP_CNT !== undefined && (
                  <div className="py-2 px-2 bg-green-50 rounded-lg">
                    <span className="text-xs text-green-600 block">ISP</span>
                    <span className="text-sm font-semibold text-green-900">{displayData.ISP_CNT}건</span>
                  </div>
                )}
                {displayData.VOIP_CNT !== undefined && (
                  <div className="py-2 px-2 bg-purple-50 rounded-lg">
                    <span className="text-xs text-purple-600 block">VoIP</span>
                    <span className="text-sm font-semibold text-purple-900">{displayData.VOIP_CNT}건</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상품 구성 */}
      {workItem.assignedEquipment && workItem.assignedEquipment.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-base font-bold text-gray-900 mb-4">상품 구성</h4>
          <div className="space-y-2">
            {Object.entries(
              workItem.assignedEquipment.reduce((acc: {[key: string]: number}, eq) => {
                acc[eq.type] = (acc[eq.type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count], index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{type}</span>
                <span className="text-sm font-semibold text-blue-600">× {count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 현재 할당된 장비 */}
      {workItem.assignedEquipment && workItem.assignedEquipment.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-base font-bold text-gray-900 mb-4">현재 할당된 장비</h4>
          <div className="space-y-3">
            {workItem.assignedEquipment.map((equipment, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">유형</span>
                    <span className="text-sm font-medium text-gray-900">{equipment.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">모델</span>
                    <span className="text-sm font-medium text-gray-900">{equipment.model}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">S/N</span>
                    <span className="text-sm font-mono text-gray-600">{equipment.serialNumber}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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

const getContractStatusClass = (status?: string): string => {
  const classMap: { [key: string]: string } = {
    '10': 'scheduled',
    '20': 'active',
    '30': 'suspended',
    '37': 'suspended',
    '90': 'terminated',
  };
  return classMap[status || ''] || '';
};

// 날짜 포맷 (YYYYMMDD -> YYYY-MM-DD)
const formatDate = (dateStr?: string): string => {
  if (!dateStr || dateStr.length < 8) return '-';
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

// 금액 포맷 (1000 -> 1,000)
const formatCurrency = (amount?: string | number): string => {
  if (!amount) return '0';
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
};

export default ContractInfo;
