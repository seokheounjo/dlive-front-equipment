import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { getCompleteButtonText } from '../../../../utils/workValidation';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail, getCustomerContractInfo, checkStbServerConnection } from '../../../../services/apiService';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import InstallLocationModal, { InstallLocationData } from '../../../modal/InstallLocationModal';
import ConfirmModal from '../../../common/ConfirmModal';
import WorkCompleteSummary from '../WorkCompleteSummary';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useWorkEquipment } from '../../../../stores/workEquipmentStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import '../../../../styles/buttons.css';

/**
 * CompleteInstall - 설치(WRK_CD=01) 작업완료 컴포넌트
 *
 * 레거시 참조: mowoa03m01.xml
 *
 * 특징:
 * - 설치정보 입력 (망구분, 배선유형 등)
 * - 설치위치 설정
 * - 상향제어 설정
 * - 서비스 이용구분 (인터넷/VoIP/디지털방송)
 * - 장비등록/회수/변경 버튼 모두 표시 (3단계에서 처리)
 */
interface CompleteInstallProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteInstall: React.FC<CompleteInstallProps> = ({
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

  // Zustand Store
  const { equipmentData: storeEquipmentData, filteringData } = useWorkProcessStore();

  // Zustand Equipment Store - 장비 컴포넌트에서 등록한 장비 정보
  const workId = order.id || '';
  const zustandEquipment = useWorkEquipment(workId);

  // equipmentData 병합: Zustand Equipment Store의 installedEquipments 우선 사용
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

  // React Query Mutation
  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  // localStorage 키
  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 기본 정보 State
  const [custRel, setCustRel] = useState('');
  const [upCtrlCl, setUpCtrlCl] = useState('');
  const [memo, setMemo] = useState('');

  // 설치정보 모달
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [networkTypeName, setNetworkTypeName] = useState('');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);

  // 연동이력 모달
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);

  // 설치위치 모달
  const [showInstallLocationModal, setShowInstallLocationModal] = useState(false);
  const [installLocationText, setInstallLocationText] = useState('');
  const [viewModCd, setViewModCd] = useState('');
  const [viewModNm, setViewModNm] = useState('');

  // 서비스 이용 구분
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

  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  // 공통코드 옵션
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);
  const [upCtrlClOptions, setUpCtrlClOptions] = useState<{ value: string; label: string }[]>([]);
  const [internetOptions, setInternetOptions] = useState<{ value: string; label: string }[]>([]);
  const [voipOptions, setVoipOptions] = useState<{ value: string; label: string }[]>([]);
  const [dtvOptions, setDtvOptions] = useState<{ value: string; label: string }[]>([]);

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

  // 데이터 복원 - 완료된 작업은 getWorkReceiptDetail API 호출
  useEffect(() => {
    if (isWorkCompleted) {
      console.log('[WorkCompleteInstall] 완료된 작업 - getWorkReceiptDetail API 호출');

      const fetchCompletedWorkDetail = async () => {
        try {
          const detail = await getWorkReceiptDetail({
            WRK_DRCTN_ID: order.directionId || order.WRK_DRCTN_ID || '',
            WRK_ID: order.id,  // order.id가 실제 WRK_ID
            SO_ID: order.SO_ID
          });

          if (detail) {
            console.log('[WorkCompleteInstall] API 응답:', detail);

            const instlLocFull = detail.INSTL_LOC || '';
            if (instlLocFull.includes('¶')) {
              const [locText, viewCd] = instlLocFull.split('¶');
              setInstallLocationText(locText);
              setViewModCd(viewCd);
            } else {
              setInstallLocationText(instlLocFull);
              setViewModCd(detail.VIEW_MOD_CD || '');
              setViewModNm(detail.VIEW_MOD_NM || '');
            }

            // 상향제어: API 응답에 없으면 장비 데이터(output1)에서 가져옴
            const upCtrlClValue = detail.UP_CTRL_CL || equipmentData?.upCtrlCl || '';
            console.log('[CompleteInstall] 상향제어 값:', { API: detail.UP_CTRL_CL, 장비데이터: equipmentData?.upCtrlCl, 최종: upCtrlClValue });
            setUpCtrlCl(upCtrlClValue);
            setInternetUse(detail.PSN_USE_CORP || '');
            setVoipUse(detail.VOIP_USE_CORP || '');
            setDtvUse(detail.DTV_USE_CORP || '');
            setNetworkType(detail.NET_CL || '');
            setNetworkTypeName(detail.NET_CL_NM || '');

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

            setCustRel(detail.CUST_REL || '');
            setMemo((detail.MEMO || '').replace(/\\n/g, '\n'));

            // 결합계약 ID 복원
            if (detail.VOIP_JOIN_CTRT_ID) {
              setVoipJoinCtrtId(detail.VOIP_JOIN_CTRT_ID);
            }

            // 작업처리일 복원
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          } else {
            // API 실패 시 order에서 복원 시도 (fallback)
            console.log('[WorkCompleteInstall] API 실패 - order에서 복원 시도');
            setCustRel(order.CUST_REL || '');
            setNetworkType(order.NET_CL || '');
            setNetworkTypeName(order.NET_CL_NM || '');
          }
        } catch (error) {
          console.error('[WorkCompleteInstall] API 호출 실패:', error);
          setCustRel(order.CUST_REL || '');
          setNetworkType(order.NET_CL || '');
          setNetworkTypeName(order.NET_CL_NM || '');
        } finally {
          setIsDataLoaded(true);
        }
      };

      fetchCompletedWorkDetail();
      return;
    }

    // localStorage에서 복원
    const savedDraft = localStorage.getItem(getStorageKey());
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        setCustRel(draftData.custRel || '');
        setUpCtrlCl(draftData.upCtrlCl || '');
        setMemo(draftData.memo || '');
        setInternetUse(draftData.internetUse || '');
        setVoipUse(draftData.voipUse || '');
        setDtvUse(draftData.dtvUse || '');
        setNetworkType(draftData.networkType || '');
        setNetworkTypeName(draftData.networkTypeName || '');
        setInstallInfoData(draftData.installInfoData);
        setInstallLocationText(draftData.installLocationText || '');
        setViewModCd(draftData.viewModCd || '');
        setViewModNm(draftData.viewModNm || '');
        if (draftData.voipJoinCtrtId) {
          setVoipJoinCtrtId(draftData.voipJoinCtrtId);
        }
      } catch (error) {
        console.error('[WorkCompleteInstall] localStorage 복원 실패:', error);
      }
    }
    setIsDataLoaded(true);
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;

    const draftData = {
      custRel, upCtrlCl, memo,
      internetUse, voipUse, dtvUse,
      networkType, networkTypeName,
      installInfoData,
      installLocationText, viewModCd, viewModNm,
      voipJoinCtrtId,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, upCtrlCl, memo, internetUse, voipUse, dtvUse, networkType, networkTypeName, installInfoData, installLocationText, viewModCd, viewModNm, voipJoinCtrtId, isDataLoaded, isWorkCompleted]);

  // 공통코드 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const codes = await getCommonCodeList(['CMCU005', 'CMCT015', 'CMCU057', 'CMCU110', 'CMCU148']);

        if (codes['CMCU005']) {
          setCustRelOptions(codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
        if (codes['CMCT015']) {
          console.log('[CompleteInstall] 공통코드 CMCT015 옵션:', codes['CMCT015']);
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
        console.error('[WorkCompleteInstall] 초기 데이터 로드 실패:', error);
      }
    };

    loadInitialData();
  }, []);

  // 상향제어: equipmentData가 나중에 로드되면 업데이트, 없으면 기본값 '01'(쌍방향) 설정
  useEffect(() => {
    if (equipmentData?.upCtrlCl && !upCtrlCl) {
      console.log('[CompleteInstall] equipmentData에서 상향제어 업데이트:', equipmentData.upCtrlCl);
      setUpCtrlCl(equipmentData.upCtrlCl);
    } else if (!upCtrlCl && isDataLoaded && !isWorkCompleted) {
      // 데이터 로드 완료 후에도 상향제어 값이 없으면 기본값 '01'(쌍방향) 설정
      console.log('[CompleteInstall] 상향제어 기본값 설정: 01 (쌍방향)');
      setUpCtrlCl('01');
    }
  }, [equipmentData?.upCtrlCl, isDataLoaded, isWorkCompleted, upCtrlCl]);

  // 고객 계약 목록 로드 (결합계약 선택용)
  useEffect(() => {
    if (isWorkCompleted) return;

    const custId = order.customer?.id || (order as any).CUST_ID || (order as any).customerId;
    console.log('[WorkCompleteInstall] CUST_ID 확인:', {
      'order.customer?.id': order.customer?.id,
      'order.CUST_ID': (order as any).CUST_ID,
      'order.customerId': (order as any).customerId,
      custId
    });
    if (!custId) {
      console.log('[WorkCompleteInstall] CUST_ID 없음 - 고객 계약 조회 스킵');
      return;
    }

    const loadCustomerContracts = async () => {
      try {
        console.log('[WorkCompleteInstall] 고객 계약 목록 조회 시작:', custId);
        const contracts = await getCustomerContractInfo({ CUST_ID: custId });
        console.log('[WorkCompleteInstall] 고객 계약 목록:', contracts);
        setCustomerCtrtList(contracts || []);
      } catch (error) {
        console.error('[WorkCompleteInstall] 고객 계약 목록 조회 실패:', error);
        setCustomerCtrtList([]);
      }
    };

    loadCustomerContracts();
  }, [order.customer?.id, (order as any).CUST_ID, isWorkCompleted]);

  // VoIP/ISP 결합 계약 처리 (레거시: mowoa03m01.xml 2064-2145)
  // PROD_GRP=V: VoIP는 DTV/ISP/번들과 결합 필요
  // PROD_GRP=I: ISP는 DTV/번들과 결합 필요
  useEffect(() => {
    if (isWorkCompleted) return;
    // customerCtrtList가 로드될 때까지 대기
    if (customerCtrtList.length === 0) {
      console.log('[WorkCompleteInstall] 고객 계약 목록 대기 중...');
      return;
    }

    const prodGrp = (order as any).PROD_GRP || '';
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';
    const wrkStatCd = order.WRK_STAT_CD || '';
    const addrOrd = (order as any).ADDR_ORD || '';

    console.log('[WorkCompleteInstall] 결합계약 필터링 시작:', {
      prodGrp, voipProdCd, ispProdCd, wrkStatCd, addrOrd,
      customerCtrtListCount: customerCtrtList.length
    });

    // PROD_GRP=V (VoIP) 일 때: VOIP_PROD_CD가 없으면 결합계약 선택 필요
    if (prodGrp === 'V' && !voipProdCd) {
      // DTV(D), ISP(I), 번들(C) 계약 중 CTRT_STAT='20'(활성)이고 같은 주소인 것만 필터
      const filteredContracts = customerCtrtList.filter((ctrt: any) => {
        const ctrtProdGrp = ctrt.PROD_GRP || '';
        const ctrtStat = ctrt.CTRT_STAT || '';
        const ctrtAddrOrd = ctrt.ADDR_ORD || ctrt.addr_ord || '';
        return (ctrtProdGrp === 'C' || ctrtProdGrp === 'D' || ctrtProdGrp === 'I')
          && ctrtStat === '20'
          && (!addrOrd || ctrtAddrOrd === addrOrd);
      });

      console.log('[WorkCompleteInstall] VoIP 결합계약 필터링 결과:', filteredContracts);

      if (filteredContracts.length < 1 && wrkStatCd === '2') {
        // 접수 상태에서만 경고 토스트 표시 (뒤로가기 없음)
        showToast?.('VOIP와 결합될 DTV, ISP 계약이 없습니다. ISP나 DTV 설치완료 후 작업하여 주십시오.', 'warning');
      }

      // 결합계약 드롭다운 옵션 설정
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

    // PROD_GRP=I (ISP) 일 때: ISP_PROD_CD가 있으면 결합계약 선택 필요
    if (prodGrp === 'I' && ispProdCd) {
      // DTV(D), 번들(C) 계약 중 CTRT_STAT='20', ISP_JOIN_ID 없음, KPI_PROD_GRP_CD='D' 필터
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

      console.log('[WorkCompleteInstall] ISP 결합계약 필터링 결과:', filteredContracts);

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

    // 그 외에는 결합계약 선택 필요 없음
    setShowJoinCtrt(false);
    setJoinCtrtOptions([]);
  }, [order.id, order.WRK_STAT_CD, isWorkCompleted, showToast, customerCtrtList]);

  // 검증
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!custRel || custRel === '[]') {
      errors.push('고객과의 관계를 선택해주세요.');
    }
    if (!installInfoData?.NET_CL) {
      errors.push('설치정보를 입력해주세요.');
    }
    if (!order.installLocation && !installLocationText) {
      errors.push('설치위치를 설정해주세요.');
    }
    if (!workCompleteDate) {
      errors.push('작업처리일을 선택해주세요.');
    }

    // VoIP/ISP 결합계약 선택 validation (레거시: mowoa03m01.xml 1598-1614)
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

    // 장비 등록 검증 (레거시: mowoa03m01.xml 1327줄)
    // VoIP가 아닌 경우 장비가 최소 1개 이상 등록되어 있어야 함
    const installedEquipments = equipmentData?.installedEquipments || [];
    if (prodGrp !== 'V' && installedEquipments.length < 1) {
      errors.push('신호처리(장비등록)를 먼저 진행해주세요.');
    }

    return errors;
  };

  // 설치정보 모달 핸들러
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

    const message = equipmentData?.installedEquipments?.length > 0
      ? '작업을 완료하시겠습니까?\n(신호번호 처리업무도 동시에 처리됩니다.)'
      : '작업을 완료하시겠습니까?';

    setConfirmMessage(message);
    setShowConfirmModal(true);
  };

  // 실제 작업 완료 처리
  const handleConfirmSubmit = async () => {
    console.log('[WorkCompleteInstall] 작업완료 처리 시작');

    const formattedDate = workCompleteDate.replace(/-/g, '');
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';

    // 회수 장비가 있으면 철거 신호(SMR05) 호출 (레거시 fn_delsignal_trans 동일)
    const removedEquipments = equipmentData?.removedEquipments || [];
    if (removedEquipments.length > 0) {
      try {
        const regUid = user.userId || user.id || 'UNKNOWN';
        const firstEquip = removedEquipments[0];
        console.log('[CompleteInstall] 철거 신호(SMR05) 호출:', { eqtNo: firstEquip.EQT_NO || firstEquip.id });
        await checkStbServerConnection(
          regUid,
          order.CTRT_ID || '',
          order.id,
          'SMR05',
          firstEquip.EQT_NO || firstEquip.id || '',
          ''
        );
        console.log('[CompleteInstall] 철거 신호(SMR05) 호출 완료');
      } catch (error) {
        console.log('[CompleteInstall] 철거 신호 처리 중 오류 (무시하고 계속 진행):', error);
      }
    }

    // 장비 데이터 처리
    const processEquipmentList = (equipments: any[], isRemoval = false) => {
      if (!equipments || equipments.length === 0) return [];
      const removalStatus = equipmentData?.removalStatus || {};
      return equipments.map((eq: any) => {
        const eqtNo = eq.EQT_NO || eq.id || (eq.actualEquipment?.id) || '';
        const status = removalStatus[eqtNo] || {};
        // 회수 장비 필수 필드 (레거시 기준)
        const removalFields = isRemoval ? {
          CRR_TSK_CL: order.WRK_CD || '01',
          RCPT_ID: order.RCPT_ID || '',
          CRR_ID: order.CRR_ID || user.crrId || '01',
          WRKR_ID: workerId,
          EQT_LOSS_YN: status.isLost ? 'Y' : 'N',
          EQT_BRK_YN: status.isDamaged ? 'Y' : 'N',
          REUSE_YN: status.isReusable ? '1' : '0',
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
            SVC_CMPS_ID: contract.id || contract.SVC_CMPS_ID || actual.SVC_CMPS_ID,
            BASIC_PROD_CMPS_ID: actual.BASIC_PROD_CMPS_ID || contract.BASIC_PROD_CMPS_ID || '',
            EQT_PROD_CMPS_ID: actual.EQT_PROD_CMPS_ID || contract.id,
            PROD_CD: actual.PROD_CD || contract.PROD_CD || order.PROD_CD || '',
            SVC_CD: actual.SVC_CD || contract.SVC_CD || '',
            EQT_SALE_AMT: actual.EQT_SALE_AMT || '0',
            MST_SO_ID: actual.MST_SO_ID || order.SO_ID || '',
            SO_ID: actual.SO_ID || order.SO_ID || '',
            REG_UID: workerId,
            CHG_UID: workerId,  // 레거시 mowoa03m01.xml:1828
            OLD_LENT_YN: actual.OLD_LENT_YN || 'N',
            LENT: actual.LENT || '10',
            LENT_KND: actual.LENT_KND || '',  // 레거시 mowoa03m01.xml:1145
            ITLLMT_PRD: actual.ITLLMT_PRD || '00',
            EQT_USE_STAT_CD: actual.EQT_USE_STAT_CD || '1',
            EQT_CHG_GB: '1',
            IF_DTL_ID: actual.IF_DTL_ID || '',
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
          WRK_ID: eq.WRK_ID || order.id,
          CUST_ID: eq.CUST_ID || order.customer?.id,
          CTRT_ID: eq.CTRT_ID || order.CTRT_ID,
          WRK_CD: eq.WRK_CD || order.WRK_CD,
          REG_UID: workerId,
          CHG_UID: workerId,  // 레거시 mowoa03m01.xml:1828
          LENT_KND: eq.LENT_KND || '',  // 레거시 mowoa03m01.xml:1145
          ...removalFields,
        };
      });
    };

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
        CNFM_CUST_NM: order.customer?.name,
        CNFM_CUST_TELNO: order.customer?.contactNumber || '',
        REQ_CUST_TEL_NO: order.customer?.contactNumber || '',
        INSTL_LOC: order.installLocation || installLocationText || '',
        UP_CTRL_CL: upCtrlCl || '',
        PSN_USE_CORP: internetUse || '',
        VOIP_USE_CORP: voipUse || '',
        DTV_USE_CORP: dtvUse || '',
        WRK_ACT_CL: '20',
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '',
        CB_WRNG_TP: installInfoData?.CB_WRNG_TP || '',
        CB_INSTL_TP: installInfoData?.CB_INSTL_TP || '',
        INOUT_LINE_TP: installInfoData?.INOUT_LINE_TP || '',
        INOUT_LEN: installInfoData?.INOUT_LEN || '',
        DVDR_YN: installInfoData?.DVDR_YN || '',
        BFR_LINE_YN: installInfoData?.BFR_LINE_YN || '',
        CUT_YN: installInfoData?.CUT_YN || '',
        TERM_NO: installInfoData?.TERM_NO || '',
        RCV_STS: installInfoData?.RCV_STS || '',
        SUBTAP_ID: installInfoData?.SUBTAP_ID || '',
        PORT_NUM: installInfoData?.PORT_NUM || '',
        EXTN_TP: installInfoData?.EXTN_TP || '',
        TAB_LBL: installInfoData?.TAB_LBL || '',
        CVT_LBL: installInfoData?.CVT_LBL || '',
        STB_LBL: installInfoData?.STB_LBL || '',
        KPI_PROD_GRP: '',
        OBS_RCPT_CD: '',
        OBS_RCPT_DTL_CD: '',
        VOIP_JOIN_CTRT_ID: voipJoinCtrtId || '',
        AGREE_YN: '',
        ISP_YN: '',
        AGREE_GB: '',
        CUST_CLEAN_YN: '',
        EQT_RMV_FLAG: '',
        TV_TYPE: ''
      },
      equipmentList: processEquipmentList(equipmentData?.installedEquipments || [], false),
      removeEquipmentList: processEquipmentList(equipmentData?.removedEquipments || [], true),
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
    <div className="px-2 sm:px-4 py-4 sm:py-6 bg-gray-50 min-h-0">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          <div className="space-y-3 sm:space-y-5">
            {/* 결합계약 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                결합계약 {showJoinCtrt && !isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              {showJoinCtrt ? (
                <Select
                  value={voipJoinCtrtId}
                  onValueChange={setVoipJoinCtrtId}
                  options={joinCtrtOptions}
                  placeholder="결합계약 선택"
                  required
                  disabled={isWorkCompleted}
                />
              ) : (
                <input
                  type="text"
                  value=""
                  readOnly
                  disabled
                  className="w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed"
                />
              )}
            </div>

            {/* 망구분 + 설치정보 버튼 */}
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
                  placeholder="설치정보에서 입력"
                  className="flex-1 min-w-0 min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed truncate"
                />
                <button
                  type="button"
                  onClick={() => setShowInstallInfoModal(true)}
                  className={`min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${isWorkCompleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '설치정보'}
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

            {/* 설치위치 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                설치위치 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <div className="flex gap-1.5 sm:gap-2">
                <div className="flex-1 flex items-center min-w-0 min-h-10 sm:min-h-12 px-3 sm:px-4 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-xs sm:text-sm">
                  <span className="truncate">{installLocationText || order.installLocation || '미설정'}</span>
                  {viewModNm && <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-500 flex-shrink-0 whitespace-nowrap">(시청: {viewModNm})</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallLocationModal(true)}
                  className={`min-h-10 sm:min-h-12 px-3 sm:px-4 rounded-lg font-bold transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-shrink-0 ${
                    isWorkCompleted
                      ? 'bg-gray-500 hover:bg-gray-600 text-white'
                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  }`}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{isWorkCompleted ? '보기' : '설정'}</span>
                </button>
              </div>
            </div>

            {/* 상향제어 - DTV(KPI_PROD_GRP_CD='D')일 때만 표시 */}
            {(equipmentData?.kpiProdGrpCd === 'D' || equipmentData?.prodGrp === 'D' || (order as any).PROD_GRP === 'D') && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                  상향제어
                </label>
                <Select
                  value={upCtrlCl}
                  onValueChange={setUpCtrlCl}
                  options={upCtrlClOptions}
                  placeholder="선택"
                  disabled={isWorkCompleted}
                />
              </div>
            )}

            {/* 처리내용 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                처리내용
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="작업 내용을 입력하세요..."
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base resize-none ${isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
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

            {/* 타사이용여부 (접기/펼치기) */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsServiceUseExpanded(!isServiceUseExpanded)}
                className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-xs sm:text-sm font-semibold text-gray-700">타사이용여부</span>
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
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 bg-white">
                  {/* DTV(디지털이용) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      DTV (디지털이용)
                    </label>
                    <Select
                      value={dtvUse}
                      onValueChange={setDtvUse}
                      options={dtvOptions}
                      placeholder="선택"
                      disabled={isWorkCompleted}
                    />
                  </div>

                  {/* ISP(인터넷이용) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      ISP (인터넷이용)
                    </label>
                    <Select
                      value={internetUse}
                      onValueChange={setInternetUse}
                      options={internetOptions}
                      placeholder="선택"
                      disabled={isWorkCompleted}
                    />
                  </div>

                  {/* VoIP(VoIP이용) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      VoIP (VoIP이용)
                    </label>
                    <Select
                      value={voipUse}
                      onValueChange={setVoipUse}
                      options={voipOptions}
                      placeholder="선택"
                      disabled={isWorkCompleted}
                    />
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
                  className="flex-1 btn btn-lg btn-primary flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

      {/* 설치정보 모달 */}
      <InstallInfoModal
        isOpen={showInstallInfoModal}
        onClose={() => setShowInstallInfoModal(false)}
        onSave={handleInstallInfoSave}
        workId={order.id}
        initialData={installInfoData}
        workType={order.WRK_CD}
        customerId={order.customer.id}
        customerName={order.customer.name}
        contractId={order.CTRT_ID}
        addrOrd={(order as any).ADDR_ORD || ''}
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD || (order as any).KPI_PROD_GRP_CD}
        prodChgGb={equipmentData?.prodChgGb || equipmentData?.PROD_CHG_GB || (order as any).PROD_CHG_GB}
        chgKpiProdGrpCd={equipmentData?.chgKpiProdGrpCd || equipmentData?.CHG_KPI_PROD_GRP_CD || (order as any).CHG_KPI_PROD_GRP_CD}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP || (order as any).PROD_GRP}
        wrkDtlTcd={order.WRK_DTL_TCD}
        readOnly={isWorkCompleted}
      />

      {/* 연동이력 모달 */}
      <IntegrationHistoryModal
        isOpen={showIntegrationHistoryModal}
        onClose={() => setShowIntegrationHistoryModal(false)}
        ctrtId={order.CTRT_ID}
        custId={order.customer.id}
      />

      {/* 설치위치 모달 */}
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
        message={confirmMessage}
        type="confirm"
        confirmText="완료"
        cancelText="취소"
      >
        <WorkCompleteSummary
          workType="01"
          workTypeName="설치"
          custRel={custRel}
          custRelName={custRelOptions.find(o => o.value === custRel)?.label}
          networkType={networkType}
          networkTypeName={networkTypeName}
          upCtrlCl={upCtrlCl}
          upCtrlClName={upCtrlClOptions.find(o => o.value === upCtrlCl)?.label}
          installedEquipments={equipmentData?.installedEquipments || []}
          removedEquipments={equipmentData?.removedEquipments || []}
          installLocation={installLocationText ? {
            position: installLocationText,
          } : undefined}
          memo={memo}
        />
      </ConfirmModal>
    </div>
  );
};

export default CompleteInstall;
