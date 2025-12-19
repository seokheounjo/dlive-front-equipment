/**
 * CompleteTerminate.tsx
 * WRK_CD=02 (철거) 작업완료 페이지
 *
 * 레거시 참조: mowoa03m02.xml - 작업완료(철거)
 * 특징:
 * - btn_eqt_rmv (장비철거) 버튼 표시 (SO_ID != 403일 때)
 * - btn_hot_bill (즉납) 버튼 표시
 * - btn_save (작업완료) 버튼 - KPI_PROD_GRP가 C/D면 숨김
 * - 철거정보 입력 필수
 */
import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail } from '../../../../services/apiService';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import HotbillSection from '../HotbillSection';
import RemovalLineSection, { RemovalLineData } from '../RemovalLineSection';
import RemovalASAssignModal, { ASAssignData } from '../../../modal/RemovalASAssignModal';
import ConfirmModal from '../../../common/ConfirmModal';
import { insertWorkRemoveStat, modAsPdaReceipt } from '../../../../services/apiService';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import '../../../../styles/buttons.css';

interface CompleteTerminateProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteTerminate: React.FC<CompleteTerminateProps> = ({
  order,
  onBack,
  onSuccess,
  showToast,
  equipmentData: legacyEquipmentData,
  readOnly = false
}) => {
  // 완료/취소된 작업 여부 확인
  const isWorkCompleted = readOnly
    || order.WRK_STAT_CD === '3'
    || order.WRK_STAT_CD === '4'
    || order.WRK_STAT_CD === '7'
    || order.status === '완료'
    || order.status === '취소';

  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Store에서 장비 데이터
  const { equipmentData: storeEquipmentData, filteringData } = useWorkProcessStore();
  const equipmentData = storeEquipmentData || legacyEquipmentData || filteringData;

  // React Query Mutation
  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  // localStorage 키
  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 폼 상태
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');

  // 모달 상태
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [networkTypeName, setNetworkTypeName] = useState('');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);

  // 인입선로 철거관리
  const [removalLineData, setRemovalLineData] = useState<RemovalLineData | null>(null);
  const [showASAssignModal, setShowASAssignModal] = useState(false);
  const [isASProcessing, setIsASProcessing] = useState(false);

  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingIsEquipmentRemoval, setPendingIsEquipmentRemoval] = useState(false);

  // 연동이력 모달
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);

  // 핫빌 계산 중 상태 (전체 화면 스피너용)
  const [isHotbillSimulating, setIsHotbillSimulating] = useState(false);

  // 핫빌 확인 상태 (작업완료 전 필수 체크)
  const [isHotbillConfirmed, setIsHotbillConfirmed] = useState(false);

  // 공통코드
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);

  // 작업처리일
  const [workCompleteDate, setWorkCompleteDate] = useState(() => {
    const cmplDt = (order as any).WRKR_CMPL_DT || (order as any).WRK_END_DTTM;
    if (cmplDt && cmplDt.length >= 8) {
      return `${cmplDt.slice(0,4)}-${cmplDt.slice(4,6)}-${cmplDt.slice(6,8)}`;
    }
    const today = new Date();
    return today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
  });

  // 장비철거 버튼 표시 여부 (레거시: SO_ID != 403)
  const showEquipmentRemovalButton = order.SO_ID !== '403';

  // 레거시 조건값들
  const voipCtx = (order as any).VOIP_CTX || '';
  const ostWorkableStat = (order as any).OST_WORKABLE_STAT || '';
  const wrkStatCd = order.WRK_STAT_CD || '';
  const kpiProdGrp = (order as any).KPI_PROD_GRP_CD || '';

  // 장비철거 버튼 활성화 여부 (레거시: mowoa03m02.xml fn_chg_button_state)
  // - WRK_STAT_CD = 1(접수) 또는 2(할당)일 때 활성화
  // - WRK_STAT_CD = 7(취소요청)일 때 비활성화
  // - VOIP_CTX가 있으면 비활성화 (Line 509-510)
  // - OST_WORKABLE_STAT = 0, 1, 4이면 비활성화 (Line 523-534)
  const isEquipmentRemovalEnabled = (() => {
    // 완료된 작업이면 비활성화
    if (isWorkCompleted) return false;

    // OST 체크 (레거시 Line 523-534)
    if (ostWorkableStat === '0' || ostWorkableStat === '1' || ostWorkableStat === '4') {
      return false;
    }

    // VOIP_CTX가 있으면 비활성화 (레거시 Line 509-510)
    if (voipCtx) return false;

    // WRK_STAT_CD 체크 (레거시 Line 470-503)
    // 1(접수), 2(할당)일 때만 활성화
    // 7(취소요청)이나 그 외는 비활성화
    if (wrkStatCd === '1' || wrkStatCd === '2') {
      return true;
    }

    return false;
  })();

  // 작업완료 버튼 표시 여부 (레거시: KPI_PROD_GRP != C, D - Line 507-508)
  const showSaveButton = kpiProdGrp !== 'C' && kpiProdGrp !== 'D';

  // 작업완료 버튼 활성화 여부 (레거시: mowoa03m02.xml fn_chg_button_state)
  const isSaveButtonEnabled = (() => {
    if (isWorkCompleted) return false;

    // OST 체크 (레거시 Line 523-534)
    if (ostWorkableStat === '0' || ostWorkableStat === '1' || ostWorkableStat === '4') {
      return false;
    }

    // WRK_STAT_CD 체크 (레거시 Line 470-503)
    // 1(접수), 2(할당), 7(취소요청)일 때 활성화
    if (wrkStatCd === '1' || wrkStatCd === '2' || wrkStatCd === '7') {
      return true;
    }

    return false;
  })();

  // 데이터 복원 - 기존 설치정보 API에서 가져오기 (정지 작업과 동일)
  useEffect(() => {
    const fetchWorkDetail = async () => {
      try {
        console.log('[WorkCompleteTerminate] 작업 상세 조회 시작');
        const detail = await getWorkReceiptDetail({
          WRK_DRCTN_ID: order.directionId || order.id,
          WRK_ID: (order as any).WRK_ID,
          SO_ID: order.SO_ID
        });

        if (detail) {
          console.log('[WorkCompleteTerminate] API 응답:', { NET_CL: detail.NET_CL, NET_CL_NM: detail.NET_CL_NM });

          // 완료된 작업이면 모든 값 복원
          if (isWorkCompleted) {
            setMemo((detail.MEMO || '').replace(/\\n/g, '\n'));
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          }

          // 철거정보는 항상 API에서 가져옴 (기존 계약 정보)
          setNetworkType(detail.NET_CL || '');
          setNetworkTypeName(detail.NET_CL_NM || '');
          setInstallInfoData(prev => prev || {
            NET_CL: detail.NET_CL || '',
            NET_CL_NM: detail.NET_CL_NM || '',
            WRNG_TP: detail.WRNG_TP || '',
            INSTL_TP: detail.INSTL_TP || '',
            CB_WRNG_TP: detail.CB_WRNG_TP || '',
            CB_INSTL_TP: detail.CB_INSTL_TP || '',
            INOUT_LINE_TP: detail.INOUT_LINE_TP || '',
            INOUT_LEN: detail.INOUT_LEN || '',
            DVDR_YN: detail.DVDR_YN || '',
            BFR_LINE_YN: detail.BFR_LINE_YN || '',
            CUT_YN: detail.CUT_YN || '',
            TERM_NO: detail.TERM_NO || '',
            RCV_STS: detail.RCV_STS || '',
            SUBTAP_ID: detail.SUBTAP_ID || '',
            PORT_NUM: detail.PORT_NUM || '',
            EXTN_TP: detail.EXTN_TP || '',
            TAB_LBL: detail.TAB_LBL || '',
            CVT_LBL: detail.CVT_LBL || '',
            STB_LBL: detail.STB_LBL || '',
          });
        }
      } catch (error) {
        console.error('[WorkCompleteTerminate] 작업 상세 조회 실패:', error);
      }

      // 진행 중인 작업이면 localStorage에서 사용자 입력값 복원
      if (!isWorkCompleted) {
        const savedDraft = localStorage.getItem(getStorageKey());
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            setCustRel(draftData.custRel || '');
            setMemo(draftData.memo || '');
            // 사용자가 철거정보를 수정했으면 그 값 사용
            if (draftData.installInfoData) {
              setNetworkType(draftData.networkType || '');
              setNetworkTypeName(draftData.networkTypeName || '');
              setInstallInfoData(draftData.installInfoData);
            }
          } catch (error) {
            console.error('[WorkCompleteTerminate] localStorage 복원 실패:', error);
          }
        }
      }

      setIsDataLoaded(true);
    };

    fetchWorkDetail();
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;
    const draftData = {
      custRel, memo, networkType, networkTypeName, installInfoData,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, networkType, networkTypeName, installInfoData, isDataLoaded, isWorkCompleted]);

  // 공통코드 로드
  useEffect(() => {
    const loadCodes = async () => {
      try {
        const codes = await getCommonCodeList(['CMCU005']);
        if (codes['CMCU005']) {
          setCustRelOptions(codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD,
            label: code.COMMON_CD_NM
          })));
        }
      } catch (error) {
        console.error('[WorkCompleteTerminate] 공통코드 로드 실패:', error);
      }
    };
    loadCodes();
  }, []);

  // 검증
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!custRel) errors.push('고객과의 관계를 선택해주세요.');
    // 철거정보 필수 (레거시: 망구분, 배선유형, 설치유형=77)
    if (!installInfoData?.NET_CL) {
      errors.push('철거정보를 입력해주세요. (망구분 필수)');
    }
    // 핫빌 확인 필수 (WRK_CD=02 && WRK_STAT_CD !== '7' 일 때)
    if (order.WRK_CD === '02' && wrkStatCd !== '7' && !isHotbillConfirmed) {
      errors.push('핫빌 확인이 필요합니다.');
    }
    return errors;
  };

  // 설치정보 모달 핸들러
  const handleInstallInfoSave = (data: InstallInfoData) => {
    setInstallInfoData(data);
    if (data.NET_CL) setNetworkType(data.NET_CL);
    if (data.NET_CL_NM) setNetworkTypeName(data.NET_CL_NM);
    showToast?.('철거 정보가 저장되었습니다.', 'success');
  };

  // 장비철거 버튼 클릭 (레거시: btn_eqt_rmv)
  const handleEquipmentRemoval = () => {
    // 레거시: fn_save() 호출하되 EQT_RMV_FLAG = 'Y' 설정
    handleSubmit(true);
  };

  // 작업완료 처리 - 확인 모달 표시
  const handleSubmit = (isEquipmentRemoval = false) => {
    if (isLoading) return;

    // 방송상품 작업완료 불가 체크 (레거시: mowoa03m02 btn_save_OnClick)
    // KPI_PROD_GRP_CD가 'C'(케이블) 또는 'D'(DTV)인 경우 작업완료 불가
    const kpiProdGrp = (order as any).KPI_PROD_GRP_CD || '';
    if (kpiProdGrp === 'C' || kpiProdGrp === 'D') {
      showToast?.('방송 상품은 작업완료 처리하실 수 없습니다.', 'error');
      return;
    }

    const errors = validate();
    if (errors.length > 0) {
      errors.forEach(error => showToast?.(error, 'error'));
      return;
    }

    // 해지희망일 이전 작업완료 경고
    const hopeDt = (order as any).TERM_HOPE_DT || (order as any).HOPE_DT || '';
    if (hopeDt && workCompleteDate) {
      const hopeDateStr = hopeDt.replace(/-/g, '');
      const completeDateStr = workCompleteDate.replace(/-/g, '');
      if (completeDateStr < hopeDateStr) {
        showToast?.('해지희망일 이전에 작업완료입니다.', 'warning');
      }
    }

    const message = isEquipmentRemoval
      ? '장비철거를 진행하시겠습니까?'
      : '작업을 완료하시겠습니까?';

    setConfirmMessage(message);
    setPendingIsEquipmentRemoval(isEquipmentRemoval);
    setShowConfirmModal(true);
  };

  // 인입선로 철거관리 필요 여부 체크 (레거시: mowoa03m02)
  // KPI_PROD_GRP_CD in (C, D, I) AND VOIP_CTX != 'T' AND != 'R'
  const needsRemovalLineManagement = () => {
    const kpiProdGrpCd = (order as any).KPI_PROD_GRP_CD || '';
    const voipCtx = (order as any).VOIP_CTX || '';
    return ['C', 'D', 'I'].includes(kpiProdGrpCd)
      && voipCtx !== 'T'
      && voipCtx !== 'R';
  };

  // 인입선로 철거관리 - 완료(완전철거) 핸들러
  const handleRemovalLineComplete = async (data: RemovalLineData) => {
    console.log('[WorkCompleteTerminate] 인입선로 철거관리 완료(완전철거):', data);
    setRemovalLineData(data);

    // 인입선로 철거상태 저장 (레거시: fn_insertWrkRemoveStat)
    try {
      const result = await insertWorkRemoveStat({
        WRK_ID: order.id || (order as any).WRK_ID || '',
        REMOVE_LINE_TP: data.REMOVE_LINE_TP || '',
        REMOVE_GB: data.REMOVE_GB || '4',  // 완전철거
        REMOVE_STAT: data.REMOVE_STAT || '',
        REG_UID: 'A20130708',
      });

      if (result.code === 'SUCCESS' || result.code === 'OK') {
        showToast?.('인입선로 철거상태가 저장되었습니다.', 'success');
      } else {
        showToast?.(result.message || '인입선로 철거상태 저장에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      showToast?.(error.message || '인입선로 철거상태 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 인입선로 미철거 - AS할당 핸들러
  const handleRemovalLineAssignAS = (data: RemovalLineData) => {
    console.log('[WorkCompleteTerminate] 인입선로 미철거 - AS할당 모달 열기:', data);
    setRemovalLineData(data);
    setShowASAssignModal(true);
  };

  // AS할당 저장 핸들러
  const handleASAssignSave = async (asData: ASAssignData) => {
    console.log('[WorkCompleteTerminate] AS할당 저장:', asData);
    setIsASProcessing(true);

    try {
      // 1. 인입선로 철거상태 저장 (미철거)
      const removeStatResult = await insertWorkRemoveStat({
        WRK_ID: order.id || (order as any).WRK_ID || '',
        REMOVE_LINE_TP: removalLineData?.REMOVE_LINE_TP || '',
        REMOVE_GB: removalLineData?.REMOVE_GB || '1',  // 미철거
        REMOVE_STAT: removalLineData?.REMOVE_STAT || '',
        REG_UID: 'A20130708',
      });

      if (removeStatResult.code !== 'SUCCESS' && removeStatResult.code !== 'OK') {
        throw new Error(removeStatResult.message || '인입선로 철거상태 저장에 실패했습니다.');
      }

      // 2. AS 접수 생성
      const asResult = await modAsPdaReceipt({
        CUST_ID: order.customer?.id || '',
        CTRT_ID: order.CTRT_ID || '',
        ADDR_ORD: order.customer?.ADDR_ORD || '',
        AS_TP: asData.AS_TP || '03',  // AS유형
        AS_CL: asData.AS_CL || '',     // AS분류
        AS_RSN: asData.AS_RSN || '',   // AS사유
        MEMO: asData.MEMO || '',
        HOPE_DT: asData.HOPE_DT || '',
        HOPE_TM_CL: asData.HOPE_TM_CL || '',
        REG_UID: 'A20130708',
      });

      if (asResult.code === 'SUCCESS' || asResult.code === 'OK') {
        showToast?.('인입선로 미철거 AS할당이 완료되었습니다.', 'success');
        setShowASAssignModal(false);
      } else {
        showToast?.(asResult.message || 'AS 접수 생성에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      showToast?.(error.message || 'AS할당 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsASProcessing(false);
    }
  };

  // 실제 작업 완료 처리
  const handleConfirmSubmit = () => {
    const formattedDate = workCompleteDate.replace(/-/g, '');
    const workerId = 'A20130708';

    const completeData: WorkCompleteData = {
      workInfo: {
        WRK_ID: order.id,
        WRK_CD: order.WRK_CD,
        WRK_DTL_TCD: order.WRK_DTL_TCD,
        CUST_ID: order.customer?.id,
        RCPT_ID: order.RCPT_ID,
        CRR_ID: '01',
        WRKR_ID: workerId,
        WRKR_CMPL_DT: formattedDate,
        MEMO: memo || '작업 완료',
        STTL_YN: 'Y',
        REG_UID: workerId,
        CUST_REL: custRel,
        CNFM_CUST_NM: order.customer?.name,
        CNFM_CUST_TELNO: order.customer?.contactNumber || '',
        WRK_ACT_CL: '20',
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '',
        // 장비철거 플래그 (레거시: EQT_RMV_FLAG)
        EQT_RMV_FLAG: pendingIsEquipmentRemoval ? 'Y' : '',
      },
      equipmentList: [],
      removeEquipmentList: equipmentData?.removedEquipments || [],
      spendItemList: equipmentData?.spendItems || [],
      agreementList: equipmentData?.agreements || [],
      poleList: equipmentData?.poleResults || []
    };

    submitWork(completeData, {
      onSuccess: (result) => {
        if (result.code === 'SUCCESS' || result.code === 'OK') {
          localStorage.removeItem(getStorageKey());
          showToast?.('작업이 성공적으로 완료되었습니다.', 'success');

          onSuccess();
        } else {
          showToast?.(result.message || '작업 완료 처리에 실패했습니다.', 'error');
        }
      },
      onError: (error: any) => {
        showToast?.(error.message || '작업 완료 중 오류가 발생했습니다.', 'error');
      },
    });
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 bg-gray-50 overflow-x-hidden relative">
      {/* 핫빌 계산 중 전체 화면 스피너 */}
      {isHotbillSimulating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-4 shadow-xl">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-700 font-medium">핫빌 계산 중...</p>
            <p className="text-gray-500 text-sm">잠시만 기다려주세요</p>
          </div>
        </div>
      )}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <div className="space-y-3 sm:space-y-5">
            {/* 계약정보 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                계약정보
              </label>
              <input
                type="text"
                value={order.customer?.name || ''}
                readOnly
                disabled
                className="w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* 망구분 + 철거정보 버튼 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                망구분
              </label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={networkTypeName || ''}
                  readOnly
                  disabled
                  placeholder="철거정보에서 입력"
                  className="flex-1 min-w-0 min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed truncate"
                />
                <button
                  type="button"
                  onClick={() => setShowInstallInfoModal(true)}
                  className={`min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                    isWorkCompleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {isWorkCompleted ? '보기' : '철거정보'}
                </button>
              </div>
            </div>

            {/* 고객관계 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                고객관계 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <Select
                value={custRel}
                onValueChange={setCustRel}
                options={custRelOptions}
                placeholder="고객관계 선택"
                required
                disabled={isWorkCompleted}
              />
            </div>

            {/* 처리내용 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                처리내용
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="작업 내용을 입력하세요..."
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base resize-none ${
                  isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
                rows={4}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
            </div>

            {/* 작업처리일 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                작업처리일 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={workCompleteDate}
                readOnly
                disabled
                className="w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* 해지요금 (토글 섹션) */}
            <HotbillSection
              custId={order.customer?.id || ''}
              rcptId={order.RCPT_ID || ''}
              ctrtId={order.CTRT_ID || ''}
              soId={order.SO_ID || ''}
              termHopeDt={(order as any).TERM_HOPE_DT || (order as any).HOPE_DT || ''}
              wrkCd={order.WRK_CD || '02'}
              wrkStatCd={wrkStatCd}
              showToast={showToast}
              onHotbillConfirmChange={setIsHotbillConfirmed}
              onSimulatingChange={setIsHotbillSimulating}
            />

            {/* 인입선로 철거관리 (토글 섹션) - 조건: KPI_PROD_GRP_CD in C,D,I */}
            {needsRemovalLineManagement() && (
              <RemovalLineSection
                onComplete={handleRemovalLineComplete}
                onAssignAS={handleRemovalLineAssignAS}
                showToast={showToast}
                disabled={isWorkCompleted}
              />
            )}

            {/* 하단 버튼 영역 */}
            <div className="flex gap-1.5 sm:gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-gray-200">
              {/* 장비철거 버튼 (레거시: btn_eqt_rmv) */}
              {!isWorkCompleted && showEquipmentRemovalButton && (
                <button
                  onClick={() => handleEquipmentRemoval()}
                  disabled={isLoading || !isEquipmentRemovalEnabled}
                  className={`flex-1 btn btn-lg flex items-center justify-center gap-2 ${
                    isEquipmentRemovalEnabled
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>장비철거</span>
                </button>
              )}

              {/* 작업완료 버튼 (레거시: btn_save) */}
              {!isWorkCompleted && showSaveButton && (
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isLoading || !isSaveButtonEnabled}
                  className={`flex-1 btn btn-lg flex items-center justify-center gap-2 ${
                    isSaveButtonEnabled
                      ? 'btn-primary'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>처리 중...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>작업 완료</span>
                    </>
                  )}
                </button>
              )}

              {/* 연동이력 버튼 */}
              <button
                onClick={() => setShowIntegrationHistoryModal(true)}
                className="flex-1 btn btn-lg flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white"
              >
                <History className="w-5 h-5" />
                <span>연동이력</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 설치정보 모달 (철거정보로 사용) */}
      <InstallInfoModal
        isOpen={showInstallInfoModal}
        onClose={() => setShowInstallInfoModal(false)}
        onSave={handleInstallInfoSave}
        workId={order.id}
        initialData={installInfoData}
        workType={order.WRK_CD}
        customerId={order.customer?.id}
        customerName={order.customer?.name}
        contractId={order.CTRT_ID}
        kpiProdGrpCd={(order as any).KPI_PROD_GRP_CD || ''}
        wrkDtlTcd={order.WRK_DTL_TCD || ''}
        prodGrp={(order as any).PROD_GRP || ''}
        readOnly={isWorkCompleted}
      />

      {/* 인입선로미철거 AS할당 모달 (레거시 mowoa03p06) */}
      <RemovalASAssignModal
        isOpen={showASAssignModal}
        onClose={() => setShowASAssignModal(false)}
        onSave={handleASAssignSave}
        removalLineData={removalLineData}
        custId={order.customer?.id || ''}
        custNm={order.customer?.name || ''}
        addrOrd={order.customer?.ADDR_ORD || ''}
        address={order.address || ''}
        showToast={showToast}
      />

      {/* 작업완료 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title={pendingIsEquipmentRemoval ? '장비 철거' : '작업 완료'}
        message={confirmMessage}
        type="confirm"
        confirmText={pendingIsEquipmentRemoval ? '철거' : '완료'}
        cancelText="취소"
      />

      {/* 연동이력 모달 */}
      <IntegrationHistoryModal
        isOpen={showIntegrationHistoryModal}
        onClose={() => setShowIntegrationHistoryModal(false)}
        ctrtId={order.CTRT_ID}
        prodCmpsId={(order as any).BASIC_PROD_CMPS_ID || (order as any).PROD_CMPS_ID}
      />
    </div>
  );
};

export default CompleteTerminate;
