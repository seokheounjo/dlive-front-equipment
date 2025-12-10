import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkCompleteData } from '../../types';
import { getCompleteButtonText } from '../../utils/workValidation';
import { getCommonCodeList, CommonCode } from '../../services/apiService';
import Select from '../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../modal/InstallInfoModal';
import IntegrationHistoryModal from '../modal/IntegrationHistoryModal';
import InstallLocationModal, { InstallLocationData } from '../modal/InstallLocationModal';
import { useWorkProcessStore } from '../../stores/workProcessStore';
import { useCompleteWork } from '../../hooks/mutations/useCompleteWork';
import '../../styles/buttons.css';

interface WorkCompleteFormProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any; // 하위 호환성을 위해 유지하지만 deprecated
  readOnly?: boolean; // 완료된 작업 - 읽기 전용 모드
}

const WorkCompleteForm: React.FC<WorkCompleteFormProps> = ({ order, onBack, onSuccess, showToast, equipmentData: legacyEquipmentData, readOnly = false }) => {
  // 완료된 작업 여부 확인 (레거시: WRK_STAT_CD === '4')
  const isWorkCompleted = readOnly || order.WRK_STAT_CD === '4' || order.status === '완료';

  // 철거 작업 여부 (WRK_CD: 02=해지, 07=철거이전, 08=철거해지)
  const isRemovalWork = order.WRK_CD === '02' || order.WRK_CD === '07' || order.WRK_CD === '08';

  // 장비철거 버튼 표시 여부 (레거시: SO_ID가 '403'이면 숨김, VOIP_CTX 있으면 비활성화)
  const showEquipmentRemovalButton = isRemovalWork && order.SO_ID !== '403';
  const isEquipmentRemovalEnabled = !order.VOIP_CTX; // VOIP_CTX가 없어야 활성화

  const [isDataLoaded, setIsDataLoaded] = useState(false); // 초기 데이터 로드 완료 여부

  // Work Process Store에서 장비 데이터 가져오기 (Zustand)
  const { equipmentData: storeEquipmentData, filteringData } = useWorkProcessStore();

  // Store 데이터 우선, 없으면 prop 사용 (하위 호환성)
  const equipmentData = storeEquipmentData || legacyEquipmentData || filteringData;

  // React Query Mutation - 작업 완료
  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  // localStorage 키 생성
  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 기본 정보
  const [custRel, setCustRel] = useState(''); // 고객관계
  const [instlLoc, setInstlLoc] = useState(''); // 설치위치 코드
  const [instlLocText, setInstlLocText] = useState(''); // 설치위치 직접입력 (기타 선택 시)
  const [upCtrlCl, setUpCtrlCl] = useState(''); // 상향제어
  const [memo, setMemo] = useState(''); // 작업비고

  // 설치위치 고정 옵션 (레거시 mowoa01p31 참고)
  const instlLocOptions = [
    { value: '01', label: '1층' },
    { value: '02', label: '2층' },
    { value: '03', label: '3층이상' },
    { value: '99', label: '기타(직접입력)' },
  ];

  // 설치정보 모달 관련
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState(''); // 망구분 코드 (NET_CL)
  const [networkTypeName, setNetworkTypeName] = useState(''); // 망구분 이름 (NET_CL_NM)
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);

  // 연동이력 모달 관련
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);

  // 설치위치 모달 관련
  const [showInstallLocationModal, setShowInstallLocationModal] = useState(false);
  const [installLocationText, setInstallLocationText] = useState(''); // 저장된 설치위치 텍스트 (거실, 안방 등)
  const [viewModCd, setViewModCd] = useState(''); // 시청모드 코드
  const [viewModNm, setViewModNm] = useState(''); // 시청모드 이름

  // 서비스 이용 구분 (공통코드 값으로 저장)
  const [internetUse, setInternetUse] = useState(''); // 인터넷 이용 (CMCU057)
  const [voipUse, setVoipUse] = useState(''); // VoIP 이용 (CMCU110)
  const [dtvUse, setDtvUse] = useState(''); // 디지털방송 이용 (CMCU148)

  // 공통코드 옵션
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);
  const [upCtrlClOptions, setUpCtrlClOptions] = useState<{ value: string; label: string }[]>([]);
  const [internetOptions, setInternetOptions] = useState<{ value: string; label: string }[]>([]);
  const [voipOptions, setVoipOptions] = useState<{ value: string; label: string }[]>([]);
  const [dtvOptions, setDtvOptions] = useState<{ value: string; label: string }[]>([]);

  // 작업처리일 - 완료된 작업이면 서버의 완료일자 사용, 아니면 현재 날짜
  const [workCompleteDate, setWorkCompleteDate] = useState(() => {
    // 완료된 작업인 경우 서버에서 받은 완료일자 사용
    const cmplDt = (order as any).WRKR_CMPL_DT || (order as any).WRK_END_DTTM;
    if (cmplDt && cmplDt.length >= 8) {
      // YYYYMMDD 또는 YYYYMMDDHHmmss 형식을 YYYY-MM-DD로 변환
      return `${cmplDt.slice(0,4)}-${cmplDt.slice(4,6)}-${cmplDt.slice(6,8)}`;
    }
    // 새 작업인 경우 현재 날짜
    const today = new Date();
    return today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
  });

  // localStorage에서 저장된 데이터 복원 또는 완료된 작업의 경우 API 데이터 사용
  useEffect(() => {
    // 완료된 작업인 경우: order 객체에서 모든 데이터 가져오기
    if (isWorkCompleted) {
      console.log('[WorkCompleteForm] 완료된 작업 - API 데이터에서 전체 복원:', {
        CUST_REL: order.CUST_REL,
        INSTL_LOC: order.installLocation,
        UP_CTRL_CL: order.UP_CTRL_CL,
        PSN_USE_CORP: order.PSN_USE_CORP,
        VOIP_USE_CORP: order.VOIP_USE_CORP,
        DTV_USE_CORP: order.DTV_USE_CORP,
        VIEW_MOD_CD: order.VIEW_MOD_CD,
        VIEW_MOD_NM: order.VIEW_MOD_NM,
        NET_CL: order.NET_CL,
      });

      // 고객관계 설정
      setCustRel(order.CUST_REL || '');

      // 설치위치 설정 (INSTL_LOC에서 ¶로 분리된 경우 처리)
      const instlLocFull = order.installLocation || '';
      if (instlLocFull.includes('¶')) {
        const [locText, viewCd] = instlLocFull.split('¶');
        setInstallLocationText(locText);
        setViewModCd(viewCd);
        // 시청모드 이름 찾기
        const viewModOption = [
          { value: '01', label: '1층' },
          { value: '02', label: '2층' },
          { value: '03', label: '3층이상' },
        ].find(opt => opt.value === viewCd);
        setViewModNm(viewModOption?.label || order.VIEW_MOD_NM || '');
      } else {
        setInstallLocationText(instlLocFull);
        setViewModCd(order.VIEW_MOD_CD || '');
        setViewModNm(order.VIEW_MOD_NM || '');
      }

      // 상향제어 설정
      setUpCtrlCl(order.UP_CTRL_CL || '');

      // 서비스 이용 구분 설정
      setInternetUse(order.PSN_USE_CORP || '');
      setVoipUse(order.VOIP_USE_CORP || '');
      setDtvUse(order.DTV_USE_CORP || '');

      // 망구분 설정
      setNetworkType(order.NET_CL || '');
      setNetworkTypeName(order.NET_CL_NM || '');

      // 설치정보 데이터 설정
      setInstallInfoData({
        NET_CL: order.NET_CL || '',
        NET_CL_NM: order.NET_CL_NM || '',
        WRNG_TP: order.WRNG_TP || '',
        INSTL_TP: order.INSTL_TP || '',
        CB_WRNG_TP: order.CB_WRNG_TP || '',
        CB_INSTL_TP: order.CB_INSTL_TP || '',
        INOUT_LINE_TP: order.INOUT_LINE_TP || '',
        INOUT_LEN: order.INOUT_LEN || '',
        DVDR_YN: order.DVDR_YN || '',
        BFR_LINE_YN: order.BFR_LINE_YN || '',
        CUT_YN: order.CUT_YN || '',
        TERM_NO: order.TERM_NO || '',
        RCV_STS: order.RCV_STS || '',
        SUBTAP_ID: order.SUBTAP_ID || '',
        PORT_NUM: order.PORT_NUM || '',
        EXTN_TP: order.EXTN_TP || '',
        TAB_LBL: order.TAB_LBL || '',
        CVT_LBL: order.CVT_LBL || '',
        STB_LBL: order.STB_LBL || '',
      });

      setIsDataLoaded(true);
      return;
    }

    // 진행 중인 작업: localStorage에서 복원
    const savedDraft = localStorage.getItem(getStorageKey());
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        console.log('[WorkCompleteForm] localStorage에서 복원:', draftData);
        setCustRel(draftData.custRel || '');
        setInstlLoc(draftData.instlLoc || '');
        setInstlLocText(draftData.instlLocText || '');
        setUpCtrlCl(draftData.upCtrlCl || '');
        setMemo(draftData.memo || '');
        setInternetUse(draftData.internetUse || '');
        setVoipUse(draftData.voipUse || '');
        setDtvUse(draftData.dtvUse || '');
        setNetworkType(draftData.networkType || '');
        setNetworkTypeName(draftData.networkTypeName || '');
        setInstallInfoData(draftData.installInfoData);
      } catch (error) {
        console.error('[WorkCompleteForm] localStorage 복원 실패:', error);
      }
    }
    setIsDataLoaded(true);
  }, [order.id, isWorkCompleted]);

  // 작업 중인 데이터 자동 저장
  useEffect(() => {
    if (!isDataLoaded) return; // 초기 로드 전에는 저장 안 함

    const draftData = {
      custRel,
      instlLoc,
      instlLocText,
      upCtrlCl,
      memo,
      internetUse,
      voipUse,
      dtvUse,
      networkType,
      networkTypeName,
      installInfoData,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
    console.log('[WorkCompleteForm] 작업 내용 임시 저장');
  }, [custRel, instlLoc, instlLocText, upCtrlCl, memo, internetUse, voipUse, dtvUse, networkType, networkTypeName, installInfoData, isDataLoaded]);

  // 공통코드 및 계약정보 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // 공통코드 로드: CMCU005(고객관계), CMCT015(상향제어), CMCU057(인터넷), CMCU110(VoIP), CMCU148(디지털)
        const codes = await getCommonCodeList(['CMCU005', 'CMCT015', 'CMCU057', 'CMCU110', 'CMCU148']);

        // 고객관계
        if (codes['CMCU005']) {
          const options = codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD,
            label: code.COMMON_CD_NM
          }));
          setCustRelOptions(options);
        }

        // 상향제어
        if (codes['CMCT015']) {
          const options = codes['CMCT015'].map((code: CommonCode) => ({
            value: code.COMMON_CD,
            label: code.COMMON_CD_NM
          }));
          setUpCtrlClOptions(options);
        }

        // 인터넷 이용 구분
        if (codes['CMCU057']) {
          const options = codes['CMCU057'].map((code: CommonCode) => ({
            value: code.COMMON_CD,
            label: code.COMMON_CD_NM
          }));
          setInternetOptions(options);
        }

        // VoIP 이용 구분
        if (codes['CMCU110']) {
          const options = codes['CMCU110'].map((code: CommonCode) => ({
            value: code.COMMON_CD,
            label: code.COMMON_CD_NM
          }));
          setVoipOptions(options);
        }

        // 디지털방송 이용 구분
        if (codes['CMCU148']) {
          const options = codes['CMCU148'].map((code: CommonCode) => ({
            value: code.COMMON_CD,
            label: code.COMMON_CD_NM
          }));
          setDtvOptions(options);
        }

        // 설치위치는 사용자가 직접 선택 (레거시 mowoa01p31 방식)
      } catch (error) {
        console.error('[WorkCompleteForm] 초기 데이터 로드 실패:', error);
      }
    };

    loadInitialData();
  }, [order.customer?.CTRT_ID]);

  // 검증
  const validate = (): string[] => {
    const errors: string[] = [];
    if (!custRel || custRel === '[]') {
      errors.push('고객과의 관계를 선택해주세요.');
    }
    // 설치위치 필수 검증 - 철거 작업에서는 검증 안함 (레거시 동일)
    if (!isRemovalWork && !order.installLocation && !installLocationText) {
      errors.push('설치위치를 설정해주세요.');
    }
    if (!workCompleteDate) {
      errors.push('작업처리일을 선택해주세요.');
    }
    // 철거 작업에서 별도 신호 전송 검증 제거 - 레거시에서는 작업완료 시 내부 처리
    return errors;
  };

  // 설치정보 모달 핸들러
  const handleInstallInfoOpen = () => {
    console.log('📝 [WorkCompleteForm] 설치정보 모달 열기');
    setShowInstallInfoModal(true);
  };

  const handleInstallInfoClose = () => {
    console.log('📝 [WorkCompleteForm] 설치정보 모달 닫기');
    setShowInstallInfoModal(false);
  };

  const handleInstallInfoSave = (data: InstallInfoData) => {
    console.log('💾 [WorkCompleteForm] 설치정보 저장:', data);
    setInstallInfoData(data);

    // 망구분 코드와 이름을 state에 저장
    if (data.NET_CL) {
      setNetworkType(data.NET_CL);
      console.log('✅ [WorkCompleteForm] 망구분 코드 업데이트:', data.NET_CL);
    }
    if (data.NET_CL_NM) {
      setNetworkTypeName(data.NET_CL_NM);
      console.log('✅ [WorkCompleteForm] 망구분 이름 업데이트:', data.NET_CL_NM);
    }

    if (showToast) {
      showToast('설치 정보가 저장되었습니다.', 'success');
    }
  };

  // 작업 완료 처리 (isEquipmentRemoval: 장비철거 버튼으로 호출 시 true)
  const handleSubmit = (isEquipmentRemoval: boolean = false) => {
    // 중복 호출 방지
    if (isLoading) {
      console.log('[WorkCompleteForm] ⚠️ 이미 처리 중입니다. 중복 호출 방지');
      return;
    }

    const errors = validate();
    if (errors.length > 0) {
      if (showToast) {
        errors.forEach(error => showToast(error, 'error'));
      } else {
        alert('입력 오류:\n' + errors.join('\n'));
      }
      return;
    }

    // 레거시: 장비철거 버튼 클릭 시 확인 메시지가 다름
    const confirmMessage = isEquipmentRemoval
      ? (equipmentData?.removedEquipments?.length > 0 || order.ISP_PROD_CD
          ? '장비 철거하시겠습니까?\n(신호번호 처리업무도 동시에 처리됩니다.)'
          : '장비 철거하시겠습니까?')
      : (equipmentData?.removedEquipments?.length > 0 || order.ISP_PROD_CD
          ? '작업을 완료하시겠습니까?\n(신호번호 처리업무도 동시에 처리됩니다.)'
          : '작업을 완료하시겠습니까?');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    console.log('[WorkCompleteForm] 🚀 작업완료 처리 시작', isEquipmentRemoval ? '(장비철거)' : '');

    // completeData 생성 로직
    const buildCompleteData = (): WorkCompleteData => {
      const formattedDate = workCompleteDate.replace(/-/g, '');

      // 작업자 정보 확인
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};

      // 🔧 테스트 환경: 작업자 ID 고정 (A20130708)
      const workerId = 'A20130708';

      console.log('[WorkCompleteForm] ========================================');
      console.log('[WorkCompleteForm] 🔍 작업자 정보 확인');
      console.log('[WorkCompleteForm] localStorage userInfo:', user);
      console.log('[WorkCompleteForm] 고정된 workerId:', workerId);
      console.log('[WorkCompleteForm] order 객체:', order);
      console.log('[WorkCompleteForm] ========================================');
      console.log('[WorkCompleteForm] 작업완료 요청 준비');
      console.log('[WorkCompleteForm] 전달받은 equipmentData:', equipmentData);
      console.log('[WorkCompleteForm] equipmentData.installedEquipments:', equipmentData?.installedEquipments);

      if (equipmentData?.installedEquipments && equipmentData.installedEquipments.length > 0) {
        console.log('[WorkCompleteForm] 첫번째 장비 원본 구조:', equipmentData.installedEquipments[0]);
        console.log('[WorkCompleteForm] actualEquipment 존재 여부:', !!equipmentData.installedEquipments[0]?.actualEquipment);
      }
      console.log('[WorkCompleteForm] ========================================');

      // 장비 데이터 평탄화 (InstalledEquipment → Equipment with all fields)
      const processEquipmentList = (equipments: any[]) => {
        if (!equipments || equipments.length === 0) return [];

        const userInfo = localStorage.getItem('userInfo');
        const user = userInfo ? JSON.parse(userInfo) : {};

        return equipments.map((eq: any, index: number) => {
          console.log(`[WorkCompleteForm] 장비[${index}] 처리 시작:`, eq);

          // InstalledEquipment 구조인 경우 (actualEquipment 필드가 있음)
          if (eq.actualEquipment) {
            console.log(`[WorkCompleteForm] 장비[${index}] InstalledEquipment 구조 감지`);
            const actual = eq.actualEquipment;
            const contract = eq.contractEquipment || {};

            const processed = {
              ...actual,
              // 기본 필드 (대문자)
              EQT_NO: actual.id,
              EQT_SERNO: actual.serialNumber,
              ITEM_MID_CD: actual.itemMidCd,
              EQT_CL_CD: actual.eqtClCd,
              MAC_ADDRESS: eq.macAddress || actual.macAddress,

              // workInfo에서 가져오는 필드
              WRK_ID: order.id,
              CUST_ID: order.customer?.id,
              CTRT_ID: order.CTRT_ID,
              WRK_CD: order.WRK_CD,

              // 계약 장비에서 가져오는 필드
              SVC_CMPS_ID: contract.id || contract.SVC_CMPS_ID || actual.SVC_CMPS_ID,
              BASIC_PROD_CMPS_ID: actual.BASIC_PROD_CMPS_ID || contract.BASIC_PROD_CMPS_ID || '',
              EQT_PROD_CMPS_ID: actual.EQT_PROD_CMPS_ID || contract.id,

              // API 응답 또는 기본값
              PROD_CD: actual.PROD_CD || contract.PROD_CD || order.PROD_CD || '',
              SVC_CD: actual.SVC_CD || contract.SVC_CD || '',
              EQT_SALE_AMT: actual.EQT_SALE_AMT || '0',
              MST_SO_ID: actual.MST_SO_ID || order.SO_ID || user.soId || '',
              SO_ID: actual.SO_ID || order.SO_ID || user.soId || '',

              // 기타 필수 필드 (workInfo와 동일한 workerId 사용)
              REG_UID: workerId,
              OLD_LENT_YN: actual.OLD_LENT_YN || 'N',
              LENT: actual.LENT || '10',
              ITLLMT_PRD: actual.ITLLMT_PRD || '00',
              EQT_USE_STAT_CD: actual.EQT_USE_STAT_CD || '1',
              EQT_CHG_GB: '1',
              IF_DTL_ID: actual.IF_DTL_ID || '',
            };
            console.log(`[WorkCompleteForm] 장비[${index}] 처리 완료 - 필드 개수:`, Object.keys(processed).length);
            return processed;
          }

          // 평탄화된 Equipment 구조인 경우 - 여전히 필수 필드 추가 필요!
          console.log(`[WorkCompleteForm] 장비[${index}] Equipment 구조 - 레거시 필드 추가`);
          const processed = {
            ...eq,
            // 기본 필드 (대문자) - 이미 있을 수 있지만 덮어쓰기
            EQT_NO: eq.EQT_NO || eq.id,
            EQT_SERNO: eq.EQT_SERNO || eq.serialNumber,
            ITEM_MID_CD: eq.ITEM_MID_CD || eq.itemMidCd,
            EQT_CL_CD: eq.EQT_CL_CD || eq.eqtClCd,
            MAC_ADDRESS: eq.MAC_ADDRESS || eq.macAddress,

            // workInfo에서 가져오는 필드 (없으면 추가)
            WRK_ID: eq.WRK_ID || order.id,
            CUST_ID: eq.CUST_ID || order.customer?.id,
            CTRT_ID: eq.CTRT_ID || order.CTRT_ID,
            WRK_CD: eq.WRK_CD || order.WRK_CD,

            // 계약/API 필드 (없으면 기본값)
            SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
            BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
            EQT_PROD_CMPS_ID: eq.EQT_PROD_CMPS_ID || '',
            PROD_CD: eq.PROD_CD || order.PROD_CD || '',
            SVC_CD: eq.SVC_CD || '',
            EQT_SALE_AMT: eq.EQT_SALE_AMT || '0',
            MST_SO_ID: eq.MST_SO_ID || order.SO_ID || user.soId || '',
            SO_ID: eq.SO_ID || order.SO_ID || user.soId || '',

            // 기타 필수 필드 (workInfo와 동일한 workerId 사용)
            REG_UID: workerId,
            OLD_LENT_YN: eq.OLD_LENT_YN || 'N',
            LENT: eq.LENT || '10',
            ITLLMT_PRD: eq.ITLLMT_PRD || '00',
            EQT_USE_STAT_CD: eq.EQT_USE_STAT_CD || '1',
            EQT_CHG_GB: eq.EQT_CHG_GB || '1',
            IF_DTL_ID: eq.IF_DTL_ID || '',
          };
          console.log(`[WorkCompleteForm] 장비[${index}] 처리 완료 - 필드 개수:`, Object.keys(processed).length);
          console.log(`[WorkCompleteForm] 장비[${index}] 필드 목록:`, Object.keys(processed));
          return processed;
        });
      };

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
          REQ_CUST_TEL_NO: order.customer?.contactNumber || '',
          // 설치위치: 기존값 있으면 그대로, 없으면 모달에서 설정한 값 전송
          INSTL_LOC: order.installLocation || installLocationText || '',
          UP_CTRL_CL: upCtrlCl || '',
          PSN_USE_CORP: internetUse || '',
          VOIP_USE_CORP: voipUse || '',
          DTV_USE_CORP: dtvUse || '',
          WRK_ACT_CL: '20',
          // 설치정보 모달에서 입력한 값들 (레거시 ds_detail_wrk_recept)
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
          // DB 프로시저 필수 필드 추가
          KPI_PROD_GRP: '',
          OBS_RCPT_CD: '',
          OBS_RCPT_DTL_CD: '',
          VOIP_JOIN_CTRT_ID: '',
          AGREE_YN: '',
          ISP_YN: '',
          AGREE_GB: '',
          CUST_CLEAN_YN: '',
          // 레거시: 장비철거 버튼 클릭 시 EQT_RMV_FLAG: 'Y'
          EQT_RMV_FLAG: isEquipmentRemoval ? 'Y' : '',
          TV_TYPE: ''
        },
        // 장비 데이터 포함 (3단계에서 전달받은 데이터)
        // 백엔드가 기대하는 키 이름으로 전송
        equipmentList: processEquipmentList(equipmentData?.installedEquipments || []),
        removeEquipmentList: processEquipmentList(equipmentData?.removedEquipments || []),
        spendItemList: equipmentData?.spendItems || [],
        agreementList: equipmentData?.agreements || [],
        poleList: equipmentData?.poleResults || []
      };

      console.log('[WorkCompleteForm] ========== 최종 전송 데이터 ==========');
      console.log('[WorkCompleteForm] 전체 completeData:', JSON.stringify(completeData, null, 2));
      console.log('[WorkCompleteForm] workInfo:', completeData.workInfo);
      console.log('[WorkCompleteForm] equipmentList 개수:', completeData.equipmentList?.length || 0);
      if (completeData.equipmentList && completeData.equipmentList.length > 0) {
        console.log('[WorkCompleteForm] equipmentList[0] 샘플:', completeData.equipmentList[0]);
        console.log('[WorkCompleteForm] equipmentList[0] 필드 목록:', Object.keys(completeData.equipmentList[0]));
      }
      console.log('[WorkCompleteForm] removeEquipmentList 개수:', completeData.removeEquipmentList?.length || 0);
      console.log('[WorkCompleteForm] ==========================================');

      return completeData;
    };

    const completeData = buildCompleteData();

    // React Query Mutation 실행
    submitWork(completeData, {
      onSuccess: (result) => {
        if (result.code === 'SUCCESS' || result.code === 'OK') {
          // localStorage에서 임시 저장 데이터 삭제
          localStorage.removeItem(getStorageKey());
          console.log('[WorkCompleteForm] 작업 완료 - localStorage 삭제');

          if (showToast) {
            showToast('작업이 성공적으로 완료되었습니다.', 'success');
          } else {
            alert('작업이 성공적으로 완료되었습니다.');
          }
          onSuccess();
        } else {
          const errorMessage = result.message || '작업 완료 처리에 실패했습니다.';
          if (showToast) {
            showToast(errorMessage, 'error');
          } else {
            alert('오류: ' + errorMessage);
          }
        }
      },
      onError: (error: any) => {
        const errorMessage = error.message || '작업 완료 중 오류가 발생했습니다.';
        if (showToast) {
          showToast(errorMessage, 'error');
        } else {
          alert('오류: ' + errorMessage);
        }
      },
    });
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-5">
          {/* 폼 */}
          <div className="space-y-3 sm:space-y-5">
            {/* 계약정보 (읽기전용) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                계약정보
              </label>
              <input
                type="text"
                value={order.customer?.name || ''}
                readOnly
                disabled
                className="w-full min-h-[40px] sm:min-h-[48px] px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed"
              />
            </div>

            {/* 망구분 (읽기전용) + 설치정보/철거정보 버튼 */}
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
                  placeholder={isRemovalWork ? "철거정보에서 입력" : "설치정보에서 입력"}
                  className="flex-1 min-w-0 min-h-[40px] sm:min-h-[48px] px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed truncate"
                />
                <button
                  type="button"
                  onClick={handleInstallInfoOpen}
                  className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${isWorkCompleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : (isRemovalWork ? '철거정보' : '설치정보')}
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

            {/* 설치위치 (필수) - 설정 버튼으로 모달 열기 - 철거 작업에서는 표시 안함 (레거시 동일) */}
            {!isRemovalWork && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                  설치위치 {!isWorkCompleted && <span className="text-red-500">*</span>}
                </label>
                <div className="flex gap-1.5 sm:gap-2">
                  <div className="flex-1 flex items-center min-w-0 min-h-[40px] sm:min-h-[48px] px-3 sm:px-4 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-xs sm:text-sm">
                    <span className="truncate">{installLocationText || order.installLocation || '미설정'}</span>
                    {viewModNm && <span className="ml-1 sm:ml-2 text-[10px] sm:text-sm text-gray-500 flex-shrink-0">(시청: {viewModNm})</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInstallLocationModal(true)}
                    className={`min-h-[40px] sm:min-h-[48px] px-3 sm:px-4 rounded-lg font-bold transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-shrink-0 ${
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
            )}

            {/* 상향제어 - 철거 작업에서는 표시 안함 (레거시 동일) */}
            {!isRemovalWork && (
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

            {/* 작업비고 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                작업비고
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="작업 내용을 입력하세요..."
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg text-base resize-none ${isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                rows={4}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
            </div>

            {/* 작업처리일 (비활성화) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                작업처리일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={workCompleteDate}
                readOnly
                disabled
                className="w-full min-h-[48px] px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-base text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* 인터넷이용 - 철거 작업에서는 표시 안함 (레거시 동일) */}
            {!isRemovalWork && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  인터넷이용
                </label>
                <Select
                  value={internetUse}
                  onValueChange={setInternetUse}
                  options={internetOptions}
                  placeholder="선택"
                  disabled={isWorkCompleted}
                />
              </div>
            )}

            {/* VoIP이용 - 철거 작업에서는 표시 안함 (레거시 동일) */}
            {!isRemovalWork && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  VoIP이용
                </label>
                <Select
                  value={voipUse}
                  onValueChange={setVoipUse}
                  options={voipOptions}
                  placeholder="선택"
                  disabled={isWorkCompleted}
                />
              </div>
            )}

            {/* 디지털이용 + 연동이력 버튼 - 철거 작업에서는 연동이력만 표시 (레거시 동일) */}
            {!isRemovalWork ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  디지털이용
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={dtvUse}
                      onValueChange={setDtvUse}
                      options={dtvOptions}
                      placeholder="선택"
                      disabled={isWorkCompleted}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowIntegrationHistoryModal(true)}
                    className="min-h-[48px] px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>연동이력</span>
                  </button>
                </div>
              </div>
            ) : (
              /* 철거 작업: 연동이력 버튼만 표시 (레거시 btn_signal_hist) */
              <div>
                <button
                  type="button"
                  onClick={() => setShowIntegrationHistoryModal(true)}
                  className="w-full min-h-[48px] px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>연동이력</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 고정 하단 버튼 - 완료된 작업에서는 숨김 */}
      {!isWorkCompleted && (
        <div className="fixed left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg z-50" style={{ bottom: '68px' }}>
          <div className="max-w-4xl mx-auto px-4 py-3">
            {/* 철거 작업: 장비철거 + 작업완료 버튼 (레거시 btn_eqt_rmv + btn_save) */}
            {showEquipmentRemovalButton ? (
              <div className="flex gap-2">
                {/* 장비철거 버튼 (레거시: btn_eqt_rmv) */}
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={isLoading || !isEquipmentRemovalEnabled}
                  className={`flex-1 min-h-[48px] rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
                    isLoading || !isEquipmentRemovalEnabled
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                  title={!isEquipmentRemovalEnabled ? 'VOIP 상품은 장비철거 불가' : ''}
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
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>장비철거</span>
                    </>
                  )}
                </button>
                {/* 작업완료 버튼 (레거시: btn_save) */}
                <button
                  onClick={() => handleSubmit(false)}
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
                      <span>작업완료</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* 일반 작업: 작업완료 버튼만 */
              <button
                onClick={() => handleSubmit(false)}
                disabled={isLoading}
                className="btn btn-lg btn-primary w-full flex items-center justify-center gap-2"
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
          </div>
        </div>
      )}

      {/* 설치정보 모달 */}
      <InstallInfoModal
        isOpen={showInstallInfoModal}
        onClose={handleInstallInfoClose}
        onSave={handleInstallInfoSave}
        workId={order.id}
        initialData={installInfoData}
        workType={order.WRK_CD}
        customerId={order.customer.id}
        customerName={order.customer.name}
        contractId={order.CTRT_ID}
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD}
        prodChgGb={equipmentData?.prodChgGb || equipmentData?.PROD_CHG_GB}
        chgKpiProdGrpCd={equipmentData?.chgKpiProdGrpCd || equipmentData?.CHG_KPI_PROD_GRP_CD}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP}
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
          // 저장 후 화면에 표시할 데이터 업데이트
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
    </div>
  );
};

export default WorkCompleteForm;
