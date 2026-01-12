import React, { useEffect, useState } from 'react';
import { WorkItem } from '../../../types';
import { getFullContractInfo, getAllAlarmInfo, AllAlarmInfo, getCodeDetail } from '../../../services/apiService';
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

  // Alarm info state
  const [alarmInfo, setAlarmInfo] = useState<AllAlarmInfo | null>(null);
  const [alarmLoading, setAlarmLoading] = useState(false);


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

  // Load alarm info
  useEffect(() => {
    const loadAlarmInfo = async () => {
      if (!workItem.CUST_ID) {
        console.log('[ContractInfo] CUST_ID 없음 - 알림 정보 조회 스킵');
        return;
      }

      setAlarmLoading(true);

      try {
        console.log('[ContractInfo] 알림 정보 로드 시작:', {
          CUST_ID: workItem.CUST_ID,
          WRK_DRCTN_ID: workItem.WRK_DRCTN_ID
        });

        const result = await getAllAlarmInfo(workItem.CUST_ID, workItem.WRK_DRCTN_ID);
        console.log('[ContractInfo] 알림 정보 로드 완료:', result);
        setAlarmInfo(result);

      } catch (error: any) {
        console.error('[ContractInfo] 알림 정보 로드 실패:', error);
        // Don't show error to user, just log it
      } finally {
        setAlarmLoading(false);
      }
    };

    loadAlarmInfo();
  }, [workItem.CUST_ID, workItem.WRK_DRCTN_ID]);


  // 알림 항목 수집 (레이블-값 형태)
  interface AlarmItem {
    label: string;
    value: string;
  }

  const [alarmItems, setAlarmItems] = useState<AlarmItem[]>([]);
  const [vipInfo, setVipInfo] = useState<AlarmItem | null>(null);
  const [isVipExpanded, setIsVipExpanded] = useState(false);
  const [vipMessage, setVipMessage] = useState<string | null>(null);
  const [vipMessageLoading, setVipMessageLoading] = useState(false);

  // VIP 정보 별도 처리 (alarmInfo 로딩과 무관하게 먼저 표시)
  useEffect(() => {
    console.log('[ContractInfo] VIP 체크:', {
      'customer.isVip': workItem.customer?.isVip,
      'VIP_GB': workItem.VIP_GB,
      'customer': workItem.customer
    });
    const isVip = workItem.customer?.isVip || (workItem.VIP_GB && String(workItem.VIP_GB).length > 0);
    if (isVip) {
      const vipLevel = workItem.customer?.vipLevel ||
        (workItem.VIP_GB === 'VIP_VVIP' ? 'VVIP' : 'VIP');
      setVipInfo({ label: 'VIP', value: `${vipLevel} 고객입니다.` });
    } else {
      setVipInfo(null);
    }
  }, [workItem.customer?.isVip, workItem.customer?.vipLevel, workItem.VIP_GB]);

  // VIP 메시지 DB 조회 (COMMON_GRP='MOWO001', COMMON_CD='AL1')
  useEffect(() => {
    const loadVipMessage = async () => {
      const isVip = workItem.customer?.isVip || (workItem.VIP_GB && String(workItem.VIP_GB).length > 0);
      if (!isVip) {
        setVipMessage(null);
        return;
      }

      setVipMessageLoading(true);
      try {
        console.log('[ContractInfo] VIP 메시지 DB 조회 시작');
        const result = await getCodeDetail({
          COMMON_GRP: 'MOWO001',
          COMMON_CD: 'AL1'
        });
        console.log('[ContractInfo] VIP 메시지 DB 조회 결과:', result);

        if (result && result.length > 0 && result[0].REF_CODE) {
          setVipMessage(result[0].REF_CODE);
        } else {
          setVipMessage(null);
        }
      } catch (error) {
        console.error('[ContractInfo] VIP 메시지 DB 조회 실패:', error);
        setVipMessage(null);
      } finally {
        setVipMessageLoading(false);
      }
    };

    loadVipMessage();
  }, [workItem.customer?.isVip, workItem.VIP_GB]);

  useEffect(() => {
    const items: AlarmItem[] = [];
    const wrkCd = workItem.WRK_CD || alarmInfo?.workAlarm?.WRK_CD;

    // alarmInfo 로딩 중이면 리턴
    if (alarmLoading || !alarmInfo) {
      setAlarmItems([]);
      return;
    }

    // workAlarm 확인
    if (alarmInfo.workAlarm) {
      // 레거시: OTT_SALE_DESC 표시
      if (alarmInfo.workAlarm.OTT_SALE_DESC) {
        items.push({ label: 'OTT', value: alarmInfo.workAlarm.OTT_SALE_DESC });
      }
      // 레거시: BUNDLE_ISP_TG='Y' → "번들상품 사용"
      if (alarmInfo.workAlarm.BUNDLE_ISP_TG === 'Y') {
        items.push({ label: '번들', value: '번들상품 사용' });
      }
      // 레거시: WRK_CD IN (01,05,07) && PYM_MTHD='01' && ATMT_YN='Y' → "자동이체/Email승인요청안내"
      if (['01', '05', '07'].includes(wrkCd || '') &&
          alarmInfo.workAlarm.PYM_MTHD === '01' &&
          alarmInfo.workAlarm.ATMT_YN === 'Y') {
        items.push({ label: '자동이체', value: '자동이체/Email승인요청안내' });
      }
      // 레거시: WRK_CD IN (01,05,06,07) → 실명인증 상태 그대로 표시
      if (['01', '05', '06', '07'].includes(wrkCd || '') && alarmInfo.workAlarm.RLNM_AUTH_YN_NM) {
        items.push({ label: '실명인증', value: alarmInfo.workAlarm.RLNM_AUTH_YN_NM });
      }
      // 레거시: COUPON_VAL !== "0" → "잔액 {금액}원"
      if (alarmInfo.workAlarm.COUPON_VAL && alarmInfo.workAlarm.COUPON_VAL !== '0' && Number(alarmInfo.workAlarm.COUPON_VAL) > 0) {
        items.push({ label: 'VOD쿠폰', value: `잔액 ${Number(alarmInfo.workAlarm.COUPON_VAL).toLocaleString()}원` });
      }
    }

    // 레거시: VOD 6개월 이용일 (필드명 대소문자 둘 다 체크)
    const maxDt = alarmInfo.vodLastDate?.max_dt || alarmInfo.vodLastDate?.MAX_DT;
    if (maxDt && String(maxDt).trim().length > 7) {
      items.push({ label: 'VOD이용', value: `최근(6M)VOD신청일: ${formatAlarmDate(String(maxDt))}` });
    }

    // 레거시: specialVod5k BIGO 표시
    if (alarmInfo.specialVod5k?.BIGO) {
      items.push({ label: '특이사항', value: alarmInfo.specialVod5k.BIGO });
    }

    // 레거시: 홍보문자 수신동의 (custBasicInfo.SMS_RCV_YN)
    // Legacy API: customer/customer/general/customerChgInfo.req
    // SMS_RCV_YN: Y=동의, N=거부
    if (alarmInfo.custBasicInfo?.SMS_RCV_YN) {
      const smsYn = String(alarmInfo.custBasicInfo.SMS_RCV_YN);
      if (smsYn === 'Y') {
        items.push({ label: '홍보문자', value: '홍보문자수신동의 : 동의' });
      } else if (smsYn === 'N') {
        items.push({ label: '홍보문자', value: '홍보문자수신동의 : 거부' });
      }
    }

    // 레거시: specialBigo - SPECIAL_GB='G'인 첫 번째 항목의 BIGO만 표시
    if (alarmInfo.specialBigo && alarmInfo.specialBigo.length > 0) {
      const firstGBigo = alarmInfo.specialBigo.find(item => item.SPECIAL_GB === 'G' && item.BIGO);
      if (firstGBigo) {
        items.push({ label: '비고', value: firstGBigo.BIGO || '' });
      }
    }

    if (items.length > 0) {
      console.log('[ContractInfo] 알림 항목:', items);
    }
    setAlarmItems(items);
  }, [alarmInfo, alarmLoading, workItem.WRK_CD]);

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

      {/* VIP 정보 - 토글 형식 */}
      {vipInfo && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg overflow-hidden">
          {/* 토글 헤더 */}
          <button
            onClick={() => setIsVipExpanded(!isVipExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-amber-100 transition-colors"
          >
            <div className="flex items-center">
              <span className="text-xs sm:text-sm font-bold text-amber-600 w-20 sm:w-24 flex-shrink-0">VIP</span>
              <span className="text-xs sm:text-sm font-bold text-amber-700">{vipInfo.value}</span>
            </div>
            <svg
              className={`w-4 h-4 text-amber-600 transition-transform duration-200 ${isVipExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {/* 토글 내용 */}
          {isVipExpanded && (
            <div className="px-3 py-3 border-t border-amber-200 bg-amber-50">
              <div className="text-xs sm:text-sm text-amber-800">
                {vipMessageLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
                    <span>VIP 메시지 로딩 중...</span>
                  </div>
                ) : vipMessage ? (
                  <p className="whitespace-pre-wrap">{vipMessage}</p>
                ) : (
                  <p className="text-amber-600">VIP 고객입니다. 친절한 응대 부탁드립니다.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 알림 정보 */}
      {alarmItems.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">알림</h4>
          <div className="space-y-2 sm:space-y-3">
            {alarmItems.map((item, idx) => (
              <div key={idx} className="flex items-start">
                <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">{item.label}</span>
                <span className="text-xs sm:text-sm font-medium text-gray-900 break-words flex-1">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">계약지점</span>
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
    return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6, 8)}`;
  }

  // 원본 반환 (파싱 불가)
  return str || '-';
};

// 알림 날짜 포맷 (YYYYMMDD -> YYYY-MM-DD)
const formatAlarmDate = (dateStr?: string): string => {
  if (!dateStr || dateStr.length < 8) return '-';
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
};

export default ContractInfo;
