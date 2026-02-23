/**
 * CompleteChange.tsx
 * WRK_CD=05 (상품변경) 작업완료 페이지
 *
 * 레거시 참조: mowoa03m05.xml
 * 특징:
 * - 철거정보 버튼 (btn_remove_info) - WRK_DTL_TCD != 0510일 때만 활성화
 * - 설치정보 버튼 (btn_instl_info)
 * - 핫빌 버튼 (btn_hotbill)
 */
import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { isFtthProduct } from '../../../../utils/workValidation';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail, getCustomerContractInfo, sendSignal, getLghvProdMap, getCommonCodes, getOttSale, getProdPromotionInfo } from '../../../../services/apiService';
import { getCertifyCL08, getCertifyProdMap } from '../../../../services/certifyApiService';
import { executeCL04Registration, executeCL06ForChange } from '../../../../hooks/useCertifyComplete';
import { checkCertifySignalBlocked } from '../../../../hooks/useCertifySignal';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import InstallLocationModal, { InstallLocationData } from '../../../modal/InstallLocationModal';
import OttSerialModal from '../../../modal/OttSerialModal';
import PoleCheckModal from '../../../modal/PoleCheckModal';
import ConfirmModal from '../../../common/ConfirmModal';
import WorkCompleteSummary from '../WorkCompleteSummary';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useCertifyStore } from '../../../../stores/certifyStore';
import { useWorkEquipment } from '../../../../stores/workEquipmentStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import '../../../../styles/buttons.css';

interface CompleteChangeProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
  certifyMode?: boolean;    // LGU+ certify: forces certify path regardless of isFtthProduct
}

