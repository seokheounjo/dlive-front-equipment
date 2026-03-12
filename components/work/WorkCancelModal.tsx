import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { WorkOrder, WorkOrderType } from '../../types';
import Select from '../ui/Select';
import ConfirmModal from '../common/ConfirmModal';
import { validateWorkCancel, isCancellable } from '../../utils/workValidation';
import { isValidMemo } from '../../utils/formValidation';
import { getCommonCodes, getWorkCancelInfo, getOSTInfo, modOstWorkCancel, WorkCancelInfo, OSTInfo } from '../../services/apiService';

interface WorkCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (cancelData: CancelData) => void;
  workOrder: WorkOrder;
  userId?: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface CancelData {
  WRK_ID: string;
  WRK_STAT_CD: string;
  UNPROC_RESN_CD: string;
  CALL_CNTN_DATE: string;
  CHG_UID: string;
  REG_UID: string;
  PROC_CT?: string; // 비고
  RCPT_ID?: string; // 접수 ID (빈 값 허용)
  WRK_CD?: string; // 작업 코드
}

const WorkCancelModal: React.FC<WorkCancelModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  workOrder,
  userId,
  showToast
}) => {
  const [cancelReason, setCancelReason] = useState('[]');
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));

  // 작업ID 포맷팅 (100-840-8270 형식, 3-3-4 자리)
  const formatWorkId = (id: string): string => {
    if (!id) return '';
    const digits = id.replace(/\D/g, ''); // 숫자만 추출
    if (digits.length !== 10) return id; // 10자리가 아니면 원본 반환
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };
  const [procCt, setProcCt] = useState(''); // 비고
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allCancelReasons, setAllCancelReasons] = useState<any[]>([]);

  // OST (전자계약반환) 관련 state
  const [ostWorkableStat, setOstWorkableStat] = useState<string>('X');
  const [hotbillYn, setHotbillYn] = useState<string>('N');
  const [isOstChecking, setIsOstChecking] = useState(false);
  const [showHotbillWarning, setShowHotbillWarning] = useState(false);

  // 내부 알림 모달 (에러/경고용)
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; title?: string; type?: 'error' | 'warning' }>({ isOpen: false, message: '' });

  // 콜센터 지점 코드 목록 (레거시 _CALL_CENTER_SO 변수 + 하드코딩)
  // cm_lib.js: var _CALL_CENTER_SO = "600,700,701,710,800";
  // mowoa10m01.xml: indexOf("802,803,804", s_so_id)
  const CALL_CENTER_SO_LIST = ['600', '700', '701', '710', '800', '802', '803', '804'];

  // 작업 취소 가능 여부 확인 + OST 체크
  useEffect(() => {
    const checkAndFetchOst = async () => {
      console.log('[WorkCancelModal] useEffect 실행 - isOpen:', isOpen, 'WRK_STAT_CD:', workOrder.WRK_STAT_CD, 'workOrder.id:', workOrder.id);

      if (!isOpen) return;

      if (workOrder.WRK_STAT_CD && !isCancellable(workOrder.WRK_STAT_CD)) {
        setAlertModal({
          isOpen: true, title: '작업 취소 불가',
          message: '접수 또는 할당 상태에서만 작업을 취소할 수 있습니다.',
          type: 'error',
        });
        return;
      }

      // OST (전자계약반환) 상태 체크
      if (!workOrder.id) {
        console.log('[OST체크] workOrder.id가 없음 - 스킵');
        return;
      }

      setIsOstChecking(true);
      try {
        console.log('[OST체크] getWorkCancelInfo 호출:', workOrder.id);
        const cancelInfo = await getWorkCancelInfo({
          WRK_ID: workOrder.id,
          RCPT_ID: workOrder.RCPT_ID,
          CUST_ID: workOrder.customer?.id
        });

        if (cancelInfo) {
          console.log('[OST체크] 응답:', cancelInfo);
          setOstWorkableStat(cancelInfo.OST_WORKABLE_STAT || 'X');
          setHotbillYn(cancelInfo.HOTBILL_YN || 'N');

          const stat = cancelInfo.OST_WORKABLE_STAT;
          const wrkCd = workOrder.WRK_CD;

          // OST_WORKABLE_STAT: 0,3,4 -> 취소 불가
          // 0: 취소x 완료x, 1: 취소o, 2: 취소o 완료o, 3: 완료o, 4: 화면취소x 배치취소o, X: OST대상아님
          if (stat === '0' || stat === '3' || stat === '4') {
            let msg = '';
            if (wrkCd === '01') {
              msg = '원스톱전환신청건으로 설치 작업취소는 불가능한 상태입니다.';
            } else if (wrkCd === '02') {
              msg = '원스톱전환해지건으로 철거 작업취소는 불가능한 상태입니다.';
            } else {
              msg = '원스톱전환 관련 건으로 작업취소가 불가능한 상태입니다.';
            }
            setAlertModal({
              isOpen: true, title: '작업 취소 불가',
              message: msg,
              type: 'error',
            });
            return;
          }
        }
      } catch (error) {
        console.error('[OST체크] 에러:', error);
        // 에러 시에도 진행 가능하도록 기본값 유지
        setOstWorkableStat('X');
      } finally {
        setIsOstChecking(false);
      }
    };

    checkAndFetchOst();
  }, [isOpen, workOrder.id, workOrder.WRK_STAT_CD, workOrder.RCPT_ID, workOrder.customer?.id, workOrder.WRK_CD, showToast, onClose]);

  // 공통코드 로드 (모달 열릴 때마다)
  useEffect(() => {
    if (isOpen) {
      loadCancelReasons();
    }
  }, [isOpen]);

  // 취소사유 공통코드 로드
  const loadCancelReasons = async () => {
    try {
      console.log('📥 [작업취소] CMWO200 공통코드 로드 시작');
      const codes = await getCommonCodes('CMWO200');

      console.log('📦 [작업취소] API 응답 첫 항목:', codes[0]);
      console.log('📦 [작업취소] 전체 응답 개수:', codes.length);

      // DB에서 가져온 공통코드를 React 형식으로 변환
      // API에서 오는 "[]" 코드는 제외 (레거시 placeholder 데이터)
      const reasons = codes
        .filter((code: any) => code.code !== '[]')
        .map((code: any) => ({
          value: code.code,
          label: `[${code.code}] ${code.name}`,
          refCode: code.ref_code || '',
          refCode2: code.ref_code2 || '',
          refCode12: code.ref_code12 || ''
        }));

      // 맨 앞에 (선택 안함) 옵션 추가
      reasons.unshift({ value: '[]', label: '(선택 안함)', refCode: '', refCode2: '', refCode12: '' });

      setAllCancelReasons(reasons);
      console.log('[작업취소] 취소사유 로드 완료:', reasons.length, '개');
      console.log('📋 [작업취소] 샘플 데이터:', reasons.slice(0, 3));
    } catch (error) {
      console.error('[작업취소] 취소사유 로드 실패:', error);
      // 에러 시 (선택 안함)만
      setAllCancelReasons([{ value: '[]', label: '(선택 안함)', refCode: '', refCode2: '', refCode12: '' }]);
    }
  };

  // 실시간 검증
  useEffect(() => {
    const newErrors: { [key: string]: string } = {};

    // 취소 사유가 기타인 경우 상세 내용 검증
    if (cancelReason !== '[]' && cancelReason.endsWith('Z')) {
      const memoValidation = isValidMemo(procCt, 10, 200);
      if (!memoValidation.valid) {
        newErrors.procCt = memoValidation.message || '상세 내용을 10자 이상 입력해주세요.';
      }
    }

    setErrors(newErrors);
  }, [cancelReason, procCt]);

  // WRK_CD에 따라 refCode 결정 (레거시 로직)
  const getRefCodeByWrkCd = (wrkCd?: string): string => {
    if (!wrkCd) return '01';

    // WRK_CD에 따른 refcode 매핑
    if (wrkCd === '05' || wrkCd === '06' || wrkCd === '07' || wrkCd === '09') {
      return '01'; // 설치 계열
    } else if (wrkCd === '08') {
      return '02'; // 철거 계열
    } else if (wrkCd === '03') {
      return '03'; // AS
    } else {
      return wrkCd; // 그대로 사용
    }
  };

  // 취소 사유 필터링 (레거시 로직 적용)
  const cancelReasons = useMemo(() => {
    const wrkCd = workOrder.WRK_CD;
    const wrkRcptCl = workOrder.asReasonCode; // WRK_RCPT_CL
    const soId = workOrder.SO_ID;

    const refCode = getRefCodeByWrkCd(wrkCd);
    const refCodeWithSuffix = refCode + '3'; // 예: '013', '023', '033'

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[취소사유 필터] 필터링 시작');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 WRK_CD:', wrkCd, '→ refCode:', refCode, '→ refCodeWithSuffix:', refCodeWithSuffix);
    console.log('📌 WRK_RCPT_CL:', wrkRcptCl);
    console.log('📌 SO_ID:', soId);
    console.log('📌 전체 취소사유 개수:', allCancelReasons.length);

    let filtered = allCancelReasons.filter(reason => {
      // 빈 값은 항상 포함
      if (reason.value === '[]') {
        console.log('  빈 값 포함');
        return true;
      }

      // REF_CODE가 일치하는 것만
      if (reason.refCode !== refCodeWithSuffix) {
        console.log(`  [${reason.value}] ${reason.label}: refCode="${reason.refCode}" != "${refCodeWithSuffix}"`);
        return false;
      }

      console.log(`  [${reason.value}] ${reason.label}: refCode="${reason.refCode}" 일치`);
      return true;
    });

    // AS(03) 작업인 경우 추가 필터링
    // 레거시 mowoa10m01.xml cmb_cncl_resn_OnDropDown 동일 구현
    if (refCode === '03') {
      console.log('[AS 필터] AS 작업 추가 필터링 시작');
      console.log('[AS 필터] WRK_RCPT_CL:', wrkRcptCl);

      if (wrkRcptCl === 'JJ') {
        // CS접수(JJ)건: 033G만 (레거시: sFilter = "COMMON_CD=='033G'")
        console.log('[AS 필터] CS접수(JJ) - 033G만 허용');
        filtered = filtered.filter(r => r.value === '033G');
      } else if (wrkRcptCl === 'JH') {
        // 일반해지(JH)건: 033H만 (레거시: sFilter = "COMMON_CD=='033H'")
        console.log('[AS 필터] 일반해지(JH) - 033H만 허용');
        filtered = filtered.filter(r => r.value === '033H');
      } else {
        // 그 외: 콜센터전용/033H 제외 (033G는 포함)
        console.log('[AS 필터] 일반 AS 필터링');
        filtered = filtered.filter(r => {
          // 콜센터가 아닌 경우 콜센터전용(REF_CODE2='Y') 제외
          if (r.refCode2 === 'Y') {
            const isCallCenter = CALL_CENTER_SO_LIST.includes(soId || '');
            if (!isCallCenter) return false;
          }
          // REF_CODE12='JH' 제외 (033H)
          if (r.refCode12 === 'JH') return false;
          return true;
        });
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[취소사유 필터] 최종 결과:', filtered.length, '개');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return filtered;
  }, [workOrder.WRK_CD, workOrder.asReasonCode, workOrder.SO_ID, allCancelReasons]);

  // 작업 유형을 코드로 매핑하는 함수
  const getWorkTypeCode = (workOrder: WorkOrder): string => {
    const type = workOrder.type as string;
    const typeDisplay = workOrder.typeDisplay;
    
    // WorkOrderType enum 값, 키, 또는 typeDisplay로 비교
    if (type === WorkOrderType.Installation || type === 'Installation' || type === '신규설치' || typeDisplay === '신규설치') {
      return '01';
    } else if (type === WorkOrderType.AS || type === 'AS' || type === 'A/S' || typeDisplay === 'A/S') {
      return '02';
    } else if (type === WorkOrderType.Move || type === 'Move' || type === '이전설치' || typeDisplay === '이전설치') {
      return '03';
    } else if (type === WorkOrderType.Change || type === 'Change' || type === '상품변경' || typeDisplay === '상품변경') {
      return '04';
    } else {
      return '05'; // 기타
    }
  };

  // Hotbill 경고 확인 후 실제 취소 진행
  const proceedWithCancel = async () => {
    setShowHotbillWarning(false);
    await executeCancel();
  };

  // 실제 취소 실행 함수
  const executeCancel = async () => {
    setIsSubmitting(true);
    const wrkCd = workOrder.WRK_CD || '';

    console.log('[작업취소] OST_WORKABLE_STAT:', ostWorkableStat, 'WRK_CD:', wrkCd);

    // OST_WORKABLE_STAT가 1 또는 2이고 설치(01) 또는 철거(02)인 경우 OST 연동 취소
    if ((ostWorkableStat === '1' || ostWorkableStat === '2') && (wrkCd === '01' || wrkCd === '02')) {
      console.log('[작업취소] OST 연동 취소 진행');

      try {
        // getOSTInfo 호출하여 ost_busi 확인
        const ostInfo = await getOSTInfo({
          RCPT_ID: workOrder.RCPT_ID || '',
          CUST_ID: workOrder.customer?.id || '',
          AGENT_FL: '1'  // 파견업체(반환신규)
        });

        if (ostInfo) {
          const ost_busi = (ostInfo.AGENT_FL || '') + (ostInfo.BUSI_TYPE || '') + (ostInfo.RES_CD || '');
          console.log('[작업취소] OST_BUSI:', ost_busi);

          // 전자계약반환시스템과 연동(0400,0420) 필요한 경우
          if (ost_busi === '10310BS0000' || ost_busi === '10320BS0000') {
            console.log('[작업취소] modOstWorkCancel API 호출');

            const result = await modOstWorkCancel({
              RCPT_ID: workOrder.RCPT_ID || '',
              WRK_CD: wrkCd,
              UNPROC_RESN_CD: cancelReason,
              WRK_STAT_CD: '3',
              PROC_CT: procCt || '',
              REG_UID: userId || ''
            });

            if (result.code === 'SUCCESS' || result.message === 'SUCCESS') {
              if (showToast) showToast('작업이 취소되었습니다.', 'success');
              onClose();
            } else {
              setAlertModal({
                isOpen: true, title: '작업 취소 실패',
                message: result.message || '작업 취소에 실패했습니다.',
                type: 'error',
              });
            }
            setIsSubmitting(false);
            return;
          }
        }
        // OST 연동이 필요 없으면 일반 취소로 진행
      } catch (error) {
        console.error('[작업취소] OST 연동 에러:', error);
        setAlertModal({
          isOpen: true, title: '작업 취소 오류',
          message: 'OST 연동 중 오류가 발생했습니다.',
          type: 'error',
        });
        setIsSubmitting(false);
        return;
      }
    }

    // 일반 취소 진행
    const wrkCode = getWorkTypeCode(workOrder);

    const cancelData: CancelData = {
      WRK_ID: workOrder.id,
      WRK_STAT_CD: "3",
      UNPROC_RESN_CD: cancelReason,
      CALL_CNTN_DATE: callDate.replace(/-/g, ''),
      CHG_UID: userId || "",
      REG_UID: userId || "",
      PROC_CT: procCt || "",
      RCPT_ID: workOrder.RCPT_ID || "",
      WRK_CD: wrkCode
    };

    console.log('작업취소 전송 데이터:', cancelData);

    onConfirm(cancelData);
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 중복 제출 방지
    if (isSubmitting) {
      return;
    }

    // 검증 수행
    const validation = validateWorkCancel(workOrder, cancelReason, procCt);

    if (!validation.valid) {
      // 검증 실패 시 에러 메시지 표시
      const errorMessage = validation.errors.join('\n');
      setAlertModal({
        isOpen: true, title: '입력 오류',
        message: errorMessage,
        type: 'error',
      });
      return;
    }

    // 기타 사유인 경우 상세 내용 필수
    if (cancelReason !== '[]' && cancelReason.endsWith('Z') && procCt.trim().length < 10) {
      setAlertModal({
        isOpen: true, title: '입력 오류',
        message: '기타 사유 선택 시 상세 내용을 10자 이상 입력해주세요.',
        type: 'error',
      });
      return;
    }

    if (!userId) {
      setAlertModal({
        isOpen: true, title: '로그인 필요',
        message: '사용자 정보(사번)가 없습니다. 다시 로그인해주세요.',
        type: 'error',
      });
      return;
    }

    // 이전설치(07) + HOTBILL_YN='Y' 경고 표시
    const wrkCd = workOrder.WRK_CD || '';
    if (wrkCd === '07' && hotbillYn === 'Y') {
      // TODO: 취소사유의 REF_CODE5가 'N'이 아닌 경우만 경고 (현재는 일단 모든 경우 경고)
      setShowHotbillWarning(true);
      return;
    }

    await executeCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-[9999]">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-4 sm:p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-bold">작업 취소</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 작업 정보 */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">취소할 작업 정보</h4>
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">고객명:</span>
              <span className="text-sm font-medium">{workOrder.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">작업 유형:</span>
              <span className="text-sm font-medium">{workOrder.typeDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">작업 ID:</span>
              <span className="text-sm font-mono">{formatWorkId(workOrder.id)}</span>
            </div>
          </div>
        </div>

        {/* 취소 정보 입력 */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* 취소 사유 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                취소 사유 <span className="text-red-500">*</span>
              </label>
              <Select
                value={cancelReason}
                onValueChange={setCancelReason}
                options={cancelReasons}
                placeholder=""
                required
              />
            </div>

            {/* 전화연결일 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                전화연결일 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 opacity-0 absolute inset-0 cursor-pointer"
                  required
                />
                <div className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900">
                  {callDate || 'YYYY-MM-DD'}
                </div>
              </div>
            </div>

            {/* 비고 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비고 {cancelReason !== '[]' && cancelReason.endsWith('Z') && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={procCt}
                onChange={(e) => setProcCt(e.target.value)}
                placeholder={cancelReason !== '[]' && cancelReason.endsWith('Z') ? '기타 사유 선택 시 상세 내용을 10자 이상 입력해주세요' : '취소 사유에 대한 상세 내용을 입력하세요'}
                className={`w-full p-3 border rounded-lg focus:ring-cyan-500 focus:border-cyan-500 min-h-[80px] resize-y ${
                  errors.procCt ? 'border-red-500' : 'border-gray-300'
                }`}
                maxLength={200}
                required={cancelReason !== '[]' && cancelReason.endsWith('Z')}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">
                  {procCt.length}/200자
                </p>
                {cancelReason !== '[]' && cancelReason.endsWith('Z') && (
                  <p className="text-xs text-primary-700">
                    (최소 10자 필수)
                  </p>
                )}
              </div>
              {errors.procCt && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.procCt}
                </p>
              )}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isOstChecking || (cancelReason && cancelReason.endsWith('Z') && procCt.trim().length < 10)}
              className={`flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-semibold transition-all duration-200 ${
                (isSubmitting || isOstChecking || (cancelReason && cancelReason.endsWith('Z') && procCt.trim().length < 10)) ? 'bg-gray-400 !from-gray-400 !to-gray-400 text-white cursor-not-allowed' : ''
              }`}
            >
              {isOstChecking ? '확인중...' : isSubmitting ? '처리중...' : '작업 취소 확정'}
            </button>
          </div>
        </form>
      </div>

      {/* 에러/경고 알림 모달 */}
      <ConfirmModal
        isOpen={alertModal.isOpen}
        onClose={() => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          // 취소 불가 알림 후 모달 닫기
          if (alertModal.title === '작업 취소 불가') {
            onClose();
          }
        }}
        onConfirm={() => {
          if (alertModal.title === '작업 취소 불가') {
            onClose();
          }
        }}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        showCancel={false}
      />

      {/* Hotbill (단말반환대금) 경고 모달 */}
      {showHotbillWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[10000]">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-800">단말반환대금 안내</h4>
            </div>
            <div className="text-sm text-gray-700 space-y-2 mb-6">
              <p>이전철거 작업이 완료되어 <strong className="text-amber-700">단말반환대금이 청구</strong>됩니다.</p>
              <p className="text-gray-600">단말반환대금은 고객센터에서 청구하지 않고 CONA 결재를 통해서 또는 작업지시 주변금액내역에서 확인이 가능합니다.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowHotbillWarning(false)}
                className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={proceedWithCancel}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
              >
                확인 후 진행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkCancelModal;
