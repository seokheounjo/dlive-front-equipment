import React, { useEffect, useState } from 'react';
import { WorkItem } from '../../../types';
import { getFullContractInfo, getAllAlarmInfo, AllAlarmInfo, getCodeDetail, getMoveWorkInfo, MoveWorkInfo, getCtrtDetailInfo, getAfterProcInfo } from '../../../services/apiService';
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
  // 상품명 (detailinfo 기준)
  BASIC_PROD_CD_NM?: string;
}

const ContractInfo: React.FC<ContractInfoProps> = ({ workItem, onNext, onBack }) => {
  const [contractDetail, setContractDetail] = useState<ContractDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Alarm info state
  const [alarmInfo, setAlarmInfo] = useState<AllAlarmInfo | null>(null);
  const [alarmLoading, setAlarmLoading] = useState(false);

  // 계약 목록 (상품변경 시 변경 전 상품명 조회용)
  const [contracts, setContracts] = useState<any[]>([]);

  // 상품변경 여부
  const isProductChange = workItem.WRK_CD === '05';

  // 이전설치/이전철거 여부
  const isRelocateInstall = workItem.WRK_CD === '07';  // 이전설치
  const isRelocateTerminate = workItem.WRK_CD === '08'; // 이전철거
  const isRelocateWork = isRelocateInstall || isRelocateTerminate;

  // 연계작업 정보 (이전설치/이전철거)
  const [moveWorkInfo, setMoveWorkInfo] = useState<MoveWorkInfo | null>(null);
  const [moveWorkLoading, setMoveWorkLoading] = useState(false);

  // 후처리 정보 (재약정 대상 등)
  const [afterProcInfo, setAfterProcInfo] = useState<{ CLOSE_DANGER?: string; WRK_DRCTN_PRNT_YN?: string; AUTO_PAYMENTS_YN?: string } | null>(null);

  // 모든 작업에서 getCtrtDetailInfo 호출 (약정정보, 단체정보, IP수 등)
  // 레거시: mowoDivB.xml에서 customer/negociation/getCtrtDetailInfo1.req 호출
  useEffect(() => {
    const loadContractDetail = async () => {
      // 상품변경(05)일 때는 DTL_CTRT_ID(변경후 계약ID) 사용
      const ctrtIdToUse = isProductChange && (workItem as any).DTL_CTRT_ID
        ? (workItem as any).DTL_CTRT_ID
        : workItem.CTRT_ID;

      // CTRT_ID가 없으면 API 호출 스킵
      if (!ctrtIdToUse) {
        console.log('[ContractInfo] CTRT_ID 없음 - getCtrtDetailInfo 스킵');
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        console.log('[ContractInfo] getCtrtDetailInfo 호출 시작:', {
          CTRT_ID: ctrtIdToUse,
          CUST_ID: workItem.CUST_ID,
          isProductChange,
          DTL_CTRT_ID: (workItem as any).DTL_CTRT_ID
        });

        // 1. 모든 작업에서 getCtrtDetailInfo 호출 (약정, 단체, IP수)
        // 상품변경 시 DTL_CTRT_ID로 조회해야 변경후 상품이 정상 표시
        const ctrtDetail = await getCtrtDetailInfo(ctrtIdToUse, workItem.CUST_ID);

        if (ctrtDetail) {
          console.log('[ContractInfo] getCtrtDetailInfo 응답:', ctrtDetail);
          setContractDetail({
            PROM_CNT: ctrtDetail.PROM_CNT,
            CTRT_APLY_STRT_DT: ctrtDetail.CTRT_APLY_STRT_DT,
            CTRT_APLY_END_DT: ctrtDetail.CTRT_APLY_END_DT,
            GRP_ID: ctrtDetail.GRP_ID,
            GRP_NM: ctrtDetail.GRP_NM,
            IP_CNT: ctrtDetail.IP_CNT,
            SO_NM: ctrtDetail.SO_NM,
            BASIC_PROD_CD_NM: ctrtDetail.BASIC_PROD_CD_NM,
          });
        }

        // 2. 상품변경일 때만 getFullContractInfo 추가 호출 (변경 전/후 상품 비교용)
        if (isProductChange && workItem.CUST_ID) {
          console.log('[ContractInfo] 상품변경 - getFullContractInfo 추가 호출');
          const fullResult = await getFullContractInfo({
            CUST_ID: workItem.CUST_ID,
            CTRT_ID: workItem.CTRT_ID
          });
          console.log('[ContractInfo] getFullContractInfo 응답:', fullResult);
          setContracts(fullResult.contracts || []);
        }

      } catch (error: any) {
        console.error('[ContractInfo] 계약 정보 로드 실패:', error);
        setLoadError(error.message || '계약 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadContractDetail();
  }, [isProductChange, workItem.CUST_ID, workItem.CTRT_ID, (workItem as any).DTL_CTRT_ID]);

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

  // 후처리 정보 로드 (재약정 대상 등)
  useEffect(() => {
    const loadAfterProcInfo = async () => {
      if (!workItem.WRK_DRCTN_ID) return;

      try {
        const result = await getAfterProcInfo(workItem.WRK_DRCTN_ID);
        if (result) {
          console.log('[ContractInfo] getAfterProcInfo 결과:', result);
          setAfterProcInfo(result);
        }
      } catch (error) {
        console.error('[ContractInfo] getAfterProcInfo 실패:', error);
      }
    };

    loadAfterProcInfo();
  }, [workItem.WRK_DRCTN_ID]);

  // 이전설치/이전철거 연계작업 정보 로드
  useEffect(() => {
    const loadMoveWorkInfo = async () => {
      // WRK_ID 또는 id 필드 사용 (workItem 구조에 따라 다름)
      const wrkId = workItem.WRK_ID || workItem.id;

      if (!isRelocateWork || !wrkId) {
        console.log('[ContractInfo] 연계작업 정보 조회 스킵 (WRK_CD:', workItem.WRK_CD, ', WRK_ID:', wrkId, ')');
        return;
      }

      setMoveWorkLoading(true);

      try {
        console.log('[ContractInfo] 연계작업 정보 조회 시작:', {
          WRK_CD: workItem.WRK_CD,
          WRK_ID: wrkId,
          RCPT_ID: workItem.RCPT_ID
        });

        const result = await getMoveWorkInfo({
          WRK_CD: workItem.WRK_CD || '',
          WRK_ID: wrkId,
          RCPT_ID: workItem.RCPT_ID,
        });

        console.log('[ContractInfo] 연계작업 정보 조회 결과:', result);
        setMoveWorkInfo(result);

      } catch (error: any) {
        console.error('[ContractInfo] 연계작업 정보 조회 실패:', error);
      } finally {
        setMoveWorkLoading(false);
      }
    };

    loadMoveWorkInfo();
  }, [isRelocateWork, workItem.WRK_CD, workItem.WRK_ID, workItem.id, workItem.RCPT_ID]);

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

    // 재약정 대상 여부 (getAfterProcInfo에서 CLOSE_DANGER 값으로 판별)
    if (afterProcInfo) {
      if (afterProcInfo.CLOSE_DANGER === 'Y') {
        items.push({ label: '재약정', value: '재약정 대상입니다' });
      } else {
        items.push({ label: '재약정', value: '재약정 대상이 아닙니다' });
      }
    }

    // workAlarm 확인
    if (alarmInfo.workAlarm) {
      // 레거시: OTT_SALE_DESC 표시
      if (alarmInfo.workAlarm.OTT_SALE_DESC) {
        items.push({ label: 'OTT', value: alarmInfo.workAlarm.OTT_SALE_DESC });
      }
      // 레거시: BUNDLE_ISP_TG='Y' → "번들상품 사용"
      if (alarmInfo.workAlarm.BUNDLE_ISP_TG === 'Y') {
        items.push({ label: '번들', value: '후번들 대상' });
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
        items.push({ label: '홍보문자', value: '동의' });
      } else if (smsYn === 'N') {
        items.push({ label: '홍보문자', value: '비동의' });
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
  }, [alarmInfo, alarmLoading, workItem.WRK_CD, afterProcInfo]);

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
    // 계약지점 (본부명)
    MSO_NM: (workItem as any).MSO_NM,
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
      {loadError && !isLoading && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs sm:text-sm text-yellow-700">{loadError}</span>
          </div>
        </div>
      )}

      {/* 로딩 완료 후에만 내용 표시 */}
      {!isLoading && (
        <>
      {/* 고객 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">고객 정보</h4>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start">
            <span className="text-xs sm:text-sm text-gray-500 w-16 sm:w-20 flex-shrink-0">고객명</span>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                {workItem.customer.name}
                {workItem.customer.id && (
                  <span className="text-gray-400 font-normal ml-1">({workItem.customer.id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')})</span>
                )}
              </span>
              {workItem.customer.isVip && (
                <span className={`
                  px-1.5 sm:px-2 py-0.5 rounded-full text-[0.625rem] sm:text-xs font-semibold flex-shrink-0
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
            <span className="text-xs sm:text-sm font-medium text-gray-900 break-all">{formatId(workItem.PYM_ACNT_ID) || '-'}</span>
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

      {/* 상품정보 - 상품변경/이전설치/이전철거일 때는 좌우 비교 형태 */}
      {isProductChange ? (
        // 상품변경: 변경 전 / 변경 후
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">상품정보</h4>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* 변경 전 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2 pb-2 border-b border-gray-200">변경 전</div>
              <div className="space-y-2">
                <>
                  <div>
                    <div className="text-[0.625rem] sm:text-xs text-gray-400">상품명</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-900 break-words">{workItem.OLD_PROD_NM || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[0.625rem] sm:text-xs text-gray-400">계약ID</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700">{formatId(workItem.OLD_CTRT_ID || workItem.CTRT_ID)}</div>
                  </div>
                  <div>
                    <div className="text-[0.625rem] sm:text-xs text-gray-400">계약상태</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700">{workItem.OLD_CTRT_STAT_NM || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[0.625rem] sm:text-xs text-gray-400">약정</div>
                    <div className="text-xs sm:text-sm font-medium text-gray-700">{workItem.OLD_PROM_CNT ? `${workItem.OLD_PROM_CNT}개월` : '-'}</div>
                  </div>
                </>
              </div>
            </div>
            {/* 변경 후 */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-xs font-semibold text-blue-600 mb-2 pb-2 border-b border-blue-200">변경 후</div>
              <div className="space-y-2">
                {(() => {
                  const newContract = contracts.find(c => c.CTRT_ID === workItem.DTL_CTRT_ID);
                  // detailinfo 조회 결과(BASIC_PROD_CD_NM) 우선 사용
                  const newProductName = contractDetail?.BASIC_PROD_CD_NM || newContract?.BASIC_PROD_CD_NM;
                  return (
                    <>
                      <div>
                        <div className="text-[0.625rem] sm:text-xs text-blue-400">상품명</div>
                        <div className="text-xs sm:text-sm font-medium text-blue-700 break-words">{newProductName || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[0.625rem] sm:text-xs text-blue-400">계약ID</div>
                        <div className="text-xs sm:text-sm font-medium text-blue-600">{formatId(workItem.DTL_CTRT_ID || newContract?.CTRT_ID)}</div>
                      </div>
                      <div>
                        <div className="text-[0.625rem] sm:text-xs text-blue-400">계약상태</div>
                        <div className="text-xs sm:text-sm font-medium text-blue-600">{newContract?.CTRT_STAT_NM || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[0.625rem] sm:text-xs text-blue-400">약정</div>
                        <div className="text-xs sm:text-sm font-medium text-blue-600">{newContract?.PROM_CNT ? `${newContract.PROM_CNT}개월` : '-'}</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : isRelocateWork ? (
        // 이전설치/이전철거: 이전철거 / 이전설치 비교
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">상품정보</h4>
          {moveWorkLoading ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="text-xs sm:text-sm text-gray-600">연계작업 정보 조회 중...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* 이전철거 (왼쪽) */}
              <div className={`rounded-lg p-3 ${isRelocateTerminate ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                <div className={`text-xs font-semibold mb-2 pb-2 border-b ${isRelocateTerminate ? 'text-blue-600 border-blue-200' : 'text-gray-500 border-gray-200'}`}>
                  이전철거
                </div>
                <div className="space-y-2">
                  <div>
                    <div className={`text-[0.625rem] sm:text-xs ${isRelocateTerminate ? 'text-blue-400' : 'text-gray-400'}`}>상품명</div>
                    <div className={`text-xs sm:text-sm font-medium break-words ${isRelocateTerminate ? 'text-blue-700' : 'text-gray-900'}`}>
                      {isRelocateTerminate ? (contractDetail?.BASIC_PROD_CD_NM || '-') : (moveWorkInfo?.PROD_NM || '-')}
                    </div>
                  </div>
                  <div>
                    <div className={`text-[0.625rem] sm:text-xs ${isRelocateTerminate ? 'text-blue-400' : 'text-gray-400'}`}>계약ID</div>
                    <div className={`text-xs sm:text-sm font-medium ${isRelocateTerminate ? 'text-blue-600' : 'text-gray-700'}`}>
                      {isRelocateTerminate ? formatId(workItem.CTRT_ID) : formatId(moveWorkInfo?.OLD_CTRT_ID || moveWorkInfo?.CTRT_ID)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-[0.625rem] sm:text-xs ${isRelocateTerminate ? 'text-blue-400' : 'text-gray-400'}`}>작업주소</div>
                    <div className={`text-xs sm:text-sm font-medium break-words ${isRelocateTerminate ? 'text-blue-600' : 'text-gray-700'}`}>
                      {isRelocateTerminate ? (workItem.customer?.address || '-') : (moveWorkInfo?.ADDR_ORD || '-')}
                    </div>
                  </div>
                  <div>
                    <div className={`text-[0.625rem] sm:text-xs ${isRelocateTerminate ? 'text-blue-400' : 'text-gray-400'}`}>작업상태</div>
                    <div className={`text-xs sm:text-sm font-medium ${isRelocateTerminate ? 'text-blue-600' : 'text-gray-700'}`}>
                      {isRelocateTerminate ? (workItem.WRK_STAT_NM || '-') : (moveWorkInfo?.WRK_STAT_NM || '-')}
                    </div>
                  </div>
                </div>
              </div>
              {/* 이전설치 (오른쪽) */}
              <div className={`rounded-lg p-3 ${isRelocateInstall ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                <div className={`text-xs font-semibold mb-2 pb-2 border-b ${isRelocateInstall ? 'text-blue-600 border-blue-200' : 'text-gray-500 border-gray-200'}`}>
                  이전설치
                </div>
                <div className="space-y-2">
                  <div>
                    <div className={`text-[0.625rem] sm:text-xs ${isRelocateInstall ? 'text-blue-400' : 'text-gray-400'}`}>상품명</div>
                    <div className={`text-xs sm:text-sm font-medium break-words ${isRelocateInstall ? 'text-blue-700' : 'text-gray-900'}`}>
                      {isRelocateInstall ? (contractDetail?.BASIC_PROD_CD_NM || '-') : (moveWorkInfo?.PROD_NM || '-')}
                    </div>
                  </div>
                  <div>
                    <div className={`text-[0.625rem] sm:text-xs ${isRelocateInstall ? 'text-blue-400' : 'text-gray-400'}`}>계약ID</div>
                    <div className={`text-xs sm:text-sm font-medium ${isRelocateInstall ? 'text-blue-600' : 'text-gray-700'}`}>
                      {isRelocateInstall ? formatId(workItem.CTRT_ID) : formatId(moveWorkInfo?.CTRT_ID)}
                    </div>
                  </div>
                  <div>
                    <div className={`text-[0.625rem] sm:text-xs ${isRelocateInstall ? 'text-blue-400' : 'text-gray-400'}`}>작업주소</div>
                    <div className={`text-xs sm:text-sm font-medium break-words ${isRelocateInstall ? 'text-blue-600' : 'text-gray-700'}`}>
                      {isRelocateInstall ? (workItem.customer?.address || '-') : (moveWorkInfo?.ADDR_ORD || '-')}
                    </div>
                  </div>
                  <div>
                    <div className={`text-[0.625rem] sm:text-xs ${isRelocateInstall ? 'text-blue-400' : 'text-gray-400'}`}>작업상태</div>
                    <div className={`text-xs sm:text-sm font-medium ${isRelocateInstall ? 'text-blue-600' : 'text-gray-700'}`}>
                      {isRelocateInstall ? (workItem.WRK_STAT_NM || '-') : (moveWorkInfo?.WRK_STAT_NM || '-')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // 일반 작업: 단일 상품정보
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">상품정보</h4>
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
              <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">상품명</span>
              <span className="text-xs sm:text-sm font-medium text-gray-900 break-words flex-1">{contractDetail?.BASIC_PROD_CD_NM || workItem.productName || '-'}</span>
            </div>
            <div className="flex items-start">
              <span className="text-xs sm:text-sm text-gray-500 w-20 sm:w-24 flex-shrink-0">IP수</span>
              <span className="text-xs sm:text-sm font-medium text-gray-900">{displayData.IP_CNT || '-'}</span>
            </div>
          </div>
        </div>
      )}
        </>
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