const CompleteChange: React.FC<CompleteChangeProps> = ({
  order,
  onBack,
  onSuccess,
  showToast,
  equipmentData: legacyEquipmentData,
  readOnly = false,
  certifyMode = false,
}) => {
  const isWorkCompleted = readOnly
    || order.WRK_STAT_CD === '3'
    || order.WRK_STAT_CD === '4'
    || order.WRK_STAT_CD === '7'
    || order.status === '완료'
    || order.status === '취소';

  // 철거정보 버튼 활성화 여부 (레거시: WRK_DTL_TCD != 0510)
  const showRemovalInfoButton = order.WRK_DTL_TCD !== '0510';

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const { equipmentData: storeEquipmentData, filteringData } = useWorkProcessStore();
  const { certifyRegconfInfo } = useCertifyStore();

  // Zustand Equipment Store - 장비 컴포넌트에서 등록한 장비 정보
  const workId = order.id || '';
  const zustandEquipment = useWorkEquipment(workId);

  // equipmentData 병합: Zustand Equipment Store 우선 사용
  const equipmentData = {
    ...(storeEquipmentData || legacyEquipmentData || filteringData || {}),
    installedEquipments: zustandEquipment.installedEquipments.length > 0
      ? zustandEquipment.installedEquipments
      : (storeEquipmentData?.installedEquipments || legacyEquipmentData?.installedEquipments || []),
    removedEquipments: zustandEquipment.markedForRemoval.length > 0
      ? zustandEquipment.markedForRemoval
      : (storeEquipmentData?.removedEquipments || legacyEquipmentData?.removedEquipments || []),
    removalStatus: Object.keys(zustandEquipment.removalStatus).length > 0
      ? zustandEquipment.removalStatus
      : (storeEquipmentData?.removalStatus || legacyEquipmentData?.removalStatus || {}),
  };

  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 폼 상태
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');
  const [internetUse, setInternetUse] = useState('');
  const [voipUse, setVoipUse] = useState('');
  const [dtvUse, setDtvUse] = useState('');
  const [upCtrlCl, setUpCtrlCl] = useState('');

  // 타사이용여부 접기/펼치기 상태
  const [isServiceUseExpanded, setIsServiceUseExpanded] = useState(false);

  // 결합계약 선택 (VoIP/ISP)
  const [voipJoinCtrtId, setVoipJoinCtrtId] = useState('');
  const [joinCtrtOptions, setJoinCtrtOptions] = useState<{ value: string; label: string }[]>([]);
  const [showJoinCtrt, setShowJoinCtrt] = useState(false);
  const [customerCtrtList, setCustomerCtrtList] = useState<any[]>([]);

  // 모달
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [showRemovalInfoModal, setShowRemovalInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [networkTypeName, setNetworkTypeName] = useState('');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);
  const [removalInfoData, setRemovalInfoData] = useState<InstallInfoData | undefined>(undefined);
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);
  const [showInstallLocationModal, setShowInstallLocationModal] = useState(false);
  const [installLocationText, setInstallLocationText] = useState('');
  const [viewModCd, setViewModCd] = useState('');
  const [viewModNm, setViewModNm] = useState('');

  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 전주승주 조사 (레거시: mowoa01p33.xml)
  const [showPoleCheckModal, setShowPoleCheckModal] = useState(false);
  const [poleCheckResult, setPoleCheckResult] = useState<{ POLE_YN: string; LAN_GB: string } | null>(null);

  // 공통코드
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);
  const [upCtrlClOptions, setUpCtrlClOptions] = useState<{ value: string; label: string }[]>([]);
  const [internetOptions, setInternetOptions] = useState<{ value: string; label: string }[]>([]);
  const [voipOptions, setVoipOptions] = useState<{ value: string; label: string }[]>([]);
  const [dtvOptions, setDtvOptions] = useState<{ value: string; label: string }[]>([]);

  // LGHV STB 판별용 상태
  const [isLghvStb, setIsLghvStb] = useState(false);
  const [lghvProdList, setLghvProdList] = useState<any[]>([]);

  // OTT 시리얼번호 입력 (레거시: mowoa03m05.xml OTT_EQT_INPUT, mowoDivE05 btn_ott_serno)
  const [showOttModal, setShowOttModal] = useState(false);
  const [ottEqtSerno, setOttEqtSerno] = useState('');
  const [isOttRequired, setIsOttRequired] = useState(false);
  const [ottDataType, setOttDataType] = useState<'B' | 'C'>('B');

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

  // 데이터 복원
  useEffect(() => {
    if (isWorkCompleted) {
      // API 호출하여 완료된 작업의 상세 데이터 가져오기 (레거시 패턴)
      const fetchCompletedWorkDetail = async () => {
        try {
          const detail = await getWorkReceiptDetail({
            WRK_DRCTN_ID: order.directionId || order.WRK_DRCTN_ID || '',
            WRK_ID: order.id,  // order.id가 실제 WRK_ID
            SO_ID: order.SO_ID
          });
          if (detail) {
            setCustRel(detail.CUST_REL || '');
            setMemo((detail.WRK_PROC_CT || '').replace(/\\n/g, '\n'));
            setInternetUse(detail.PSN_USE_CORP || '');
            setVoipUse(detail.VOIP_USE_CORP || '');
            setDtvUse(detail.DTV_USE_CORP || '');
            // 상향제어: API 응답에 없으면 장비 데이터(output1)에서 가져옴
            const upCtrlClValue = detail.UP_CTRL_CL || equipmentData?.upCtrlCl || '';
            console.log('[CompleteChange] 상향제어 값:', { API: detail.UP_CTRL_CL, 장비데이터: equipmentData?.upCtrlCl, 최종: upCtrlClValue });
            setUpCtrlCl(upCtrlClValue);
            setNetworkType(detail.NET_CL || '');
            setNetworkTypeName(detail.NET_CL_NM || '');
            setInstallLocationText(detail.INSTL_LOC || '');
            setInstallInfoData({
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

            // 시청모드 복원
            setViewModCd(detail.VIEW_MOD_CD || '');
            setViewModNm(detail.VIEW_MOD_NM || '');

            // 결합계약 ID 복원
            if (detail.VOIP_JOIN_CTRT_ID) {
              setVoipJoinCtrtId(detail.VOIP_JOIN_CTRT_ID);
            }

            // 작업처리일 복원
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          }
        } catch (error) {
          console.error('[WorkCompleteChange] 완료 작업 상세 조회 실패:', error);
        }
        setIsDataLoaded(true);
      };
      fetchCompletedWorkDetail();
      return;
    }

    const savedDraft = localStorage.getItem(getStorageKey());
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        setCustRel(draftData.custRel || '');
        setMemo(draftData.memo || '');
        setInternetUse(draftData.internetUse || '');
        setVoipUse(draftData.voipUse || '');
        setDtvUse(draftData.dtvUse || '');
        setUpCtrlCl(draftData.upCtrlCl || '');
        setNetworkType(draftData.networkType || '');
        setNetworkTypeName(draftData.networkTypeName || '');
        setInstallLocationText(draftData.installLocationText || '');
        setInstallInfoData(draftData.installInfoData);
        setRemovalInfoData(draftData.removalInfoData);
        // 시청모드 복원
        setViewModCd(draftData.viewModCd || '');
        setViewModNm(draftData.viewModNm || '');
        // 결합계약 ID 복원
        if (draftData.voipJoinCtrtId) setVoipJoinCtrtId(draftData.voipJoinCtrtId);
      } catch (error) {
        console.error('[WorkCompleteChange] localStorage 복원 실패:', error);
      }
    }
    setIsDataLoaded(true);
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;
    const draftData = {
      custRel, memo, internetUse, voipUse, dtvUse, upCtrlCl,
      networkType, networkTypeName, installLocationText, installInfoData, removalInfoData,
      viewModCd, viewModNm, voipJoinCtrtId,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, internetUse, voipUse, dtvUse, upCtrlCl,
      networkType, networkTypeName, installLocationText, installInfoData, removalInfoData, viewModCd, viewModNm, voipJoinCtrtId, isDataLoaded, isWorkCompleted]);

  // 공통코드 로드
  useEffect(() => {
    const loadCodes = async () => {
      try {
        const codes = await getCommonCodeList([
          'CMCU005', 'CMCT015', 'CMCU057', 'CMCU110', 'CMCU148'
        ]);

        if (codes['CMCU005']) {
          setCustRelOptions(codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
        if (codes['CMCT015']) {
          console.log('[CompleteChange] 공통코드 CMCT015 옵션:', codes['CMCT015']);
          setUpCtrlClOptions(codes['CMCT015'].map((code: CommonCode) => ({
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
        console.error('[WorkCompleteChange] 공통코드 로드 실패:', error);
      }
    };
    loadCodes();
  }, []);

  // LGHV STB 상품 조회 (레거시 fn_cm_shncEqt_Signal_VOIP)
  useEffect(() => {
    const fetchLghvProdMap = async () => {
      try {
        const prodList = await getLghvProdMap();
        setLghvProdList(prodList || []);
        console.log('[CompleteChange] LGHV 상품 목록:', prodList?.length);

        // 현재 계약의 PROD_CD가 LGHV 상품인지 확인
        const prodCd = (order as any).PROD_CD || (order as any).BASIC_PROD_CD || '';
        if (prodCd && prodList && prodList.length > 0) {
          const isLghv = prodList.some((p: any) => p.PROD_CD === prodCd);
          setIsLghvStb(isLghv);
          console.log('[CompleteChange] LGHV STB 여부:', isLghv, 'PROD_CD:', prodCd);
        }
      } catch (error) {
        console.error('[CompleteChange] LGHV 상품 목록 조회 실패:', error);
      }
    };
    fetchLghvProdMap();
  }, [order.id]);

  // OTT 상품 판단 및 기존 시리얼 조회 (레거시: mowoa03m05.xml OTT_EQT_INPUT)
  useEffect(() => {
    const checkOttProduct = async () => {
      const currentProdCd = order.PROD_CD || (order as any).PROD_CD || '';
      const prodPromoInfo = equipmentData?.prodPromoInfo || [];

      // OTT 판매/할당 상품 (PD10018480)
      if (currentProdCd === 'PD10018480') {
        console.log('[CompleteChange] OTT 판매용 상품 감지:', currentProdCd);
        setIsOttRequired(true);
        setOttDataType('C');
      }
      // 프로모션에 Netflix OTT STB (PD10018160) 포함
      else if (prodPromoInfo.some((item: any) => item.PROD_CD === 'PD10018160')) {
        console.log('[CompleteChange] OTT 프로모션 상품 감지: PD10018160');
        setIsOttRequired(true);
        setOttDataType('B');
      }
      else {
        setIsOttRequired(false);
        return;
      }

      // 기존 OTT 시리얼 조회
      const wrkId = order.id || '';
      const wrkDrctnId = order.directionId || order.WRK_DRCTN_ID || '';
      if (wrkId && wrkDrctnId) {
        try {
          const existingOtt = await getOttSale({
            WRK_ID: wrkId,
            WRK_DRCTN_ID: wrkDrctnId,
            DATA_TYPE: currentProdCd === 'PD10018480' ? 'C' : 'B',
          });
          if (existingOtt?.EQT_SERNO) {
            console.log('[CompleteChange] 기존 OTT 시리얼:', existingOtt.EQT_SERNO);
            setOttEqtSerno(existingOtt.EQT_SERNO);
          }
        } catch (error) {
          console.error('[CompleteChange] OTT 시리얼 조회 실패:', error);
        }
      }
    };

    checkOttProduct();
  }, [order.PROD_CD, order.id, order.directionId, equipmentData?.prodPromoInfo]);

  // 상향제어: equipmentData가 나중에 로드되면 업데이트, 없으면 기본값 '01'(쌍방향) 설정
  useEffect(() => {
    if (equipmentData?.upCtrlCl && !upCtrlCl) {
      console.log('[CompleteChange] equipmentData에서 상향제어 업데이트:', equipmentData.upCtrlCl);
      setUpCtrlCl(equipmentData.upCtrlCl);
    } else if (!upCtrlCl && isDataLoaded && !isWorkCompleted) {
      // 데이터 로드 완료 후에도 상향제어 값이 없으면 기본값 '01'(쌍방향) 설정
      console.log('[CompleteChange] 상향제어 기본값 설정: 01 (쌍방향)');
      setUpCtrlCl('01');
    }
  }, [equipmentData?.upCtrlCl, isDataLoaded, isWorkCompleted, upCtrlCl]);

  // 고객 계약 목록 로드 (결합계약 선택용)
  useEffect(() => {
    if (isWorkCompleted) return;

    const custId = order.customer?.id || (order as any).CUST_ID;
    if (!custId) return;

    const loadCustomerContracts = async () => {
      try {
        console.log('[WorkCompleteChange] 고객 계약 목록 조회 시작:', custId);
        const contracts = await getCustomerContractInfo({ CUST_ID: custId });
        console.log('[WorkCompleteChange] 고객 계약 목록:', contracts);
        setCustomerCtrtList(contracts || []);
      } catch (error) {
        console.error('[WorkCompleteChange] 고객 계약 목록 조회 실패:', error);
        setCustomerCtrtList([]);
      }
    };

    loadCustomerContracts();
  }, [order.customer?.id, (order as any).CUST_ID, isWorkCompleted]);

  // VoIP/ISP 결합 계약 처리
  useEffect(() => {
    if (isWorkCompleted) return;
    if (customerCtrtList.length === 0) {
      console.log('[WorkCompleteChange] 고객 계약 목록 대기 중...');
      return;
    }

    const prodGrp = (order as any).PROD_GRP || '';
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';
    const wrkStatCd = order.WRK_STAT_CD || '';
    const addrOrd = (order as any).ADDR_ORD || '';

    console.log('[WorkCompleteChange] 결합계약 필터링 시작:', {
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

      console.log('[WorkCompleteChange] VoIP 결합계약 필터링 결과:', filteredContracts);

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

      console.log('[WorkCompleteChange] ISP 결합계약 필터링 결과:', filteredContracts);

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

    // 작업자 필수 (레거시 line 1584)
    const wrkrId = (order as any).WRKR_ID || '';
    if (!wrkrId) {
      errors.push('작업자가 배정되지 않았습니다.');
    }

    if (!custRel) errors.push('고객과의 관계를 선택해주세요.');
    if (!installInfoData?.NET_CL) errors.push('망구분을 선택해주세요.');
    if (!installInfoData?.WRNG_TP) errors.push('배선구분을 선택해주세요.');
    if (!installInfoData?.INSTL_TP) errors.push('설치구분을 선택해주세요.');
    if (!installLocationText && !order.installLocation) errors.push('설치위치를 설정해주세요.');
    if (!workCompleteDate) errors.push('작업처리일을 선택해주세요.');

    // 사용사업자 필수 (레거시 lines 1620-1633)
    if (!internetUse) errors.push('인터넷 사용사업자를 선택하세요.');
    if (!voipUse) errors.push('VoIP 사용사업자를 선택하세요.');
    if (!dtvUse) errors.push('DTV 사용사업자를 선택하세요.');

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

    // 장비 검증 (레거시 동일)
    // VoIP가 아닌 경우 장비가 최소 1개 이상 등록되어 있어야 함
    const installedEquipments = equipmentData?.installedEquipments || [];
    if (prodGrp !== 'V' && installedEquipments.length < 1) {
      errors.push('신호처리(장비등록)를 먼저 진행해주세요.');
    }

    // OTT 시리얼번호 검증 (레거시: mowoa03m05.xml)
    if (isOttRequired && !ottEqtSerno) {
      errors.push('OTT 판매용 상품은 OTT BOX 시리얼을 입력하셔야 합니다.');
    }

    return errors;
  };

  const handleInstallInfoSave = (data: InstallInfoData) => {
    setInstallInfoData(data);
    if (data.NET_CL) setNetworkType(data.NET_CL);
    if (data.NET_CL_NM) setNetworkTypeName(data.NET_CL_NM);
    showToast?.('설치 정보가 저장되었습니다.', 'success');
  };

  const handleRemovalInfoSave = (data: InstallInfoData) => {
    setRemovalInfoData(data);
    showToast?.('철거 정보가 저장되었습니다.', 'success');
  };

  // 작업 완료 처리 - 확인 모달 표시
  const handleSubmit = () => {
    if (isLoading) return;

    const errors = validate();
    if (errors.length > 0) {
      errors.forEach(error => showToast?.(error, 'error'));
      return;
    }

    // 전주승주 조사 (레거시: PROD_GRP != 'V' 일 때 팝업)
    const prodGrpForPole = (order as any).PROD_GRP || '';
    if (prodGrpForPole !== 'V') {
      setShowPoleCheckModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  // 전주승주 조사 저장 콜백
  const handlePoleCheckSave = (data: { POLE_YN: string; LAN_GB: string }) => {
    setPoleCheckResult(data);
    setShowPoleCheckModal(false);
    setShowConfirmModal(true);
  };

  // 분실 상태 체크 함수
  const hasLossStatus = (eq: any): boolean => {
    return (
      eq.EQT_LOSS_YN === '1' ||
      eq.PART_LOSS_BRK_YN === '1' ||
      eq.EQT_BRK_YN === '1' ||
      eq.EQT_CABL_LOSS_YN === '1' ||
      eq.EQT_CRDL_LOSS_YN === '1'
    );
  };

  // 장비 목록 변환 함수 (nested → flat 구조)
  // actualEquipment/contractEquipment 중첩 구조를 EQT_NO, SVC_CMPS_ID 등 flat 구조로 변환
  const processEquipmentList = (equipments: any[], isRemoval = false) => {
    if (!equipments || equipments.length === 0) return [];
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';
    const removalStatus = equipmentData?.removalStatus || {};

    // '1' 또는 'Y' → 'Y', 그 외 → 'N' 변환 (레거시 호환)
    // 레거시 호환: '0' = 회수, '1' = 분실
    const getYN = (eqVal: any, statusVal: any) =>
      (eqVal === '1' || eqVal === 'Y' || statusVal === '1' || statusVal === 'Y') ? '1' : '0';

    // 철거장비에서 fallback 조회 (레거시와 동일: 계약장비에 없으면 철거장비에서 찾기)
    // 단, 레거시는 계약장비(ds_eqt_info)에서 LENT 필드로 가져옴 (LENT_YN이 아닌 LENT!)
    const removedEquipments = equipmentData?.removedEquipments || [];
    const findRemovedEquipmentField = (itemMidCd: string, fieldName: string): string => {
      const matchedRemoved = removedEquipments.find((eq: any) =>
        (eq.itemMidCd === itemMidCd || eq.ITEM_MID_CD === itemMidCd) && eq[fieldName]
      );
      return matchedRemoved?.[fieldName] || '';
    };
    const findBasicProdCmpsId = (itemMidCd: string): string => findRemovedEquipmentField(itemMidCd, 'BASIC_PROD_CMPS_ID');
    // LENT 또는 LENT_YN 필드 fallback (레거시 SQL은 LENT로 반환)
    const findLentYn = (itemMidCd: string): string =>
      findRemovedEquipmentField(itemMidCd, 'LENT') || findRemovedEquipmentField(itemMidCd, 'LENT_YN');
    const findSvcCmpsId = (itemMidCd: string): string => findRemovedEquipmentField(itemMidCd, 'SVC_CMPS_ID');

    return equipments.map((eq: any) => {
      const eqtNo = eq.EQT_NO || eq.id || (eq.actualEquipment?.id) || '';
      const status = removalStatus[eqtNo] || {};
      // 레거시 mowoa03m05.xml:
      // - 설치장비(ds_eqt_cust): CRR_TSK_CL="01", CHG_UID=REG_UID (라인 1881-1893)
      // - 철거장비(ds_rmv_eqt_info): CRR_TSK_CL="02" (라인 1895-1901)
      const installFields = !isRemoval ? {
        CRR_TSK_CL: '01',  // 설치는 항상 01!
        CHG_UID: workerId,
      } : {};
      // 회수 장비 필수 필드 - 5개 분실/파손 필드 모두 포함
      const removalFields = isRemoval ? {
        CRR_TSK_CL: '02',  // 철거는 항상 02!
        RCPT_ID: order.RCPT_ID || '',
        CRR_ID: order.CRR_ID || user.crrId || '01',
        WRKR_ID: workerId,
        REG_UID: workerId,  // 레거시 mowoa03m05.xml 라인 1901
        EQT_LOSS_YN: getYN(eq.EQT_LOSS_YN, status.EQT_LOSS_YN),
        PART_LOSS_BRK_YN: getYN(eq.PART_LOSS_BRK_YN, status.PART_LOSS_BRK_YN),
        EQT_BRK_YN: getYN(eq.EQT_BRK_YN, status.EQT_BRK_YN),
        EQT_CABL_LOSS_YN: getYN(eq.EQT_CABL_LOSS_YN, status.EQT_CABL_LOSS_YN),
        EQT_CRDL_LOSS_YN: getYN(eq.EQT_CRDL_LOSS_YN, status.EQT_CRDL_LOSS_YN),
      } : {};

      // 상품변경(05): 설치장비는 새 계약(DTL_CTRT_ID), 철거장비는 기존 계약(order.CTRT_ID)
      // 레거시는 철거장비에 CTRT_ID를 따로 설정하지 않음 (원래 값 유지)
      // 주의: order.OLD_CTRT_ID는 잘못된 값일 수 있음 - order.CTRT_ID가 실제 OLD 계약임
      const ctrtIdForInstall = order.DTL_CTRT_ID || order.CTRT_ID || '';
      const ctrtIdForRemoval = eq.CTRT_ID || order.CTRT_ID || '';

      if (eq.actualEquipment) {
        const actual = eq.actualEquipment;
        const contract = eq.contractEquipment || {};
        const itemMidCd = actual.itemMidCd || actual.ITEM_MID_CD || '';
        // 필수 필드들: 계약장비(LENT 필드) → 장비자체 → 철거장비에서 fallback
        // 레거시 SQL(getEqtProdInfo)은 LENT 필드로 반환 (LENT_YN이 아님!)
        const basicProdCmpsId = contract.BASIC_PROD_CMPS_ID || eq.BASIC_PROD_CMPS_ID || findBasicProdCmpsId(itemMidCd);
        const lentYn = contract.LENT || contract.LENT_YN || eq.LENT || eq.lentYn || eq.LENT_YN || findLentYn(itemMidCd);
        const svcCmpsId = contract.SVC_CMPS_ID || eq.SVC_CMPS_ID || findSvcCmpsId(itemMidCd);
        return {
          ...actual,
          EQT_NO: actual.id,
          EQT_SERNO: actual.serialNumber,
          ITEM_MID_CD: itemMidCd,
          EQT_CL_CD: actual.eqtClCd,
          MAC_ADDRESS: eq.macAddress || actual.macAddress,
          WRK_ID: order.id,
          CUST_ID: order.customer?.id,
          CTRT_ID: isRemoval ? ctrtIdForRemoval : ctrtIdForInstall,
          WRK_CD: order.WRK_CD,
          REG_UID: workerId,
          SVC_CMPS_ID: svcCmpsId,
          BASIC_PROD_CMPS_ID: basicProdCmpsId,
          PROD_CMPS_ID: contract.PROD_CMPS_ID || eq.PROD_CMPS_ID || '',
          SVC_CD: contract.SVC_CD || eq.SVC_CD || '',
          PROD_CD: contract.PROD_CD || eq.PROD_CD || '',
          LENT_YN: lentYn,
          EQT_CHG_GB: eq.EQT_CHG_GB || '01',
          ...installFields,
          ...removalFields,
        };
      }

      // 중첩 구조가 아닌 경우도 필드 매핑 필요 (레거시: LENT 필드 우선)
      const itemMidCdFlat = eq.ITEM_MID_CD || eq.itemMidCd || '';
      const basicProdCmpsIdFlat = eq.BASIC_PROD_CMPS_ID || findBasicProdCmpsId(itemMidCdFlat);
      const lentYnFlat = eq.LENT || eq.LENT_YN || eq.lentYn || findLentYn(itemMidCdFlat);
      const svcCmpsIdFlat = eq.SVC_CMPS_ID || findSvcCmpsId(itemMidCdFlat);
      return {
        ...eq,
        EQT_NO: eq.EQT_NO || eq.id || '',
        EQT_SERNO: eq.EQT_SERNO || eq.serialNumber || '',
        ITEM_MID_CD: itemMidCdFlat,
        EQT_CL_CD: eq.EQT_CL_CD || eq.eqtClCd || '',
        MAC_ADDRESS: eq.MAC_ADDRESS || eq.macAddress || '',
        SVC_CMPS_ID: svcCmpsIdFlat,
        BASIC_PROD_CMPS_ID: basicProdCmpsIdFlat,
        LENT_YN: lentYnFlat,
        PROD_CD: eq.PROD_CD || '',
        SVC_CD: eq.SVC_CD || '',
        WRK_ID: order.id,
        CUST_ID: order.customer?.id,
        CTRT_ID: isRemoval ? ctrtIdForRemoval : ctrtIdForInstall,
        WRK_CD: order.WRK_CD,
        REG_UID: workerId,
        ...installFields,
        ...removalFields,
      };
    });
  };

  // 실제 작업 완료 처리
  const handleConfirmSubmit = async () => {
    const formattedDate = workCompleteDate.replace(/-/g, '');
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';

    // FTTH 상품일 경우 CL-04 서비스 개통 등록 호출 (레거시: mowoa03m05.xml)
    // 레거시: OpLnkdCd가 F/FG/Z/ZG면 FTTH (cm_lib.js fn_get_eqipDivs)
    const isCertifyProd = certifyMode || isFtthProduct((order as any).OP_LNKD_CD);

    // 신호 차단 조건 (useCertifySignal 훅)
    const isCertifyProdForSignal = await checkCertifySignalBlocked(
      order.SO_ID || (order as any).SO_ID || '',
      (order as any).IS_CERTIFY_PROD,
    );

    // ADD_ON 파라미터 생성 (레거시: mowoa03m05.xml fn_certify_cl04 + modWorkComplete ds_where)
    // CL-04 호출과 workComplete 양쪽에 전달해야 하므로 상위 스코프에서 계산
    let addOnParam = '';
    if (isCertifyProd) {
      let prodPromoInfoForAddOn = equipmentData?.prodPromoInfo || [];
      if (prodPromoInfoForAddOn.length === 0) {
        try {
          console.log('[CompleteChange] prodPromoInfo 비어있음, getProdPromotionInfo fallback 호출 (ADD_ON용)');
          prodPromoInfoForAddOn = await getProdPromotionInfo({
            CTRT_ID: order.CTRT_ID || '',
            RCPT_ID: order.RCPT_ID || '',
            WRK_CD: order.WRK_CD || '05',
          });
          console.log('[CompleteChange] getProdPromotionInfo fallback 결과:', prodPromoInfoForAddOn.length, '개');
        } catch (e) { console.log('[CompleteChange] getProdPromotionInfo fallback 실패:', e); }
      }
      const addOnProdCodes = prodPromoInfoForAddOn
        .filter((item: any) =>
          (item.PROD_CMPS_CL === '21' || item.PROD_CMPS_CL === '22') &&
          (item.PROD_STAT_CD === '10' || item.PROD_STAT_CD === '20')
        )
        .map((item: any) => item.PROD_CD)
        .filter((code: string) => code);
      addOnParam = addOnProdCodes.length > 0 ? addOnProdCodes.join(',') + ',' : '';
      console.log('[CompleteChange] ADD_ON 파라미터:', addOnParam);
    }

    // 레거시: FTTH 상품이고 장비가 있으면 집선등록 필수
    const installedEquipments = equipmentData?.installedEquipments || [];
    if (isCertifyProd && installedEquipments.length > 0 && !certifyRegconfInfo) {
      showToast?.('집선등록 관련정보가 등록되어있지않습니다.', 'error');
      return;
    }

    if (isCertifyProd && certifyRegconfInfo) {
      try {
        // CERTIFY_TYPE 판별 (레거시 mowoa03m05.xml lines 837-866)
        const oldProdCd = (order as any).OLD_PROD_CD || '';
        const oldCtrtId = order.CTRT_ID || '';
        const soId = order.SO_ID || '';
        let certifyType = ''; // empty = no CL-04 needed

        // Step 1: Get certify_prod list and certify_so (CMIF006) list
        const certifyProdList = await getCertifyProdMap();
        const certifySoList = await getCommonCodes('CMIF006');
        const certifySoIds = certifySoList.map((item: any) => item.code);
        console.log('[CompleteChange] certifyProdList:', certifyProdList.length, 'certifySoIds:', certifySoIds);

        // Step 2: Check if OLD_PROD_CD is in certify_prod list (m05 pre-check before CL-08)
        let bCl08 = false;
        if (certifyProdList.includes(oldProdCd)) {
          try {
            const cl08Raw = await getCertifyCL08({
              CTRT_ID: oldCtrtId,
              CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
              SO_ID: soId,
              REG_UID: workerId,
              WRK_ID: order.id || '',
            });
            // CL-08 응답이 배열일 수 있음
            const cl08Result = Array.isArray(cl08Raw) ? cl08Raw[0] : cl08Raw;
            console.log('[CompleteChange] CL-08 result:', cl08Result, 'oldCtrtId:', oldCtrtId);
            if (cl08Result && !cl08Result.ERROR && cl08Result.CONT_ID === oldCtrtId) {
              bCl08 = true;
            }
          } catch (cl08Error) {
            console.log('[CompleteChange] CL-08 query failed:', cl08Error);
          }
        } else {
          console.log('[CompleteChange] OLD_PROD_CD not in certify_prod, skip CL-08');
        }

        // Step 3: Determine CERTIFY_TYPE (legacy m05 lines 847-865)
        if (bCl08) {
          // OLD is certified
          if ((order as any).IS_CERTIFY_PROD == 1 && certifySoIds.includes(soId)) {
            certifyType = 'U'; // Both OLD and NEW are certified
            console.log('[CompleteChange] CERTIFY_TYPE=U (OLD+NEW certified)');
          } else {
            // OLD certified, NEW not -> CL-06 해지 (useCertifyComplete 훅)
            const cl06Result = await executeCL06ForChange(order, workerId, oldCtrtId);
            if (!cl06Result.success) {
              showToast?.(`단말인증 해지요청 실패: ${cl06Result.error}`, 'error');
              return;
            }
          }
        } else {
          // OLD not certified
          if ((order as any).IS_CERTIFY_PROD == 1 && certifySoIds.includes(soId)) {
            certifyType = 'C'; // Only NEW is certified
            console.log('[CompleteChange] CERTIFY_TYPE=C (NEW only certified)');
          }
        }

        // CL-04 서비스 개통 등록 (useCertifyComplete 훅)
        if (certifyType) {
          const cl04Result = await executeCL04Registration({
            order, workerId, certifyRegconfInfo, addOnParam,
            reason: certifyType === 'U' ? '상변' : '신규',
            certifyType,
            contIdOld: certifyType === 'U' ? oldCtrtId : undefined,
          });
          if (!cl04Result.success) {
            showToast?.(`집선등록 실패: ${cl04Result.message}`, 'error');
            return;
          }
          console.log('[CompleteChange] CL-04 서비스 개통 등록 완료');
        }
      } catch (error: any) {
        console.error('[CompleteChange] CL-04 호출 에러:', error);
        showToast?.(`집선등록 중 오류: ${error.message || '알 수 없는 오류'}`, 'error');
        return;
      }
    }

    // IF_DTL_ID from removal signal result (passed to installation signal, legacy chain)
    let removalIfDtlId = '';

    // 철거 신호 (레거시 fn_delsignal_trans 동일)
    // CTRT_ID는 구 계약(order.CTRT_ID) 사용 — 레거시 OLD_CTRT_ID와 동일
    const oldCtrtIdForSignal = order.CTRT_ID || '';

    // LGHV→LGHV 여부 판별 (레거시: bLghvStb && nOldPrdRow > -1 이면 return)
    const oldProdCd = (order as any).OLD_PROD_CD || '';
    const isOldLghv = oldProdCd && lghvProdList.length > 0
      && lghvProdList.some((p: any) => p.PROD_CD === oldProdCd);

    const removedEquipments = equipmentData?.removedEquipments || [];
    // LGHV→LGHV: 신상품 LGHV && 구상품 LGHV → 철거신호 skip (레거시 fn_delsignal_trans lines 1992-1993)
    if (isLghvStb && isOldLghv) {
      console.log('[CompleteChange] LGHV→LGHV 상품변경: 철거 신호 skip (레거시 동일)');
    } else if (!isCertifyProdForSignal && removedEquipments.length > 0) {
      // 레거시 line 1812: CERTIFY_TG!="Y" 일 때만 철거신호
      try {
        // 구상품이 LGHV이면 STB_DEL, 아니면 SMR05 (레거시 fn_delsignal_trans lines 2008-2015)
        let msgId = 'SMR05';
        let etc1 = '';
        if (isOldLghv) {
          msgId = 'STB_DEL';
          const stbEquipment = removedEquipments.find(
            (eq: any) => (eq.ITEM_MID_CD || eq.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || eq.actualEquipment?.itemMidCd) === '04'
          );
          if (stbEquipment) {
            etc1 = stbEquipment.EQT_NO || stbEquipment.id || stbEquipment.actualEquipment?.EQT_NO || stbEquipment.actualEquipment?.id || '';
          }
        }

        // EQT_PROD_CMPS_ID 추출: 레거시 ds_rmv_prod_info에서 PROD_CMPS_CL="23"인 행의 PROD_CMPS_ID
        // getProdPromotionInfo API 호출 (레거시 fn_getCtrtProdInfo 동일)
        let eqtProdCmpsId = '';
        try {
          const rmvProdInfo = await getProdPromotionInfo({
            CTRT_ID: oldCtrtIdForSignal,
            RCPT_ID: order.RCPT_ID || '',
            PROC_CL: 'TERM',
            WRK_CD: '05',
          });
          console.log('[CompleteChange] getProdPromotionInfo 응답:', rmvProdInfo);
          // PROD_CMPS_CL="23"인 행에서 PROD_CMPS_ID 추출 (레거시 line 2004)
          const prodCmpsRow = rmvProdInfo.find((row: any) => row.PROD_CMPS_CL === '23');
          if (prodCmpsRow) {
            eqtProdCmpsId = prodCmpsRow.PROD_CMPS_ID || '';
          }
          console.log('[CompleteChange] EQT_PROD_CMPS_ID:', eqtProdCmpsId);
        } catch (prodInfoError) {
          console.log('[CompleteChange] getProdPromotionInfo 조회 실패 (무시):', prodInfoError);
        }

        // Determine VOIP_JOIN_CTRT_ID for removal signal
        // Legacy: end_PROD_CD (VoIP단독) → CTRT_ID from ds_rmv_prod_info
        const endProdCd = (order as any).END_PROD_CD || (order as any).VOIP_PROD_CD || '';
        let rmvVoipJoinCtrtId = '';
        if (endProdCd) {
          rmvVoipJoinCtrtId = oldCtrtIdForSignal;
        }

        console.log('[CompleteChange] 철거 신호 호출:', { msgId, ctrtId: oldCtrtIdForSignal, eqtProdCmpsId });
        const result = await sendSignal({
          MSG_ID: msgId,
          CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
          CTRT_ID: oldCtrtIdForSignal,
          SO_ID: order.SO_ID || '',
          EQT_NO: '',
          EQT_PROD_CMPS_ID: eqtProdCmpsId,
          PROD_CD: '',
          ITV_USR_ID: '',
          IP_CNT: '',
          ETC_1: etc1,
          ETC_2: '',
          ETC_3: '',
          ETC_4: '',
          SUB_PROD_CD: '',
          IF_DTL_ID: '',
          WRK_ID: order.id || '',
          REG_UID: workerId,
          VOIP_JOIN_CTRT_ID: rmvVoipJoinCtrtId || voipJoinCtrtId || '',
          WTIME: '3',
        });
        console.log('[CompleteChange] 철거 신호 호출 완료:', result);
        // 레거시 mowoa03m05.xml: 신호 실패 시 메시지만 띄우고 항상 계속 진행 (return 없음)
        if (result?.code === 'SUCCESS' || result?.code === 'PARTIAL') {
          removalIfDtlId = result?.IF_DTL_ID || '';
          console.log('[CompleteChange] removal signal SUCCESS, IF_DTL_ID:', removalIfDtlId);
        } else {
          const errMsg = result?.message || result?.rawResult || '';
          console.warn('[CompleteChange] removal signal FAILED - 계속 진행:', errMsg);
          showToast?.(`철거 신호 전송 실패: ${errMsg}`, 'warning');
        }
      } catch (error) {
        // 레거시 동일: 신호 오류 시에도 작업완료 계속 진행
        console.warn('[CompleteChange] removal signal error - 계속 진행:', error);
        showToast?.('철거 신호 전송 중 오류가 발생했습니다.', 'warning');
      }
    }

    // 분실처리는 modWorkComplete에서 rmvEqtList로 일괄 처리됨 (별도 custEqtInfoDel 호출 불필요)

    // 상품변경(05) 작업은 DTL_CTRT_ID 사용 (레거시 mowoa03m05.xml 동일)
    const ctrtIdForProductChange = order.DTL_CTRT_ID || order.CTRT_ID || '';

    // ========== DEBUG: 철거장비 데이터 상세 로그 ==========
    console.log('========== [CompleteChange] 상품변경 디버그 시작 ==========');
    console.log('[DEBUG] order.CTRT_ID (OLD 계약):', order.CTRT_ID);
    console.log('[DEBUG] order.DTL_CTRT_ID (NEW 계약):', order.DTL_CTRT_ID);
    console.log('[DEBUG] order.OLD_CTRT_ID:', (order as any).OLD_CTRT_ID);
    console.log('[DEBUG] ctrtIdForProductChange (workInfo에 전달):', ctrtIdForProductChange);

    console.log('[DEBUG] 설치장비 원본 (installedEquipments):', equipmentData?.installedEquipments?.length || 0, '개');
    equipmentData?.installedEquipments?.forEach((eq: any, i: number) => {
      console.log(`[DEBUG] 설치장비[${i}]:`, {
        EQT_NO: eq.EQT_NO || eq.id || eq.actualEquipment?.id,
        EQT_SERNO: eq.EQT_SERNO || eq.serialNumber || eq.actualEquipment?.serialNumber,
        CTRT_ID: eq.CTRT_ID,
        SVC_CMPS_ID: eq.SVC_CMPS_ID || eq.contractEquipment?.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || eq.contractEquipment?.BASIC_PROD_CMPS_ID,
        LENT_YN: eq.LENT_YN || eq.LENT || eq.contractEquipment?.LENT,
      });
    });

    console.log('[DEBUG] 철거장비 원본 (removedEquipments):', equipmentData?.removedEquipments?.length || 0, '개');
    equipmentData?.removedEquipments?.forEach((eq: any, i: number) => {
      console.log(`[DEBUG] 철거장비[${i}] 전체 데이터:`, JSON.stringify(eq, null, 2));
      console.log(`[DEBUG] 철거장비[${i}] 요약:`, {
        EQT_NO: eq.EQT_NO || eq.id || eq.actualEquipment?.id,
        EQT_SERNO: eq.EQT_SERNO || eq.serialNumber || eq.actualEquipment?.serialNumber,
        CTRT_ID: eq.CTRT_ID,
        SVC_CMPS_ID: eq.SVC_CMPS_ID || eq.contractEquipment?.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || eq.contractEquipment?.BASIC_PROD_CMPS_ID,
        LENT_YN: eq.LENT_YN || eq.LENT || eq.contractEquipment?.LENT,
        ITEM_MID_CD: eq.ITEM_MID_CD || eq.itemMidCd,
        ITEM_CD: eq.ITEM_CD,
        EQT_CL_CD: eq.EQT_CL_CD || eq.eqtClCd,
        PROD_CMPS_ID: eq.PROD_CMPS_ID,
      });
    });

    const processedInstallList = processEquipmentList(equipmentData?.installedEquipments || [], false);
    const processedRemoveList = processEquipmentList(equipmentData?.removedEquipments || [], true);

    console.log('[DEBUG] 변환된 설치장비 (equipmentList):', processedInstallList.length, '개');
    processedInstallList.forEach((eq: any, i: number) => {
      console.log(`[DEBUG] 변환된 설치장비[${i}]:`, {
        EQT_NO: eq.EQT_NO,
        CTRT_ID: eq.CTRT_ID,
        CRR_TSK_CL: eq.CRR_TSK_CL,
        SVC_CMPS_ID: eq.SVC_CMPS_ID,
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
      });
    });

    console.log('[DEBUG] 변환된 철거장비 (removeEquipmentList):', processedRemoveList.length, '개');
    processedRemoveList.forEach((eq: any, i: number) => {
      console.log(`[DEBUG] 변환된 철거장비[${i}] 전체:`, JSON.stringify(eq, null, 2));
    });
    console.log('========== [CompleteChange] 상품변경 디버그 끝 ==========');
    // ========== DEBUG END ==========

    // 레거시 mowoa03m05.xml 라인 1648-1654: WRK_DTL_TCD 치환
    // 상품변경은 설치코드→철거코드로 변환하여 저장
    let wrkDtlTcd = order.WRK_DTL_TCD || '';
    if (wrkDtlTcd === '0550') wrkDtlTcd = '0560';      // 서비스전환설치 → 서비스전환철거
    else if (wrkDtlTcd === '0510') wrkDtlTcd = '0520';  // 상품변경설치 → 상품변경철거

    const completeData: WorkCompleteData = {
      workInfo: {
        WRK_ID: order.id,
        WRK_CD: order.WRK_CD,
        WRK_DTL_TCD: wrkDtlTcd,
        CUST_ID: order.customer?.id,
        CTRT_ID: ctrtIdForProductChange,
        RCPT_ID: order.RCPT_ID,
        CRR_ID: order.CRR_ID || user.crrId || '01',
        WRKR_ID: workerId,
        WRKR_CMPL_DT: formattedDate,
        MEMO: memo || '작업 완료',
        STTL_YN: 'Y',
        REG_UID: workerId,
        CUST_REL: custRel,
        CNFM_CUST_NM: order.customer?.name || '',
        CNFM_CUST_TELNO: order.customer?.contactNumber || '',
        INSTL_LOC: installLocationText || order.installLocation || '',
        UP_CTRL_CL: upCtrlCl || '',
        PSN_USE_CORP: internetUse || '',
        VOIP_USE_CORP: voipUse || '',
        DTV_USE_CORP: dtvUse || '',
        WRK_ACT_CL: '20',
        TV_TYPE: '',
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '',
        VOIP_JOIN_CTRT_ID: voipJoinCtrtId || '',
        ADD_ON: addOnParam || '',
      },
      equipmentList: processedInstallList,
      removeEquipmentList: processedRemoveList,
      spendItemList: equipmentData?.spendItems || [],
      agreementList: equipmentData?.agreements || [],
      poleList: poleCheckResult ? [{
        WRK_ID: order.id,
        POLE_YN: poleCheckResult.POLE_YN,
        LAN_GB: poleCheckResult.LAN_GB || '',
        REG_UID: workerId,
      }] : []
    };

    // fn_signal_trans equivalent: modWorkComplete 성공 후 설치신호 전송
    // (레거시: mowoa03m05.xml fn_signal_trans lines 1258-1477)
    const sendInstallationSignal = async () => {
      try {
        // CERTIFY_TG='Y'이면 개통신호 skip (레거시 line 1185: CERTIFY_TG!="Y")
        if (isCertifyProdForSignal) {
          console.log('[CompleteChange] FTTH 인증상품: 개통신호 skip (레거시 동일)');
          return;
        }

        const installedEquipments = equipmentData?.installedEquipments || [];

        // LGHV STB signal type (legacy lines 1334-1343)
        const oldProdCdForSig = (order as any).OLD_PROD_CD || '';
        const nOldPrdRow = lghvProdList.some((p: any) => p.PROD_CD === oldProdCdForSig);
        let msgId = 'SMR03';
        if (isLghvStb) {
          msgId = nOldPrdRow ? 'PKG_CHG' : 'STB_CRT';
        }

        const findEquip = (midCd: string) =>
          installedEquipments.find((eq: any) =>
            (eq.ITEM_MID_CD || eq.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || eq.actualEquipment?.itemMidCd) === midCd
          );
        const getNo = (eq: any) => eq?.EQT_NO || eq?.id || eq?.actualEquipment?.EQT_NO || eq?.actualEquipment?.id || '';

        // bgn_PROD_CD = VoIP begin PROD_CD (legacy: bgn_PROD_CD)
        const bgnProdCd = (order as any).BGN_PROD_CD || (order as any).VOIP_PROD_CD || '';
        const bgnProdGrp = (order as any).BGN_PROD_GRP || (order as any).PROD_GRP || '';

        // EQT_PROD_CMPS_ID, PROD_CD, SUB_PROD_CD from getProdPromotionInfo
        // prodGrpFromPromo를 먼저 가져와야 eqt_no I체크에 사용 가능
        let instEqtProdCmpsId = '';
        let instProdCd = '';
        let subProdCd = '';
        let prodGrpFromPromo = '';
        try {
          const prodPromoInfo = await getProdPromotionInfo({
            CTRT_ID: order.DTL_CTRT_ID || order.CTRT_ID || '',
            RCPT_ID: order.RCPT_ID || '',
            PROC_CL: '',
            WRK_CD: '05',
          });
          const cmps23 = prodPromoInfo.find((row: any) => row.PROD_CMPS_CL === '23');
          if (cmps23) instEqtProdCmpsId = cmps23.PROD_CMPS_ID || '';
          const cmps11 = prodPromoInfo.find((row: any) => row.PROD_CMPS_CL === '11');
          if (cmps11) {
            instProdCd = cmps11.PROD_CD || '';
            prodGrpFromPromo = cmps11.PROD_GRP || '';
          }
          // SUB_PROD_CD: BASIC_PROD_FL=V rows (legacy lines 1412-1423)
          const subProds = prodPromoInfo
            .filter((row: any) => row.BASIC_PROD_FL === 'V')
            .map((row: any) => row.PROD_CD);
          if (subProds.length > 0) subProdCd = subProds.join(',');
        } catch (e) {
          console.log('[CompleteChange] getProdPromotionInfo for install signal failed:', e);
        }

        // eqt_no (legacy lines 1349-1373) - prodGrpFromPromo 사용
        let eqtNo = '';
        if (bgnProdCd) {
          // VoIP: ITEM_MID_CD=08
          const eq = findEquip('08');
          if (eq) eqtNo = getNo(eq);
        } else {
          for (const midCd of ['05', '01', '03']) {
            const eq = findEquip(midCd);
            if (eq) { eqtNo = getNo(eq); break; }
          }
          if (!eqtNo && prodGrpFromPromo === 'I') {
            const eq = findEquip('02');
            if (eq) eqtNo = getNo(eq);
          }
          if (!eqtNo) {
            const eq = findEquip('08');
            if (eq) eqtNo = getNo(eq);
          }
        }

        // etc_1 (legacy lines 1378-1383, 1430-1432)
        let etc1Install = '';
        if (bgnProdCd) {
          // VoIP: ITEM_MID_CD=02
          const eq = findEquip('02');
          if (eq) etc1Install = getNo(eq);
        } else {
          const stbEq = findEquip('04');
          if (stbEq) {
            etc1Install = getNo(stbEq);
          } else {
            // NET_CL for analog products (legacy line 1382)
            etc1Install = installInfoData?.NET_CL || '';
          }
        }

        // etc_2: ITEM_MID_CD=07 (legacy line 1385)
        const etc2Install = getNo(findEquip('07'));
        // etc_3: ITEM_MID_CD=02 if PROD_GRP=C (legacy lines 1387-1388)
        const etc3Install = prodGrpFromPromo === 'C' ? getNo(findEquip('02')) : '';
        // etc_4 (legacy lines 1390-1401)
        let etc4Install = '';
        if (findEquip('10') && bgnProdGrp === 'V') {
          etc4Install = getNo(findEquip('10'));
        }
        const bgnIspProdCd = (order as any).BGN_ISP_PROD_CD || (order as any).ISP_PROD_CD || '';
        if (bgnIspProdCd) {
          const eq = findEquip('21');
          if (eq) etc4Install = getNo(eq);
        }

        // wrk_id (legacy lines 1402-1408)
        let wrkIdForSignal = order.id || '';
        const specEq1 = installedEquipments.find((eq: any) =>
          (eq.EQT_CL_CD || eq.eqtClCd || eq.actualEquipment?.EQT_CL_CD || eq.actualEquipment?.eqtClCd) === '091003'
        );
        if (specEq1) {
          wrkIdForSignal = getNo(specEq1);
        } else {
          const specEq2 = installedEquipments.find((eq: any) =>
            (eq.EQT_CL_CD || eq.eqtClCd || eq.actualEquipment?.EQT_CL_CD || eq.actualEquipment?.eqtClCd) === '092201'
          );
          if (specEq2) wrkIdForSignal = specEq2?.MAC_ADDRESS || specEq2?.macAddress || specEq2?.actualEquipment?.MAC_ADDRESS || specEq2?.actualEquipment?.macAddress || '';
        }

        // VOIP_JOIN_CTRT_ID (legacy lines 1428-1444)
        let joinCtrtIdForInstall = '';
        if (bgnProdCd) {
          joinCtrtIdForInstall = order.CTRT_ID || '';
        } else {
          joinCtrtIdForInstall = voipJoinCtrtId || '';
        }

        console.log('[CompleteChange] 설치신호 전송:', { msgId, eqtNo, instProdCd, instEqtProdCmpsId, subProdCd });
        await sendSignal({
          MSG_ID: msgId,
          CUST_ID: order.customer?.id || (order as any).CUST_ID || '',
          CTRT_ID: order.DTL_CTRT_ID || order.CTRT_ID || '',
          SO_ID: order.SO_ID || '',
          EQT_NO: eqtNo,
          EQT_PROD_CMPS_ID: instEqtProdCmpsId,
          PROD_CD: instProdCd,
          ITV_USR_ID: '',
          IP_CNT: '',
          ETC_1: etc1Install,
          ETC_2: etc2Install,
          ETC_3: etc3Install,
          ETC_4: etc4Install,
          SUB_PROD_CD: subProdCd,
          IF_DTL_ID: '',
          WRK_ID: wrkIdForSignal,
          REG_UID: workerId,
          VOIP_JOIN_CTRT_ID: joinCtrtIdForInstall,
          WTIME: '3',
        });
        console.log('[CompleteChange] 설치신호 전송 완료');
      } catch (error) {
        console.log('[CompleteChange] 설치신호 처리 중 오류 (무시하고 계속 진행):', error);
      }
    };

    submitWork(completeData, {
      onSuccess: (result) => {
        if (result.code === 'SUCCESS' || result.code === 'OK') {
          localStorage.removeItem(getStorageKey());
          // 작업완료 성공 시 order 상태를 '3'(완료)으로 변경
          // 후처리에서 이전 단계로 돌아와도 작업완료 버튼이 안 보이게 함
          (order as any).WRK_STAT_CD = '3';

          // modWorkComplete 성공 후 설치신호 전송 (레거시 fn_signal_trans)
          sendInstallationSignal();

          showToast?.('작업이 성공적으로 완료되었습니다.', 'success');
          onSuccess();
        } else {
          showToast?.(result.message || '작업 완료 처리에 실패했습니다.', 'error', true);
        }
      },
      onError: (error: any) => {
        showToast?.(error.message || '작업 완료 중 오류가 발생했습니다.', 'error', true);
      },
    });
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 bg-gray-50 min-h-0 relative">
      {/* 전체 화면 로딩 오버레이 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3 shadow-xl">
            <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-700 font-medium">작업완료 처리중...</span>
          </div>
        </div>
      )}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <div className="space-y-3 sm:space-y-5">
            {/* 결합계약 */}
            {showJoinCtrt ? (
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
            ) : (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">결합계약</label>
                <input
                  type="text"
                  value=""
                  readOnly disabled
                  className="w-full min-h-10 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-not-allowed"
                />
              </div>
            )}

            {/* 망구분 + 설치정보/철거정보 버튼 */}
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
                  className={`px-3 py-2 text-sm font-semibold rounded-lg whitespace-nowrap ${isWorkCompleted ? 'bg-gray-500 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '설치정보'}
                </button>
                {showRemovalInfoButton && (
                  <button
                    type="button"
                    onClick={() => setShowRemovalInfoModal(true)}
                    className={`px-3 py-2 text-sm font-semibold rounded-lg whitespace-nowrap ${isWorkCompleted ? 'bg-gray-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                  >
                    {isWorkCompleted ? '보기' : '철거정보'}
                  </button>
                )}
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

            {/* 설치위치 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                설치위치 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center min-h-10 px-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm">
                  <span>{installLocationText || order.installLocation || '미설정'}</span>
                  {viewModNm && <span className="ml-2 text-xs text-gray-500">(시청: {viewModNm})</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallLocationModal(true)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap ${isWorkCompleted ? 'bg-gray-500 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '설정'}
                </button>
              </div>
            </div>

            {/* 상향제어 - DTV(KPI_PROD_GRP_CD='D')일 때만 표시 */}
            {(equipmentData?.kpiProdGrpCd === 'D' || equipmentData?.prodGrp === 'D' || (order as any).PROD_GRP === 'D' ||
              // Fallback: PROD_NM에 'DTV' 포함 시에도 표시 (완료된 작업 조회 시 PROD_GRP 누락 대응)
              ((order as any).PROD_NM || '').includes('DTV')) && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">상향제어</label>
                <Select value={upCtrlCl} onValueChange={setUpCtrlCl} options={upCtrlClOptions}
                  placeholder="선택" disabled={isWorkCompleted} />
              </div>
            )}

            {/* 처리내용 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">처리내용</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="작업 내용을 입력하세요..."
                maxLength={500}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base resize-none ${isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                rows={3}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
              {!isWorkCompleted && (
                <p className={`text-xs text-right mt-1 ${memo.length >= 500 ? 'text-red-500' : 'text-gray-400'}`}>{memo.length}/500</p>
              )}
            </div>

            {/* 작업처리일 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">작업처리일 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={workCompleteDate}
                readOnly disabled
                className="w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-500 cursor-not-allowed"
              />
            </div>


            {/* 타사이용여부 (접기/펼치기) */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsServiceUseExpanded(!isServiceUseExpanded)}
                className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-700">타사이용여부</span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${isServiceUseExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isServiceUseExpanded && (
                <div className="p-4 space-y-4 bg-white">
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1">DTV (디지털이용)</label>
                    <Select value={dtvUse} onValueChange={setDtvUse} options={dtvOptions}
                      placeholder="선택" disabled={isWorkCompleted} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1">ISP (인터넷이용)</label>
                    <Select value={internetUse} onValueChange={setInternetUse} options={internetOptions}
                      placeholder="선택" disabled={isWorkCompleted} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1">VoIP (VoIP이용)</label>
                    <Select value={voipUse} onValueChange={setVoipUse} options={voipOptions}
                      placeholder="선택" disabled={isWorkCompleted} />
                  </div>
                </div>
              )}
            </div>

            {/* OTT 시리얼 입력 (OTT 상품일 때만 표시) */}
            {isOttRequired && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  OTT BOX 시리얼 {!isWorkCompleted && <span className="text-red-500">*</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ottEqtSerno}
                    readOnly
                    placeholder="SER_NO 버튼을 눌러 입력"
                    className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOttModal(true)}
                    disabled={isWorkCompleted}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 ${
                      isWorkCompleted
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : ottEqtSerno
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    SER_NO
                  </button>
                </div>
              </div>
            )}

            {/* 하단 버튼 영역 */}
            <div className="flex gap-1.5 sm:gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-gray-200">
              {/* 작업완료 버튼 */}
              {!isWorkCompleted && (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`flex-1 min-h-12 py-3 px-4 rounded-lg font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors ${
                    isLoading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
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
                      <span>작업완료</span>
                    </>
                  )}
                </button>
              )}
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
        addrOrd={(order as any).ADDR_ORD}
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD || (order as any).KPI_PROD_GRP_CD}
        prodChgGb="01"
        chgKpiProdGrpCd={equipmentData?.chgKpiProdGrpCd || equipmentData?.CHG_KPI_PROD_GRP_CD || (order as any).KPI_PROD_GRP_CD}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP || (order as any).PROD_GRP}
        wrkDtlTcd={order.WRK_DTL_TCD}
        readOnly={isWorkCompleted}
      />

      {/* 철거정보 모달 (설치정보 모달 재사용) */}
      <InstallInfoModal
        isOpen={showRemovalInfoModal}
        onClose={() => setShowRemovalInfoModal(false)}
        onSave={handleRemovalInfoSave}
        workId={order.id}
        initialData={removalInfoData}
        workType="08" // 철거 모드로 사용
        customerId={order.customer?.id}
        customerName={order.customer?.name}
        contractId={order.CTRT_ID}
        addrOrd={(order as any).ADDR_ORD}
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD || (order as any).KPI_PROD_GRP_CD}
        prodChgGb="02"
        chgKpiProdGrpCd={equipmentData?.chgKpiProdGrpCd || equipmentData?.CHG_KPI_PROD_GRP_CD || (order as any).KPI_PROD_GRP_CD}
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

      {/* 전주승주 조사 모달 */}
      <PoleCheckModal
        isOpen={showPoleCheckModal}
        onClose={() => setShowPoleCheckModal(false)}
        onSave={handlePoleCheckSave}
        soId={order.SO_ID || ''}
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
      >
        <WorkCompleteSummary
          equipmentData={equipmentData}
          installInfoData={installInfoData}
          custRel={custRel}
          custRelOptions={custRelOptions}
          memo={memo}
          installLocationText={installLocationText}
          order={order}
        />
      </ConfirmModal>

      {/* OTT 시리얼번호 입력 모달 */}
      <OttSerialModal
        isOpen={showOttModal}
        onClose={() => setShowOttModal(false)}
        onSave={(serialNo) => {
          setOttEqtSerno(serialNo);
          showToast?.('OTT 시리얼번호가 저장되었습니다.', 'success');
        }}
        wrkId={order.id || ''}
        wrkDrctnId={order.directionId || order.WRK_DRCTN_ID || ''}
        crrId={order.CRR_ID || ''}
        wrkrId={(order as any).WRKR_ID || ''}
        dataType={ottDataType}
        showToast={showToast}
        readOnly={isWorkCompleted}
      />
    </div>
  );
};

export default CompleteChange;
