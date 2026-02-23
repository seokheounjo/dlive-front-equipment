/**
 * CompleteRelocate.tsx
 * WRK_CD=07 (이전설치) 작업완료 페이지
 *
 * 레거시 참조: mowoa03m07.xml - 작업완료(이전설치)
 * 특징:
 * - 주소변경 버튼 (btn_location_change) 표시
 * - 이사작업정보 버튼 (btn_move_info) 표시
 * - 설치정보 필수
 *
 * 주의: 댁내이전(WRK_CD=06)은 CompleteInternalMove.tsx 사용
 */
import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { isFtthProduct } from '../../../../utils/workValidation';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail, getCustomerContractInfo, sendSignal, getLghvProdMap, getMoveWorkInfo, MoveWorkInfo, getOttSale, saveOttSale, getProdPromotionInfo } from '../../../../services/apiService';
import { executeCL04Registration, determineCertifyType } from '../../../../hooks/useCertifyComplete';
import { checkCertifySignalBlocked } from '../../../../hooks/useCertifySignal';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import InstallLocationModal, { InstallLocationData } from '../../../modal/InstallLocationModal';
import PoleCheckModal from '../../../modal/PoleCheckModal';
import ConfirmModal from '../../../common/ConfirmModal';
import WorkCompleteSummary from '../WorkCompleteSummary';
import MoveWorkInfoModal from '../modals/MoveWorkInfoModal';
import OttSerialModal from '../../../modal/OttSerialModal';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useCertifyStore } from '../../../../stores/certifyStore';
import { useWorkEquipment } from '../../../../stores/workEquipmentStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import '../../../../styles/buttons.css';

interface CompleteRelocateProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
  onEquipmentRefreshNeeded?: () => void;
  certifyMode?: boolean;    // LGU+ certify: forces certify path regardless of isFtthProduct
  certifyReason?: string;   // LGU+ certify: LDAP-based REASON for CL-04
}

