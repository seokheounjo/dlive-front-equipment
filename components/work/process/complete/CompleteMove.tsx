/**
 * CompleteMove.tsx
 * WRK_CD=04 (정지) 작업완료 페이지
 *
 * 레거시 참조: mowoa03m04.xml - 작업완료(정지)
 * 특징:
 * - 이용정지기간 버튼 (btn_mmt_sus_dd)
 * - 설치정보 입력 필수
 * - WRK_DTL_TCD=0440 (일시철거복구) 시 장비추가 가능
 */
import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail, getCustomerContractInfo } from '../../../../services/apiService';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import InstallLocationModal, { InstallLocationData } from '../../../modal/InstallLocationModal';
import ConfirmModal from '../../../common/ConfirmModal';
import SuspensionPeriodModal from '../../../modal/SuspensionPeriodModal';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import '../../../../styles/buttons.css';

interface CompleteMoveProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteMove: React.FC<CompleteMoveProps> = ({
  order,
  onBack,
  onSuccess,
  showToast,
  equipmentData: legacyEquipmentData,
  readOnly = false
}) => {
  const isWorkCompleted = readOnly
    || order.WRK_STAT_CD === '3'
    || order.WRK_STAT_CD === '4'
    || order.WRK_STAT_CD === '7'
    || order.status === '완료'
    || order.status === '취소';

  // 일시철거복구 여부 (레거시: WRK_DTL_TCD == "0440")
  const isTempRemovalRecovery = order.WRK_DTL_TCD === '0440';
  // 단순이전 여부 (레거시: WRK_DTL_TCD == "0430")
  const isSimpleRelocation = order.WRK_DTL_TCD === '0430';

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const { equipmentData: storeEquipmentData, filteringData } = useWorkProcessStore();
  const equipmentData = storeEquipmentData || legacyEquipmentData || filteringData;
  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 폼 상태
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');
  const [internetUse, setInternetUse] = useState('');
  const [voipUse, setVoipUse] = useState('');
  const [dtvUse, setDtvUse] = useState('');

  // 타사이용여부 접기/펼치기 상태
  const [isServiceUseExpanded, setIsServiceUseExpanded] = useState(false);

  // 결합계약 선택 (VoIP/ISP)
  const [voipJoinCtrtId, setVoipJoinCtrtId] = useState('');
  const [joinCtrtOptions, setJoinCtrtOptions] = useState<{ value: string; label: string }[]>([]);
  const [showJoinCtrt, setShowJoinCtrt] = useState(false);
  const [customerCtrtList, setCustomerCtrtList] = useState<any[]>([]);

  // 모달
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState((order as any).NET_CL || '');
  const [networkTypeName, setNetworkTypeName] = useState((order as any).NET_CL_NM || '');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(() => {
    // 정지작업은 기존 계약 정보가 있으므로 order에서 초기값 설정
    if ((order as any).NET_CL) {
      return {
        NET_CL: (order as any).NET_CL || '',
        NET_CL_NM: (order as any).NET_CL_NM || '',
        WRNG_TP: (order as any).WRNG_TP || '',
        INSTL_TP: (order as any).INSTL_TP || '',
        CB_WRNG_TP: (order as any).CB_WRNG_TP || '',
        CB_INSTL_TP: (order as any).CB_INSTL_TP || '',
        INOUT_LINE_TP: (order as any).INOUT_LINE_TP || '',
        INOUT_LEN: (order as any).INOUT_LEN || '',
        DVDR_YN: (order as any).DVDR_YN || '',
        BFR_LINE_YN: (order as any).BFR_LINE_YN || '',
        CUT_YN: (order as any).CUT_YN || '',
        TERM_NO: (order as any).TERM_NO || '',
        RCV_STS: (order as any).RCV_STS || '',
        SUBTAP_ID: (order as any).SUBTAP_ID || '',
        PORT_NUM: (order as any).PORT_NUM || '',
        EXTN_TP: (order as any).EXTN_TP || '',
        TAB_LBL: (order as any).TAB_LBL || '',
        CVT_LBL: (order as any).CVT_LBL || '',
        STB_LBL: (order as any).STB_LBL || '',
      };
    }
    return undefined;
  });
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);
  const [showInstallLocationModal, setShowInstallLocationModal] = useState(false);
  const [installLocationText, setInstallLocationText] = useState('');
  const [viewModCd, setViewModCd] = useState('');
  const [viewModNm, setViewModNm] = useState('');

  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // 정지기간 모달
  const [showSuspensionPeriodModal, setShowSuspensionPeriodModal] = useState(false);

  // 공통코드
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);
  const [internetOptions, setInternetOptions] = useState<{ value: string; label: string }[]>([]);
  const [voipOptions, setVoipOptions] = useState<{ value: string; label: string }[]>([]);
  const [dtvOptions, setDtvOptions] = useState<{ value: string; label: string }[]>([]);

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

  // 데이터 복원 - 정지작업은 기존 설치정보가 있으므로 API에서 가져옴
  useEffect(() => {
    const fetchWorkDetail = async () => {
      try {
        console.log('[WorkCompleteMove] 작업 상세 조회 시작');
        const detail = await getWorkReceiptDetail({
          WRK_DRCTN_ID: order.directionId || order.id,
          WRK_ID: (order as any).WRK_ID,
          SO_ID: order.SO_ID
        });

        if (detail) {
          console.log('[WorkCompleteMove] 작업 상세 조회 성공:', { NET_CL: detail.NET_CL, NET_CL_NM: detail.NET_CL_NM });

          // 완료된 작업이면 모든 값 복원
          if (isWorkCompleted) {
            setMemo((detail.MEMO || '').replace(/\\n/g, '\n'));
            setInternetUse(detail.PSN_USE_CORP || '');
            setVoipUse(detail.VOIP_USE_CORP || '');
            setDtvUse(detail.DTV_USE_CORP || '');
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          }

          // 설치정보는 항상 API에서 가져옴 (기존 계약 정보)
          setNetworkType(detail.NET_CL || '');
          setNetworkTypeName(detail.NET_CL_NM || '');
          setInstallLocationText(prev => prev || detail.INSTL_LOC || '');
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
        console.error('[WorkCompleteMove] 작업 상세 조회 실패:', error);
      }

      // 진행 중인 작업이면 localStorage에서 사용자 입력값 복원
      if (!isWorkCompleted) {
        const savedDraft = localStorage.getItem(getStorageKey());
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            setCustRel(draftData.custRel || '');
            setMemo(draftData.memo || '');
            // 사용자가 설치정보를 수정했으면 그 값 사용
            if (draftData.installInfoData) {
              setNetworkType(draftData.networkType || '');
              setNetworkTypeName(draftData.networkTypeName || '');
              setInstallLocationText(draftData.installLocationText || '');
              setInstallInfoData(draftData.installInfoData);
            }
          } catch (error) {
            console.error('[WorkCompleteMove] localStorage 복원 실패:', error);
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
      custRel, memo, internetUse, voipUse, dtvUse,
      networkType, networkTypeName, installLocationText, installInfoData,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, internetUse, voipUse, dtvUse,
      networkType, networkTypeName, installLocationText, installInfoData, isDataLoaded, isWorkCompleted]);

  // 공통코드 로드
  useEffect(() => {
    const loadCodes = async () => {
      try {
        const codes = await getCommonCodeList([
          'CMCU005', 'CMCU057', 'CMCU110', 'CMCU148'
        ]);

        if (codes['CMCU005']) {
          setCustRelOptions(codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
        if (codes['CMCU057']) {
          setInternetOptions(codes['CMCU057'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
        if (codes['CMCU110']) {
          setVoipOptions(codes['CMCU110'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
        if (codes['CMCU148']) {
          setDtvOptions(codes['CMCU148'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
      } catch (error) {
        console.error('[WorkCompleteMove] 공통코드 로드 실패:', error);
      }
    };
    loadCodes();
  }, []);

  // 고객 계약 목록 로드 (결합계약 선택용)
  useEffect(() => {
    if (isWorkCompleted) return;

    const custId = order.customer?.id || (order as any).CUST_ID;
    if (!custId) return;

    const loadCustomerContracts = async () => {
      try {
        console.log('[WorkCompleteMove] 고객 계약 목록 조회 시작:', custId);
        const contracts = await getCustomerContractInfo({ CUST_ID: custId });
        console.log('[WorkCompleteMove] 고객 계약 목록:', contracts);
        setCustomerCtrtList(contracts || []);
      } catch (error) {
        console.error('[WorkCompleteMove] 고객 계약 목록 조회 실패:', error);
        setCustomerCtrtList([]);
      }
    };

    loadCustomerContracts();
  }, [order.customer?.id, (order as any).CUST_ID, isWorkCompleted]);

  // VoIP/ISP 결합 계약 처리
  useEffect(() => {
    if (isWorkCompleted) return;
    if (customerCtrtList.length === 0) {
      console.log('[WorkCompleteMove] 고객 계약 목록 대기 중...');
      return;
    }

    const prodGrp = (order as any).PROD_GRP || '';
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';
    const wrkStatCd = order.WRK_STAT_CD || '';
    const addrOrd = (order as any).ADDR_ORD || '';

    console.log('[WorkCompleteMove] 결합계약 필터링 시작:', {
      prodGrp, voipProdCd, ispProdCd, wrkStatCd, addrOrd,
      customerCtrtListCount: customerCtrtList.length
    });

    if (prodGrp === 'V' && !voipProdCd) {
      const filteredContracts = customerCtrtList.filter((ctrt: any) => {
        const ctrtProdGrp = ctrt.PROD_GRP || '';
        const ctrtStat = ctrt.CTRT_STAT || '';
        const ctrtAddrOrd = ctrt.ADDR_ORD || ctrt.addr_ord || '';
        return (ctrtProdGrp === 'C' || ctrtProdGrp === 'D' || ctrtProdGrp === 'I')
          && ctrtStat === '20'
          && (!addrOrd || ctrtAddrOrd === addrOrd);
      });

      console.log('[WorkCompleteMove] VoIP 결합계약 필터링 결과:', filteredContracts);

      if (filteredContracts.length < 1 && wrkStatCd === '2') {
        showToast?.('VOIP와 결합될 DTV, ISP 계약이 없습니다. ISP나 DTV 설치완료 후 작업하여 주십시오.', 'warning');
      }

      const options = [
        { value: '', label: '선택' },
        ...filteredContracts.map((ctrt: any) => ({
          value: ctrt.CTRT_ID || '',
          label: `[${ctrt.CTRT_ID}] ${ctrt.BASIC_PROD_CD_NM || ctrt.PROD_NM || ''}`
        }))
      ];
      setJoinCtrtOptions(options);
      setShowJoinCtrt(true);
      return;
    }

    if (prodGrp === 'I' && ispProdCd) {
      const filteredContracts = customerCtrtList.filter((ctrt: any) => {
        const ctrtProdGrp = ctrt.PROD_GRP || '';
        const ctrtStat = ctrt.CTRT_STAT || '';
        const ctrtAddrOrd = ctrt.ADDR_ORD || ctrt.addr_ord || '';
        const ispJoinId = ctrt.ISP_JOIN_ID || '';
        const kpiProdGrpCd = ctrt.KPI_PROD_GRP_CD || '';
        return (ctrtProdGrp === 'D' || ctrtProdGrp === 'C')
          && ctrtStat === '20'
          && !ispJoinId
          && kpiProdGrpCd === 'D'
          && (!addrOrd || ctrtAddrOrd === addrOrd);
      });

      console.log('[WorkCompleteMove] ISP 결합계약 필터링 결과:', filteredContracts);

      if (filteredContracts.length < 1 && wrkStatCd === '2') {
        showToast?.('ISP와 결합될 DTV 계약이 없습니다. DTV 설치완료 후 작업하여 주십시오.', 'warning');
      }

      const options = [
        { value: '', label: '선택' },
        ...filteredContracts.map((ctrt: any) => ({
          value: ctrt.CTRT_ID || '',
          label: `[${ctrt.CTRT_ID}] ${ctrt.BASIC_PROD_CD_NM || ctrt.PROD_NM || ''}`
        }))
      ];
      setJoinCtrtOptions(options);
      setShowJoinCtrt(true);
      return;
    }

    setShowJoinCtrt(false);
    setJoinCtrtOptions([]);
  }, [order.id, order.WRK_STAT_CD, isWorkCompleted, showToast, customerCtrtList]);

  // 검증
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!custRel) errors.push('고객과의 관계를 선택해주세요.');
    if (!installInfoData?.NET_CL) errors.push('설치정보를 입력해주세요.');
    // 정지작업(04)은 설치위치 체크 제외
    if (order.WRK_CD !== '04' && !installLocationText && !order.installLocation) errors.push('설치위치를 설정해주세요.');

    // WRK_DTL_TCD=0430 (단순이전) 시 모든 장비 철거 체크
    if (order.WRK_DTL_TCD === '0430') {
      const installedCount = equipmentData?.installedEquipments?.length || 0;
      if (installedCount > 0) {
        errors.push('모든 장비를 철거해주세요.');
      }
    }

    // VoIP/ISP 결합계약 선택 validation
    const prodGrp = (order as any).PROD_GRP || '';
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';

    if (prodGrp === 'V' && !voipProdCd && showJoinCtrt) {
      if (!voipJoinCtrtId) {
        errors.push('VOIP의 결합할 계약을 선택하여 주십시오.');
      }
    }
    if (prodGrp === 'I' && ispProdCd && showJoinCtrt) {
      if (!voipJoinCtrtId) {
        errors.push('결합이 필요한 ISP 상품입니다. 결합할 계약을 선택하여 주십시오.');
      }
    }

    return errors;
  };

  const handleInstallInfoSave = (data: InstallInfoData) => {
    setInstallInfoData(data);
    if (data.NET_CL) setNetworkType(data.NET_CL);
    if (data.NET_CL_NM) setNetworkTypeName(data.NET_CL_NM);
    showToast?.('설치 정보가 저장되었습니다.', 'success');
  };

  // 작업 완료 처리 - 확인 모달 표시
  const handleSubmit = () => {
    if (isLoading) return;

    const errors = validate();
    if (errors.length > 0) {
      errors.forEach(error => showToast?.(error, 'error'));
      return;
    }

    setShowConfirmModal(true);
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
        INSTL_LOC: installLocationText || order.installLocation || '',
        PSN_USE_CORP: internetUse || '',
        VOIP_USE_CORP: voipUse || '',
        DTV_USE_CORP: dtvUse || '',
        WRK_ACT_CL: '20',
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '',
        VOIP_JOIN_CTRT_ID: voipJoinCtrtId || '',
      },
      equipmentList: equipmentData?.installedEquipments || [],
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
    <div className="px-2 sm:px-4 py-4 sm:py-6 bg-gray-50 overflow-x-hidden">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <div className="space-y-3 sm:space-y-5">
            {/* 일시철거복구 안내 */}
            {isTempRemovalRecovery && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium">
                  일시철거복구 작업입니다. 장비 추가가 가능합니다.
                </p>
              </div>
            )}


            {/* 결합계약 */}
            {showJoinCtrt && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                  결합계약 {!isWorkCompleted && <span className="text-red-500">*</span>}
                </label>
                <Select
                  value={voipJoinCtrtId}
                  onValueChange={setVoipJoinCtrtId}
                  options={joinCtrtOptions}
                  placeholder="결합계약 선택"
                  required
                  disabled={isWorkCompleted}
                />
              </div>
            )}

            {/* 망구분 + 설치정보 버튼 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">망구분</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={networkTypeName || ''}
                  readOnly disabled
                  placeholder="설치정보에서 입력"
                  className="flex-1 min-h-10 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowInstallInfoModal(true)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg ${isWorkCompleted ? 'bg-gray-500 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '설치정보'}
                </button>
              </div>
            </div>

            {/* 고객관계 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                고객관계 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <Select value={custRel} onValueChange={setCustRel} options={custRelOptions}
                placeholder="고객관계 선택" required disabled={isWorkCompleted} />
            </div>

            {/* 설치위치 - 정지작업(04)에서는 숨김 */}
            {order.WRK_CD !== '04' && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                  설치위치 {!isWorkCompleted && <span className="text-red-500">*</span>}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center min-h-10 px-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm">
                    <span className="truncate">{installLocationText || order.installLocation || '미설정'}</span>
                    {viewModNm && <span className="ml-2 text-xs text-gray-500 flex-shrink-0 whitespace-nowrap">(시청: {viewModNm})</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInstallLocationModal(true)}
                    className={`min-h-10 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${isWorkCompleted ? 'bg-gray-500 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                  >
                    {isWorkCompleted ? '보기' : '설정'}
                  </button>
                </div>
              </div>
            )}

            {/* 처리내용 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">처리내용</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="작업 내용을 입력하세요..."
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base resize-none ${isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                rows={3}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
            </div>

            {/* 작업처리일 + 이용정지기간 버튼 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">작업처리일 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workCompleteDate}
                  readOnly disabled
                  className="flex-1 min-w-0 min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-500 cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowSuspensionPeriodModal(true)}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold text-sm whitespace-nowrap"
                >
                  정지기간
                </button>
              </div>
            </div>

            {/* 하단 버튼 영역 */}
            <div className="flex gap-1.5 sm:gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-gray-200">
              {/* 연동이력 버튼 */}
              <button
                type="button"
                onClick={() => setShowIntegrationHistoryModal(true)}
                className="flex-1 min-h-10 sm:min-h-12 px-3 sm:px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>연동이력</span>
              </button>
              {/* 작업완료 버튼 */}
              {!isWorkCompleted && (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 btn btn-lg btn-primary flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
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
            </div>

          </div>
        </div>
      </div>

      {/* 모달들 */}
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
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD || order.KPI_PROD_GRP_CD}
        prodChgGb={equipmentData?.prodChgGb || equipmentData?.PROD_CHG_GB || (order as any).PROD_CHG_GB}
        chgKpiProdGrpCd={equipmentData?.chgKpiProdGrpCd || equipmentData?.CHG_KPI_PROD_GRP_CD || (order as any).CHG_KPI_PROD_GRP_CD}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP || (order as any).PROD_GRP}
        wrkDtlTcd={order.WRK_DTL_TCD}
        readOnly={isWorkCompleted}
      />

      <IntegrationHistoryModal
        isOpen={showIntegrationHistoryModal}
        onClose={() => setShowIntegrationHistoryModal(false)}
        ctrtId={order.CTRT_ID}
        custId={order.customer?.id}
      />

      <InstallLocationModal
        isOpen={showInstallLocationModal}
        onClose={() => setShowInstallLocationModal(false)}
        onSave={(data: InstallLocationData) => {
          setInstallLocationText(data.INSTL_LOC);
          setViewModCd(data.VIEW_MOD_CD);
          setViewModNm(data.VIEW_MOD_NM);
          setShowInstallLocationModal(false);
        }}
        workId={order.id}
        ctrtId={order.CTRT_ID}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP}
        initialInstlLoc={installLocationText || order.installLocation}
        initialViewModCd={viewModCd}
        initialViewModNm={viewModNm}
        showToast={showToast}
        readOnly={isWorkCompleted}
      />

      {/* 작업완료 확인 모달 */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="작업 완료"
        message="작업을 완료하시겠습니까?"
        type="confirm"
        confirmText="완료"
        cancelText="취소"
      />

      {/* 정지기간 모달 */}
      <SuspensionPeriodModal
        isOpen={showSuspensionPeriodModal}
        onClose={() => setShowSuspensionPeriodModal(false)}
        rcptId={order.RCPT_ID || ''}
        ctrtId={order.CTRT_ID || ''}
        userId="A20130708"
        showToast={showToast}
      />
    </div>
  );
};

export default CompleteMove;