const CompleteRelocate: React.FC<CompleteRelocateProps> = ({
  order,
  onBack,
  onSuccess,
  showToast,
  equipmentData: legacyEquipmentData,
  readOnly = false,
  certifyMode = false,
  certifyReason,
}) => {
  const isWorkCompleted = readOnly
    || order.WRK_STAT_CD === '3'
    || order.WRK_STAT_CD === '4'
    || order.WRK_STAT_CD === '7'
    || order.status === '완료'
    || order.status === '취소';

  // WRK_CD=06, 07 모두 이전설치 (레거시 mowoa03m06)
  const isMoveRemoval = order.WRK_CD === '07';
  const workTypeName = '이전설치';

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

  // WRK_CD=07 전용: 고객주소/납부자주소 체크박스
  const [chkCustAddr, setChkCustAddr] = useState(false);
  const [chkPymAddr, setChkPymAddr] = useState(false);

  // 타사이용여부 접기/펼치기 상태
  const [isServiceUseExpanded, setIsServiceUseExpanded] = useState(false);

  // 결합계약 선택 (VoIP/ISP)
  const [voipJoinCtrtId, setVoipJoinCtrtId] = useState('');
  const [joinCtrtOptions, setJoinCtrtOptions] = useState<{ value: string; label: string }[]>([]);
  const [showJoinCtrt, setShowJoinCtrt] = useState(false);
  const [customerCtrtList, setCustomerCtrtList] = useState<any[]>([]);

  // 모달
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [networkTypeName, setNetworkTypeName] = useState('');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);
  const [showInstallLocationModal, setShowInstallLocationModal] = useState(false);
  const [installLocationText, setInstallLocationText] = useState('');
  const [viewModCd, setViewModCd] = useState('');
  const [viewModNm, setViewModNm] = useState('');

  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // 철거이전정보 모달 (WRK_CD=07)
  const [showMoveWorkInfoModal, setShowMoveWorkInfoModal] = useState(false);

  // 전주승주 조사 (레거시: mowoa01p33.xml)
  const [showPoleCheckModal, setShowPoleCheckModal] = useState(false);
  const [poleCheckResult, setPoleCheckResult] = useState<{ POLE_YN: string; LAN_GB: string } | null>(null);

  // LGHV STB 상품 판단 (레거시: bLghvStb, ds_lghv_prod)
  const [isLghvStb, setIsLghvStb] = useState(false);
  const [lghvProdList, setLghvProdList] = useState<any[]>([]);

  // 이전작업 정보 (VOIP 검증, LGHV STB 차단용)
  const [moveWorkInfo, setMoveWorkInfo] = useState<MoveWorkInfo | null>(null);

  // OTT 시리얼번호 입력 (레거시: mowoa03m01.xml OTT_EQT_INPUT, mowoDivE01 btn_ott_serno)
  // 조건: PROD_CD == "PD10018480" (OTT판매/할당) OR prod_promo_info에 "PD10018160" (편채널_Netflix OTT STB) 포함
  const [showOttModal, setShowOttModal] = useState(false);
  const [ottEqtSerno, setOttEqtSerno] = useState('');
  const [isOttRequired, setIsOttRequired] = useState(false);
  const [ottDataType, setOttDataType] = useState<'B' | 'C'>('B');  // B=일반, C=판매용

  // 공통코드
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);
  const [upCtrlClOptions, setUpCtrlClOptions] = useState<{ value: string; label: string }[]>([]);
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
            console.log('[CompleteMoveRemoval] 상향제어 값:', { API: detail.UP_CTRL_CL, 장비데이터: equipmentData?.upCtrlCl, 최종: upCtrlClValue });
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

            // 결합계약 ID 복원
            if (detail.VOIP_JOIN_CTRT_ID) {
              setVoipJoinCtrtId(detail.VOIP_JOIN_CTRT_ID);
            }

            // WRK_CD=07 전용 체크박스 복원
            if (detail.CHK_CUST_ADDR === 'true' || detail.CHK_CUST_ADDR === 'Y') {
              setChkCustAddr(true);
            }
            if (detail.CHK_PYM_ADDR === 'true' || detail.CHK_PYM_ADDR === 'Y') {
              setChkPymAddr(true);
            }

            // 작업처리일 복원
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          }
        } catch (error) {
          console.error('[WorkCompleteMoveRemoval] 완료 작업 상세 조회 실패:', error);
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
        // 결합계약 ID 복원
        if (draftData.voipJoinCtrtId) setVoipJoinCtrtId(draftData.voipJoinCtrtId);
        // WRK_CD=07 전용 체크박스 복원
        if (draftData.chkCustAddr !== undefined) setChkCustAddr(draftData.chkCustAddr);
        if (draftData.chkPymAddr !== undefined) setChkPymAddr(draftData.chkPymAddr);
      } catch (error) {
        console.error('[WorkCompleteMoveRemoval] localStorage 복원 실패:', error);
      }
    }
    setIsDataLoaded(true);
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;
    const draftData = {
      custRel, memo, internetUse, voipUse, dtvUse, upCtrlCl,
      networkType, networkTypeName, installLocationText, installInfoData,
      voipJoinCtrtId, chkCustAddr, chkPymAddr,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, internetUse, voipUse, dtvUse, upCtrlCl,
      networkType, networkTypeName, installLocationText, installInfoData, voipJoinCtrtId, chkCustAddr, chkPymAddr, isDataLoaded, isWorkCompleted]);

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
          console.log('[CompleteMoveRemoval] 공통코드 CMCT015 옵션:', codes['CMCT015']);
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
        console.error('[WorkCompleteMoveRemoval] 공통코드 로드 실패:', error);
      }
    };
    loadCodes();
  }, []);

  // LGHV 상품맵 조회 및 판단 (레거시: fn_getLghvProdMap)
  useEffect(() => {
    const fetchLghvProdMap = async () => {
      try {
        const result = await getLghvProdMap();
        const prodList = result?.output || result || [];
        setLghvProdList(prodList);

        const currentProdCd = order.PROD_CD || (order as any).PROD_CD || '';
        const isLghv = prodList.some((item: any) => item.PROD_CD === currentProdCd);
        setIsLghvStb(isLghv);
        console.log('[CompleteRelocate] LGHV 판단:', { currentProdCd, isLghv, prodListCount: prodList.length });
      } catch (error) {
        console.error('[CompleteRelocate] LGHV 상품맵 조회 실패:', error);
      }
    };
    fetchLghvProdMap();
  }, [order.PROD_CD]);

  // 이전작업 정보 조회 - VOIP 이전철거 완료 검증, LGHV STB 차단용 (레거시: fn_getMoveWorkInfo)
  useEffect(() => {
    if (order.WRK_CD !== '07') return;
    const fetchMoveInfo = async () => {
      try {
        const result = await getMoveWorkInfo({
          WRK_CD: order.WRK_CD || '07',
          WRK_ID: order.id || '',
          RCPT_ID: order.RCPT_ID || '',
        });
        setMoveWorkInfo(result);
        console.log('[CompleteRelocate] getMoveWorkInfo:', result);
      } catch (error) {
        console.error('[CompleteRelocate] getMoveWorkInfo 실패:', error);
      }
    };
    fetchMoveInfo();
  }, [order.id, order.WRK_CD]);

  // OTT 상품 판단 및 기존 시리얼 조회 (레거시: mowoa03m01.xml OTT_EQT_INPUT)
  // 조건: PROD_CD == "PD10018480" OR prod_promo_info에 "PD10018160" 포함
  useEffect(() => {
    const checkOttProduct = async () => {
      const currentProdCd = order.PROD_CD || (order as any).PROD_CD || '';
      const prodPromoInfo = equipmentData?.prodPromoInfo || [];

      // OTT 판매/할당 상품 (PD10018480) - 판매용 OTT
      if (currentProdCd === 'PD10018480') {
        console.log('[CompleteRelocate] OTT 판매용 상품 감지:', currentProdCd);
        setIsOttRequired(true);
        setOttDataType('C');  // 판매용
      }
      // 프로모션에 Netflix OTT STB (PD10018160) 포함 - 일반 OTT
      else if (prodPromoInfo.some((item: any) => item.PROD_CD === 'PD10018160')) {
        console.log('[CompleteRelocate] OTT 프로모션 상품 감지: PD10018160');
        setIsOttRequired(true);
        setOttDataType('B');  // 일반
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
            console.log('[CompleteRelocate] 기존 OTT 시리얼:', existingOtt.EQT_SERNO);
            setOttEqtSerno(existingOtt.EQT_SERNO);
          }
        } catch (error) {
          console.error('[CompleteRelocate] OTT 시리얼 조회 실패:', error);
        }
      }
    };

    checkOttProduct();
  }, [order.PROD_CD, order.id, order.directionId, equipmentData?.prodPromoInfo]);

  // 상향제어: equipmentData가 나중에 로드되면 업데이트, 없으면 기본값 '01'(쌍방향) 설정
  useEffect(() => {
    if (equipmentData?.upCtrlCl && !upCtrlCl) {
      console.log('[CompleteMoveRemoval] equipmentData에서 상향제어 업데이트:', equipmentData.upCtrlCl);
      setUpCtrlCl(equipmentData.upCtrlCl);
    } else if (!upCtrlCl && isDataLoaded && !isWorkCompleted) {
      // 데이터 로드 완료 후에도 상향제어 값이 없으면 기본값 '01'(쌍방향) 설정
      console.log('[CompleteMoveRemoval] 상향제어 기본값 설정: 01 (쌍방향)');
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
        console.log('[WorkCompleteMoveRemoval] 고객 계약 목록 조회 시작:', custId);
        const contracts = await getCustomerContractInfo({ CUST_ID: custId });
        console.log('[WorkCompleteMoveRemoval] 고객 계약 목록:', contracts);
        setCustomerCtrtList(contracts || []);
      } catch (error) {
        console.error('[WorkCompleteMoveRemoval] 고객 계약 목록 조회 실패:', error);
        setCustomerCtrtList([]);
      }
    };

    loadCustomerContracts();
  }, [order.customer?.id, (order as any).CUST_ID, isWorkCompleted]);

  // VoIP/ISP 결합 계약 처리
  useEffect(() => {
    if (isWorkCompleted) return;
    if (customerCtrtList.length === 0) {
      console.log('[WorkCompleteMoveRemoval] 고객 계약 목록 대기 중...');
      return;
    }

    const prodGrp = (order as any).PROD_GRP || '';
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';
    const wrkStatCd = order.WRK_STAT_CD || '';
    const addrOrd = (order as any).ADDR_ORD || '';

    console.log('[WorkCompleteMoveRemoval] 결합계약 필터링 시작:', {
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

      console.log('[WorkCompleteMoveRemoval] VoIP 결합계약 필터링 결과:', filteredContracts);

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

      console.log('[WorkCompleteMoveRemoval] ISP 결합계약 필터링 결과:', filteredContracts);

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
    if (!installLocationText) errors.push('설치위치를 설정해주세요.');
    if (!workCompleteDate) errors.push('작업처리일을 선택해주세요.');

    // VoIP/ISP 결합계약 선택 validation
    const prodGrp = (order as any).PROD_GRP || '';
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';

    // VOIP 이전설치 시 이전철거 완료 필수 (레거시: mowoa03m06.xml Line 2015-2020)
    if (prodGrp === 'V' && order.WRK_CD === '07' && moveWorkInfo) {
      if (moveWorkInfo.WRK_STAT_CD !== '4') {
        errors.push('VOIP 상품의 경우 전화번호자원을 그대로 유지하므로 이전철거작업을 먼저 완료하셔야 합니다.');
      }
    }

    // LGHV STB 이전철거 미완료 차단 (레거시: mowoa03m06.xml Line 917-950)
    if (isLghvStb && moveWorkInfo && order.WRK_CD === '07') {
      const ctrtId = order.CTRT_ID || '';
      const oldCtrtId = moveWorkInfo.OLD_CTRT_ID || '';
      if (ctrtId !== oldCtrtId) {
        const oldWrkStatCd = moveWorkInfo.WRK_STAT_CD || '';
        if (oldWrkStatCd === '1' || oldWrkStatCd === '2') {
          const oldProdCd = moveWorkInfo.OLD_PROD_CD || '';
          if (lghvProdList.some((item: any) => item.PROD_CD === oldProdCd)) {
            errors.push('LGHV STB 상품의 경우, 이전철거가 먼저 완료처리 되어야 합니다.');
          }
        }
      }
    }

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

    // OTT 시리얼번호 검증 (레거시: mowoa03m01.xml 1709-1717)
    // OTT 상품인 경우 시리얼번호 필수 입력
    if (isOttRequired && !ottEqtSerno) {
      errors.push('OTT 판매용 상품은 OTT BOX 시리얼을 입력하셔야 합니다.');
    }

    // 장비 검증 (레거시 동일)
    // VoIP가 아닌 경우 장비가 최소 1개 이상 등록되어 있어야 함
    const installedEquipments = equipmentData?.installedEquipments || [];
    if (prodGrp !== 'V' && installedEquipments.length < 1) {
      errors.push('신호처리(장비등록)를 먼저 진행해주세요.');
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

  // 장비 목록 변환 함수 (nested → flat 구조)
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

    return equipments.map((eq: any) => {
      const eqtNo = eq.EQT_NO || eq.id || (eq.actualEquipment?.id) || '';
      const status = removalStatus[eqtNo] || {};
      // 회수 장비 필수 필드 - 5개 분실/파손 필드 모두 포함
      const removalFields = isRemoval ? {
        CRR_TSK_CL: order.WRK_CD || '07',
        RCPT_ID: order.RCPT_ID || '',
        CRR_ID: order.CRR_ID || user.crrId || '01',
        WRKR_ID: workerId,
        EQT_LOSS_YN: getYN(eq.EQT_LOSS_YN, status.EQT_LOSS_YN),
        PART_LOSS_BRK_YN: getYN(eq.PART_LOSS_BRK_YN, status.PART_LOSS_BRK_YN),
        EQT_BRK_YN: getYN(eq.EQT_BRK_YN, status.EQT_BRK_YN),
        EQT_CABL_LOSS_YN: getYN(eq.EQT_CABL_LOSS_YN, status.EQT_CABL_LOSS_YN),
        EQT_CRDL_LOSS_YN: getYN(eq.EQT_CRDL_LOSS_YN, status.EQT_CRDL_LOSS_YN),
      } : {};

      if (eq.actualEquipment) {
        const actual = eq.actualEquipment;
        const contract = eq.contractEquipment || {};
        return {
          ...actual,
          EQT_NO: actual.id,
          EQT_SERNO: actual.serialNumber,
          ITEM_MID_CD: actual.itemMidCd,
          EQT_CL_CD: actual.eqtClCd,
          MAC_ADDRESS: eq.macAddress || actual.macAddress,
          WRK_ID: order.id,
          CUST_ID: order.customer?.id,
          CTRT_ID: order.CTRT_ID,
          WRK_CD: order.WRK_CD,
          REG_UID: workerId,
          SVC_CMPS_ID: contract.SVC_CMPS_ID || eq.SVC_CMPS_ID || '',
          BASIC_PROD_CMPS_ID: contract.BASIC_PROD_CMPS_ID || eq.BASIC_PROD_CMPS_ID || '',
          PROD_CMPS_ID: contract.PROD_CMPS_ID || eq.PROD_CMPS_ID || '',
          SVC_CD: contract.SVC_CD || eq.SVC_CD || '',
          PROD_CD: contract.PROD_CD || eq.PROD_CD || '',
          LENT_YN: eq.lentYn || eq.LENT_YN || contract.LENT_YN || '',
          EQT_CHG_GB: eq.EQT_CHG_GB || '01',
          ...removalFields,
        };
      }

      // 중첩 구조가 아닌 경우도 필드 매핑 필요
      return {
        ...eq,
        EQT_NO: eq.EQT_NO || eq.id || '',
        EQT_SERNO: eq.EQT_SERNO || eq.serialNumber || '',
        ITEM_MID_CD: eq.ITEM_MID_CD || eq.itemMidCd || '',
        EQT_CL_CD: eq.EQT_CL_CD || eq.eqtClCd || '',
        MAC_ADDRESS: eq.MAC_ADDRESS || eq.macAddress || '',
        SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
        BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
        PROD_CD: eq.PROD_CD || '',
        SVC_CD: eq.SVC_CD || '',
        WRK_ID: order.id,
        CUST_ID: order.customer?.id,
        CTRT_ID: order.CTRT_ID,
        WRK_CD: order.WRK_CD,
        REG_UID: workerId,
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

    // FTTH 상품일 경우 CL-04 서비스 개통 등록 호출 (레거시: mowoa03m06.xml)
    // 레거시: OpLnkdCd가 F/FG/Z/ZG면 FTTH (cm_lib.js fn_get_eqipDivs)
    const isCertifyProd = certifyMode || isFtthProduct((order as any).OP_LNKD_CD);

    // 신호 차단 조건 (useCertifySignal 훅)
    const isCertifyProdForSignal = await checkCertifySignalBlocked(
      order.SO_ID || (order as any).SO_ID || '',
      (order as any).IS_CERTIFY_PROD,
    );

    // ADD_ON 파라미터 생성 (레거시: mowoa03m06.xml fn_certify_cl04 + modWorkComplete ds_where)
    // CL-04 호출과 workComplete 양쪽에 전달해야 하므로 상위 스코프에서 계산
    let addOnParam = '';
    if (isCertifyProd) {
      let prodPromoInfoForAddOn = equipmentData?.prodPromoInfo || [];
      if (prodPromoInfoForAddOn.length === 0) {
        try {
          console.log('[CompleteRelocate] prodPromoInfo 비어있음, getProdPromotionInfo fallback 호출 (ADD_ON용)');
          prodPromoInfoForAddOn = await getProdPromotionInfo({
            CTRT_ID: order.CTRT_ID || '',
            RCPT_ID: order.RCPT_ID || '',
            WRK_CD: order.WRK_CD || '07',
          });
          console.log('[CompleteRelocate] getProdPromotionInfo fallback 결과:', prodPromoInfoForAddOn.length, '개');
        } catch (e) { console.log('[CompleteRelocate] getProdPromotionInfo fallback 실패:', e); }
      }
      const addOnProdCodes = prodPromoInfoForAddOn
        .filter((item: any) =>
          (item.PROD_CMPS_CL === '21' || item.PROD_CMPS_CL === '22') &&
          (item.PROD_STAT_CD === '10' || item.PROD_STAT_CD === '20')
        )
        .map((item: any) => item.PROD_CD)
        .filter((code: string) => code);
      addOnParam = addOnProdCodes.length > 0 ? addOnProdCodes.join(',') + ',' : '';
      console.log('[CompleteRelocate] ADD_ON 파라미터:', addOnParam);
    }

    // 레거시: FTTH 상품이고 장비가 있으면 집선등록 필수
    const installedEquipments = equipmentData?.installedEquipments || [];
    if (isCertifyProd && installedEquipments.length > 0 && !certifyRegconfInfo) {
      showToast?.('집선등록 관련정보가 등록되어있지않습니다.', 'error');
      return;
    }

    if (isCertifyProd && certifyRegconfInfo) {
      try {
        // CERTIFY_TYPE 판별 + CL-04 (useCertifyComplete 훅)
        const oldCtrtId = (order as any).OLD_CTRT_ID || order.CTRT_ID || '';
        const { certifyType } = await determineCertifyType(order, workerId, oldCtrtId);

        if (certifyType) {
          const reason = certifyReason || (certifyType === 'C' ? '신규' : '이전');
          const contIdOld = certifyType === 'U'
            ? ((order.CTRT_ID || '') !== oldCtrtId ? oldCtrtId : (order.CTRT_ID || ''))
            : undefined;
          const cl04Result = await executeCL04Registration({
            order, workerId, certifyRegconfInfo, addOnParam,
            reason, certifyType, contIdOld,
          });
          if (!cl04Result.success) {
            showToast?.(`집선등록 실패: ${cl04Result.message}`, 'error');
            return;
          }
          console.log('[CompleteRelocate] CL-04 서비스 개통 등록 완료');
        }
      } catch (error: any) {
        console.error('[CompleteRelocate] CL-04 호출 에러:', error);
        showToast?.(`집선등록 중 오류: ${error.message || '알 수 없는 오류'}`, 'error');
        return;
      }
    }

    // 개통 신호 전송 (레거시: mowoa03m06.xml fn_signal_trans - SMR03/STB_CRT/SMR60)
    // 조건: CERTIFY_TG!='Y', WRK_CD=07이고 (ISP_PROD_CD 있거나 설치장비 있을 때)
    const installedEqList = equipmentData?.installedEquipments || [];
    const hasIspProd = !!(order as any).ISP_PROD_CD;
    if (!isCertifyProdForSignal && (hasIspProd || installedEqList.length > 0)) {
      try {
        const prodGrp = (order as any).PROD_GRP || '';
        let msgId = 'SMR03';
        let eqtNo = '';
        let etc1 = '';
        let etc2 = '';
        let etc3 = '';
        let etc4 = '';
        let voipJoinCtrtIdForSignal = '';

        // LGHV STB -> STB_CRT
        if (isLghvStb) {
          msgId = 'STB_CRT';
        }

        // VoIP 단독 -> SMR60
        if (prodGrp === 'V') {
          msgId = 'SMR60';
        }

        // prodPromoInfo에서 eqt_prod_cmps_id, prod_cd, prod_grp, sub_prod_cd 추출
        const prodPromoInfo = equipmentData?.prodPromoInfo || [];
        const eqtProdCmpsId = prodPromoInfo.find((item: any) => item.PROD_CMPS_CL === '23')?.PROD_CMPS_ID || '';
        const cmps11 = prodPromoInfo.find((item: any) => item.PROD_CMPS_CL === '11');
        const prodCd = cmps11?.PROD_CD || '';
        // 레거시: prod_grp는 prodPromoInfo(PROD_CMPS_CL=11).PROD_GRP에서 가져옴 (eqt_no/etc_3/etc_4에 사용)
        // v_Prod_Grp(=order.PROD_GRP)와 구분됨 - v_Prod_Grp는 msg_id SMR60, VoIP JOIN에만 사용
        const prodGrpFromPromo = cmps11?.PROD_GRP || prodGrp;
        // SUB_PROD_CD: BASIC_PROD_FL='V' 항목들의 PROD_CD 콤마 연결 (레거시 line 1467-1477)
        const subProds = prodPromoInfo
          .filter((item: any) => item.BASIC_PROD_FL === 'V')
          .map((item: any) => item.PROD_CD);
        const subProdCd = subProds.length > 0 ? subProds.join(',') : '';

        // 장비번호(eqt_no) 결정 - 레거시 우선순위: 05(CATV) > 01(안테나) > 03(모뎀) > 02(STB,인터넷만) > 08(VoIP)
        const findEqtNo = (itemMidCd: string) => {
          const eq = installedEqList.find((e: any) => {
            const actual = e.actualEquipment || e;
            return (actual.itemMidCd || actual.ITEM_MID_CD) === itemMidCd;
          });
          if (!eq) return '';
          const actual = eq.actualEquipment || eq;
          return actual.id || actual.EQT_NO || '';
        };

        if (!(order as any).VOIP_PROD_CD) {
          eqtNo = findEqtNo('05') || findEqtNo('01') || findEqtNo('03') ||
                  (prodGrpFromPromo === 'I' ? findEqtNo('02') : '') || findEqtNo('08') || '';
          // etc_1: STB(04) 장비번호
          etc1 = findEqtNo('04');
        } else {
          // VoIP 단독
          eqtNo = findEqtNo('08');
          etc1 = findEqtNo('02');
        }

        // etc_2: 스마트카드(07)
        etc2 = findEqtNo('07');
        // etc_3: 콤보(C) 상품이면 STB(02) - prodGrpFromPromo 사용 (레거시 line 1441)
        if (prodGrpFromPromo === 'C') {
          etc3 = findEqtNo('02');
        }
        // etc_4: VoIP 전용이면 AP(10), ISP면 가입자단말(21) - prodGrpFromPromo 사용 (레거시 line 1450)
        if (prodGrpFromPromo === 'V') {
          etc4 = findEqtNo('10');
        }
        if (hasIspProd) {
          etc4 = findEqtNo('21');
        }

        // VoIP/ISP 결합계약 ID
        if (prodGrp === 'V' || hasIspProd) {
          voipJoinCtrtIdForSignal = voipJoinCtrtId || order.CTRT_ID || '';
        }

        // wrk_id 결정 - 레거시 line 1458-1464: AP(091003)→EQT_NO, OTT-STB(092201)→MAC_ADDRESS, else→WRK_ID
        let signalWrkId = order.id || '';
        const apEquip = installedEqList.find((e: any) => {
          const actual = e.actualEquipment || e;
          return (actual.eqtClCd || actual.EQT_CL_CD) === '091003';
        });
        const ottStbEquip = installedEqList.find((e: any) => {
          const actual = e.actualEquipment || e;
          return (actual.eqtClCd || actual.EQT_CL_CD) === '092201';
        });
        if (apEquip) {
          const actual = apEquip.actualEquipment || apEquip;
          signalWrkId = actual.id || actual.EQT_NO || order.id || '';
        } else if (ottStbEquip) {
          const actual = ottStbEquip.actualEquipment || ottStbEquip;
          signalWrkId = actual.macAddress || actual.MAC_ADDRESS || order.id || '';
        }

        console.log('[CompleteRelocate] 개통 신호 호출:', { msgId, eqtNo, eqtProdCmpsId, prodCd, subProdCd, etc1, etc2, etc3, etc4, signalWrkId });

        const signalResult = await sendSignal({
          MSG_ID: msgId,
          CUST_ID: order.customer?.id || order.CUST_ID || '',
          CTRT_ID: order.CTRT_ID || '',
          SO_ID: order.SO_ID || '',
          EQT_NO: eqtNo,
          EQT_PROD_CMPS_ID: eqtProdCmpsId,
          PROD_CD: prodCd,
          ITV_USR_ID: '',
          IP_CNT: '',
          ETC_1: etc1,
          ETC_2: etc2,
          ETC_3: etc3,
          ETC_4: etc4,
          SUB_PROD_CD: subProdCd,
          IF_DTL_ID: '',
          WRK_ID: signalWrkId,
          REG_UID: workerId,
          VOIP_JOIN_CTRT_ID: voipJoinCtrtIdForSignal,
          WTIME: '3',
        });

        if (signalResult.code === 'SUCCESS' || signalResult.code === 'OK') {
          console.log('[CompleteRelocate] 개통 신호 전송 성공');
        } else {
          console.warn('[CompleteRelocate] 개통 신호 전송 실패:', signalResult.message);
          // VoIP 상품은 신호 실패해도 계속 진행 (레거시 동일)
          if (prodGrp !== 'V') {
            showToast?.('개통 신호 전송이 실패했습니다. 계속 진행합니다.', 'warning');
          }
        }
      } catch (error: any) {
        console.error('[CompleteRelocate] 개통 신호 전송 오류:', error);
        showToast?.('개통 신호 전송이 실패했습니다. 계속 진행합니다.', 'warning');
      }
    }

    // 회수 장비가 있으면 철거 신호(SMR05) 호출 (레거시 fn_delsignal_trans)
    // 레거시: CERTIFY_TG='Y'(인증상품)이면 철거신호 skip, LGHV STB이면 skip
    const removedEquipments = equipmentData?.removedEquipments || [];
    if (removedEquipments.length > 0 && !isCertifyProdForSignal && !isLghvStb) {
      // 레거시 del_signal_flag: HANDY/AP만 있으면 철거신호 skip
      let delSignalFlag = false;
      for (const eq of removedEquipments) {
        const actual = eq.actualEquipment || eq;
        const eqtClCd = actual.eqtClCd || actual.EQT_CL_CD || '';
        if (eqtClCd === '090901' || eqtClCd === '091001' || eqtClCd === '091005') continue;
        delSignalFlag = true;
      }

      // 레거시: WRK_CD=07 + PROD_GRP='V'(VoIP) → 철거신호 skip
      const prodGrpForDel = (order as any).PROD_GRP || '';
      if (order.WRK_CD === '07' && prodGrpForDel === 'V') {
        delSignalFlag = false;
      }

      if (delSignalFlag) {
        try {
          // eqt_prod_cmps_id: 레거시는 ds_rmv_prod_info PROD_CMPS_CL=23에서 가져옴
          const removedProdPromo = equipmentData?.removedProdPromoInfo || equipmentData?.prodPromoInfo || [];
          const delEqtProdCmpsId = removedProdPromo.find?.((item: any) => item.PROD_CMPS_CL === '23')?.PROD_CMPS_ID || '';

          // VoIP JOIN CTRT_ID
          let delVoipJoinCtrtId = '';
          if (prodGrpForDel === 'V') {
            delVoipJoinCtrtId = !(order as any).VOIP_PROD_CD
              ? (voipJoinCtrtId || order.CTRT_ID || '')
              : (order.CTRT_ID || '');
          }

          console.log('[CompleteRelocate] 철거 신호 호출:', { msgId: 'SMR05', delEqtProdCmpsId, prodGrpForDel });

          // 레거시: eqt_no="", prod_cd="", etc_1~4 모두 빈값, wtime="3"
          const result = await sendSignal({
            MSG_ID: 'SMR05',
            CUST_ID: order.customer?.id || order.CUST_ID || '',
            CTRT_ID: order.CTRT_ID || '',
            SO_ID: order.SO_ID || '',
            EQT_NO: '',
            EQT_PROD_CMPS_ID: delEqtProdCmpsId,
            PROD_CD: '',
            WRK_ID: order.id || '',
            REG_UID: workerId,
            ETC_1: '',
            ETC_2: '',
            ETC_3: '',
            ETC_4: '',
            VOIP_JOIN_CTRT_ID: delVoipJoinCtrtId,
            WTIME: '3',
          });

          if (result.code !== 'SUCCESS' && result.code !== 'OK') {
            const errCode = result.O_IFSVC_RESULT?.substring(14, 20) || '';
            if (errCode !== '029' && result.message?.indexOf('PROC_VOIP_KCT-029') === -1) {
              console.warn('[CompleteRelocate] 철거 신호 실패 - 작업완료 중단:', result.message);
              showToast?.('철거 신호 전송에 실패했습니다.', 'error', true);
              return;
            }
          } else {
            console.log('[CompleteRelocate] 철거 신호 호출 완료');
          }
        } catch (error) {
          console.error('[CompleteRelocate] 철거 신호 처리 중 오류:', error);
          showToast?.('철거 신호 전송에 실패했습니다.', 'error', true);
          return;
        }
      }
    } else if (removedEquipments.length > 0 && isLghvStb) {
      console.log('[CompleteRelocate] LGHV STB 상품 - 철거신호 skip (레거시 동일)');
    }

    // 분실처리는 modWorkComplete에서 rmvEqtList로 일괄 처리됨 (별도 custEqtInfoDel 호출 불필요)

    const completeData: WorkCompleteData = {
      workInfo: {
        WRK_ID: order.id,
        WRK_CD: order.WRK_CD,
        WRK_DTL_TCD: order.WRK_DTL_TCD,
        CUST_ID: order.customer?.id,
        CTRT_ID: order.CTRT_ID || '',
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
        INSTL_LOC: installLocationText || '',
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
        // WRK_CD=07: 이전설치 시 이전 계약번호 (상품변경으로 계약번호 변경 시 필요)
        OLD_CTRT_ID: (order as any).OLD_CTRT_ID || '',
        // WRK_CD=07 전용: 고객주소/납부자주소 변경 여부
        CHK_CUST_ADDR: isMoveRemoval ? (chkCustAddr ? 'true' : 'false') : '',
        CHK_PYM_ADDR: isMoveRemoval ? (chkPymAddr ? 'true' : 'false') : '',
        ADD_ON: addOnParam || '',
      },
      equipmentList: processEquipmentList(equipmentData?.installedEquipments || [], false),
      removeEquipmentList: processEquipmentList(equipmentData?.removedEquipments || [], true),
      spendItemList: equipmentData?.spendItems || [],
      agreementList: equipmentData?.agreements || [],
      poleList: poleCheckResult ? [{
        WRK_ID: order.id,
        POLE_YN: poleCheckResult.POLE_YN,
        LAN_GB: poleCheckResult.LAN_GB || '',
        REG_UID: workerId,
      }] : []
    };

    submitWork(completeData, {
      onSuccess: (result) => {
        if (result.code === 'SUCCESS' || result.code === 'OK') {
          localStorage.removeItem(getStorageKey());
          (order as any).WRK_STAT_CD = '3';
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
                  className={`px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap ${isWorkCompleted ? 'bg-gray-500 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '설치정보'}
                </button>
              </div>
            </div>

            {/* 고객관계 + 철거이전정보 버튼 */}
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
                  <span>{installLocationText || '미설정'}</span>
                  {viewModNm && <span className="ml-2 text-xs text-gray-500">(시청: {viewModNm})</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallLocationModal(true)}
                  className={`min-h-10 px-3 sm:px-4 rounded-lg font-bold text-sm whitespace-nowrap flex items-center gap-1.5 ${isWorkCompleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                >
                  <MapPin className="w-4 h-4" />
                  <span>{isWorkCompleted ? '보기' : '설정'}</span>
                </button>
              </div>
            </div>

            {/* 상향제어 - DTV(KPI_PROD_GRP_CD='D')일 때만 표시 */}
            {(equipmentData?.kpiProdGrpCd === 'D' || equipmentData?.prodGrp === 'D' || (order as any).PROD_GRP === 'D') && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">상향제어</label>
                <Select value={upCtrlCl} onValueChange={setUpCtrlCl} options={upCtrlClOptions}
                  placeholder="선택" disabled={isWorkCompleted} />
              </div>
            )}

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
        addrOrd={(order as any).ADDR_ORD || ''}
        kpiProdGrpCd={(order as any).KPI_PROD_GRP_CD || ''}
        prodChgGb={(order as any).PROD_CHG_GB || ''}
        chgKpiProdGrpCd={(order as any).CHG_KPI_PROD_GRP_CD || ''}
        prodGrp={(order as any).PROD_GRP || ''}
        wrkDtlTcd={order.WRK_DTL_TCD || ''}
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
        initialInstlLoc={installLocationText}
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

      {/* 철거이전정보 모달 (WRK_CD=07) */}
      <MoveWorkInfoModal
        isOpen={showMoveWorkInfoModal}
        onClose={() => setShowMoveWorkInfoModal(false)}
        wrkCd={order.WRK_CD}
        wrkId={order.id}
        rcptId={order.RCPT_ID}
      />

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
        crrId={(order as any).CRR_ID || ''}
        wrkrId={(order as any).WRKR_ID || ''}
        dataType={ottDataType}
        showToast={showToast}
        readOnly={isWorkCompleted}
      />
    </div>
  );
};

export default CompleteRelocate;
