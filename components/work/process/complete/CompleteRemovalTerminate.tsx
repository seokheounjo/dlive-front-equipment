import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { getCommonCodeList, CommonCode, insertWorkRemoveStat, modAsPdaReceipt, getWorkReceiptDetail } from '../../../../services/apiService';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import HotbillSection from '../HotbillSection';
import RemovalLineManageModal, { RemovalLineData } from '../../../modal/RemovalLineManageModal';
import RemovalASAssignModal, { ASAssignData } from '../../../modal/RemovalASAssignModal';
import ConfirmModal from '../../../common/ConfirmModal';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import '../../../../styles/buttons.css';

/**
 * CompleteRemovalTerminate - 이전철거(WRK_CD=08) 작업완료 컴포넌트
 *
 * 레거시 참조: mowoa03m08.xml - 작업완료(이전철거)
 *
 * 특징:
 * - NET_CL(망구분), INSTL_TP(설치유형) 필수 입력
 * - 장비등록/변경 버튼 숨김 (3단계에서 회수만 가능)
 * - 설치위치 입력 필드 없음
 * - 상향제어, 인터넷/VoIP/디지털 이용구분 없음
 * - 연동이력 버튼만 표시
 * - 작업완료 후 인입선로 철거관리 모달 표시 (조건부)
 * - LGU+ 정보 처리 (fn_uplus_cust_info)
 * - 재사용 체크 (chk_reuse_yn)
 */
interface CompleteRemovalTerminateProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteRemovalTerminate: React.FC<CompleteRemovalTerminateProps> = ({
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
  const equipmentData = storeEquipmentData || legacyEquipmentData || filteringData;

  // React Query Mutation
  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  // localStorage 키
  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 기본 정보 State
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');

  // 고객명/연락처 편집 가능 (레거시: edt_cust_nm, edt_cust_telno)
  const [cnfmCustNm, setCnfmCustNm] = useState('');
  const [cnfmCustTelno, setCnfmCustTelno] = useState('');

  // 재사용 체크박스 (레거시: chk_reuse_yn)
  // 조건: MVM_TP='3'(이동작업), WRK_STAT_CD='2'(할당), CTRT_ID != OLD_CTRT_ID
  const [reuseYn, setReuseYn] = useState(false);
  const [showReuseCheckbox, setShowReuseCheckbox] = useState(false);

  // 설치(철거)정보 모달
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [networkTypeName, setNetworkTypeName] = useState('');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);

  // 연동이력 모달
  const [showIntegrationHistoryModal, setShowIntegrationHistoryModal] = useState(false);


  // 인입선로 철거관리 모달
  const [showRemovalLineModal, setShowRemovalLineModal] = useState(false);
  const [removalLineData, setRemovalLineData] = useState<RemovalLineData | null>(null);

  // AS할당 모달
  const [showASAssignModal, setShowASAssignModal] = useState(false);
  const [isASProcessing, setIsASProcessing] = useState(false);


  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  // 공통코드 옵션
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

  // 데이터 복원
  useEffect(() => {
    // 고객명/연락처 초기값 설정
    setCnfmCustNm(order.customer?.name || '');
    setCnfmCustTelno(order.customer?.contactNumber || order.REQ_CUST_TEL_NO || '');

    // 재사용 체크박스 표시 조건 (레거시: mowoa03m08.xml 591~602)
    // MVM_TP='3'(이동작업), WRK_STAT_CD='2'(할당), CTRT_ID != OLD_CTRT_ID
    const mvmTp = (order as any).MVM_TP || '';
    const wrkStatCd = order.WRK_STAT_CD || '';
    const ctrtId = order.CTRT_ID || '';
    const oldCtrtId = (order as any).OLD_CTRT_ID || '';

    if (mvmTp === '3' && wrkStatCd === '2' && ctrtId !== oldCtrtId && oldCtrtId !== '') {
      setShowReuseCheckbox(true);
      setReuseYn(true); // 레거시 기본값: Y
    } else {
      setShowReuseCheckbox(false);
      setReuseYn(false);
    }

    if (isWorkCompleted) {
      console.log('[WorkCompleteRemovalTerminate] 완료된 작업 - getWorkReceiptDetail API 호출');

      const fetchCompletedWorkDetail = async () => {
        try {
          const detail = await getWorkReceiptDetail({
            WRK_DRCTN_ID: order.directionId || order.id,
            WRK_ID: (order as any).WRK_ID,
            SO_ID: order.SO_ID
          });

          if (detail) {
            console.log('[WorkCompleteRemovalTerminate] API 응답:', detail);
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

            setMemo((detail.MEMO || '').replace(/\\n/g, '\n'));

            // 작업처리일 복원
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          } else {
            // API 실패 시 order에서 복원 시도 (fallback)
            console.log('[WorkCompleteRemovalTerminate] API 실패 - order에서 복원 시도');
            setCustRel(order.CUST_REL || '');
            setNetworkType(order.NET_CL || '');
            setNetworkTypeName(order.NET_CL_NM || '');
          }
        } catch (error) {
          console.error('[WorkCompleteRemovalTerminate] API 호출 실패:', error);
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
        setMemo(draftData.memo || '');
        setNetworkType(draftData.networkType || '');
        setNetworkTypeName(draftData.networkTypeName || '');
        setInstallInfoData(draftData.installInfoData);
        // 고객명/연락처 복원
        if (draftData.cnfmCustNm) setCnfmCustNm(draftData.cnfmCustNm);
        if (draftData.cnfmCustTelno) setCnfmCustTelno(draftData.cnfmCustTelno);
        if (draftData.reuseYn !== undefined) setReuseYn(draftData.reuseYn);
      } catch (error) {
        console.error('[WorkCompleteRemovalTerminate] localStorage 복원 실패:', error);
      }
    }
    setIsDataLoaded(true);
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;

    const draftData = {
      custRel, memo,
      networkType, networkTypeName,
      installInfoData,
      cnfmCustNm, cnfmCustTelno, reuseYn,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, networkType, networkTypeName, installInfoData, cnfmCustNm, cnfmCustTelno, reuseYn, isDataLoaded, isWorkCompleted]);

  // 공통코드 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const codes = await getCommonCodeList(['CMCU005']);

        if (codes['CMCU005']) {
          setCustRelOptions(codes['CMCU005'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }
      } catch (error) {
        console.error('[WorkCompleteRemovalTerminate] 초기 데이터 로드 실패:', error);
      }
    };

    loadInitialData();
  }, []);

  // 검증 - 철거해지는 NET_CL, INSTL_TP 필수 (레거시 동일)
  // 레거시: 고객명, 고객관계, 연락처 필수 (mowoa03m08.xml 801~808)
  const validate = (): string[] => {
    const errors: string[] = [];
    // 고객명 필수
    if (!cnfmCustNm || cnfmCustNm.trim() === '') {
      errors.push('고객명을 입력해주세요.');
    }
    // 연락처 필수
    if (!cnfmCustTelno || cnfmCustTelno.trim() === '') {
      errors.push('연락처를 입력해주세요.');
    }
    if (!custRel || custRel === '[]') {
      errors.push('고객과의 관계를 선택해주세요.');
    }
    // 철거해지 필수 검증: 망구분, 배선방식, 설치유형
    if (!installInfoData?.NET_CL) {
      errors.push('철거정보에서 망구분을 선택해주세요.');
    }
    if (!installInfoData?.WRNG_TP) {
      errors.push('철거정보에서 배선방식을 선택해주세요.');
    }
    if (!installInfoData?.INSTL_TP) {
      errors.push('철거정보에서 설치유형을 선택해주세요.');
    }
    if (!workCompleteDate) {
      errors.push('작업처리일을 선택해주세요.');
    }
    return errors;
  };

  // 철거정보 모달 핸들러
  const handleInstallInfoSave = (data: InstallInfoData) => {
    setInstallInfoData(data);
    if (data.NET_CL) setNetworkType(data.NET_CL);
    if (data.NET_CL_NM) setNetworkTypeName(data.NET_CL_NM);
    showToast?.('철거 정보가 저장되었습니다.', 'success');
  };

  // 인입선로 철거관리 - 완료(완전철거) 핸들러
  const handleRemovalLineComplete = async (data: RemovalLineData) => {
    console.log('[WorkCompleteRemovalTerminate] 인입선로 철거관리 완료(완전철거):', data);
    setRemovalLineData(data);
    setShowRemovalLineModal(false);

    try {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};
      const workerId = user.userId || 'A20130708';

      const result = await insertWorkRemoveStat({
        WRK_ID: order.id,
        REMOVE_LINE_TP: data.REMOVE_LINE_TP,
        REMOVE_GB: data.REMOVE_GB,
        REMOVE_STAT: data.REMOVE_STAT || '',
        REG_UID: workerId,
      });

      if (result.code === 'SUCCESS' || result.code === 'OK') {
        console.log('[WorkCompleteRemovalTerminate] insertWorkRemoveStat 성공');
        showToast?.('인입선로 철거상태가 저장되었습니다.', 'success');
        showToast?.('작업이 성공적으로 완료되었습니다.', 'success');
        onSuccess();
      } else {
        showToast?.(result.message || '인입선로 철거상태 저장에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      showToast?.(error.message || '인입선로 철거상태 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 인입선로 미철거 - AS할당 핸들러
  const handleRemovalLineAssignAS = (data: RemovalLineData) => {
    console.log('[WorkCompleteRemovalTerminate] 인입선로 미철거 - AS할당 모달 열기:', data);
    setRemovalLineData(data);
    setShowRemovalLineModal(false);
    setShowASAssignModal(true);
  };

  // AS할당 모달 저장 핸들러
  const handleASAssignSave = async (data: ASAssignData) => {
    console.log('[WorkCompleteRemovalTerminate] AS할당 저장:', data);
    setIsASProcessing(true);

    try {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};
      const workerId = user.userId || 'A20130708';

      // 1. insertWorkRemoveStat 호출
      const removeStatResult = await insertWorkRemoveStat({
        WRK_ID: order.id,
        REMOVE_LINE_TP: data.REMOVE_LINE_TP,
        REMOVE_GB: data.REMOVE_GB,
        REMOVE_STAT: data.REMOVE_STAT || '',
        REG_UID: workerId,
      });

      if (removeStatResult.code !== 'SUCCESS' && removeStatResult.code !== 'OK') {
        throw new Error(removeStatResult.message || '인입선로 철거상태 저장에 실패했습니다.');
      }

      // 2. modAsPdaReceipt 호출
      const asResult = await modAsPdaReceipt({
        CUST_ID: data.CUST_ID,
        RCPT_ID: data.RCPT_ID || '',
        WRK_DTL_TCD: data.WRK_DTL_TCD,
        WRK_RCPT_CL: data.WRK_RCPT_CL,
        WRK_RCPT_CL_DTL: data.WRK_RCPT_CL_DTL,
        WRK_HOPE_DTTM: data.WRK_HOPE_DTTM,
        MEMO: data.MEMO || '',
        EMRG_YN: data.EMRG_YN || 'N',
        HOLY_YN: data.HOLY_YN || 'N',
        CRR_ID: data.CRR_ID || '01',
        WRKR_ID: data.WRKR_ID || workerId,
        REG_UID: data.REG_UID || workerId,
      });

      if (asResult.code === 'SUCCESS' || asResult.code === 'OK') {
        setShowASAssignModal(false);
        showToast?.('AS가 할당되었습니다.', 'success');
        showToast?.('작업이 성공적으로 완료되었습니다.', 'success');
        onSuccess();
      } else {
        throw new Error(asResult.message || 'AS할당에 실패했습니다.');
      }
    } catch (error: any) {
      showToast?.(error.message || 'AS할당 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsASProcessing(false);
    }
  };

  // 작업 완료 확인 모달 열기
  const handleSubmit = () => {
    if (isLoading) return;

    // 방송상품 작업완료 불가 체크 (레거시: mowoa03m08 743-744)
    // 회수 장비 중 PROD_CMPS_CL='23'(방송) 있으면 불가
    const removedEquipments = equipmentData?.removedEquipments || [];
    const hasBroadcastEquipment = removedEquipments.some((eq: any) =>
      eq.PROD_CMPS_CL === '23' || eq.actualEquipment?.PROD_CMPS_CL === '23'
    );
    if (hasBroadcastEquipment) {
      showToast?.('철거 대상의 상품을 완료 처리할 수 없습니다. 작업을 확인하세요.', 'error');
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

    // 레거시 mowoa03m08: 신호번호 처리업무 동시 처리 안내
    const message = (equipmentData?.removedEquipments?.length > 0 || order.ISP_PROD_CD)
      ? '작업을 완료하시겠습니까?\n(신호번호 처리업무도 동시에 처리됩니다.)'
      : '작업을 완료하시겠습니까?';

    setConfirmMessage(message);
    setShowConfirmModal(true);
  };

  // 작업 완료 실제 처리
  const handleConfirmSubmit = () => {
    console.log('[WorkCompleteRemovalTerminate] 작업완료 처리 시작');

    const formattedDate = workCompleteDate.replace(/-/g, '');
    const workerId = 'A20130708';

    // 장비 데이터 처리 (회수 장비만) - REUSE_YN 포함 (레거시: mowoa03m08.xml 983~987)
    const processEquipmentList = (equipments: any[]) => {
      if (!equipments || equipments.length === 0) return [];
      return equipments.map((eq: any) => {
        // REUSE_YN 값 설정 (레거시: chk_reuse_yn 체크 시 "1", 아니면 "0")
        const reuseYnValue = reuseYn ? '1' : '0';

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
            OLD_LENT_YN: actual.OLD_LENT_YN || 'N',
            LENT: actual.LENT || '10',
            ITLLMT_PRD: actual.ITLLMT_PRD || '00',
            EQT_USE_STAT_CD: actual.EQT_USE_STAT_CD || '1',
            EQT_CHG_GB: '1',
            IF_DTL_ID: actual.IF_DTL_ID || '',
            REUSE_YN: reuseYnValue, // 재사용 여부
          };
        }
        return {
          ...eq,
          EQT_NO: eq.EQT_NO || eq.id,
          WRK_ID: eq.WRK_ID || order.id,
          CUST_ID: eq.CUST_ID || order.customer?.id,
          CTRT_ID: eq.CTRT_ID || order.CTRT_ID,
          WRK_CD: eq.WRK_CD || order.WRK_CD,
          REG_UID: workerId,
          REUSE_YN: reuseYnValue, // 재사용 여부
        };
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
        // 레거시: 사용자가 입력한 고객명/연락처 (mowoa03m08.xml 1006~1007)
        CNFM_CUST_NM: cnfmCustNm,
        CNFM_CUST_TELNO: cnfmCustTelno,
        REQ_CUST_TEL_NO: cnfmCustTelno,
        // 철거해지: 설치위치 없음
        INSTL_LOC: '',
        // 철거해지: 상향제어, 서비스이용구분 없음
        UP_CTRL_CL: '',
        PSN_USE_CORP: '',
        VOIP_USE_CORP: '',
        DTV_USE_CORP: '',
        WRK_ACT_CL: '20',
        // 철거정보 (필수)
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '77', // 철거해지 기본값
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
        VOIP_JOIN_CTRT_ID: '',
        AGREE_YN: '',
        ISP_YN: '',
        AGREE_GB: '',
        CUST_CLEAN_YN: '',
        EQT_RMV_FLAG: '',
        TV_TYPE: ''
      },
      // 철거해지: 설치장비 없음, 회수장비만
      equipmentList: [],
      removeEquipmentList: processEquipmentList(equipmentData?.removedEquipments || []),
      spendItemList: equipmentData?.spendItems || [],
      agreementList: equipmentData?.agreements || [],
      poleList: equipmentData?.poleResults || []
    };

    submitWork(completeData, {
      onSuccess: (result) => {
        if (result.code === 'SUCCESS' || result.code === 'OK') {
          localStorage.removeItem(getStorageKey());

          // 철거해지 완료 후 인입선로 철거관리 모달 표시 조건 체크
          // 레거시: KPI_PROD_GRP_CD in (C, D, I), VOIP_CTX가 T/R이 아닌 경우
          const kpiProdGrpCd = order.KPI_PROD_GRP_CD || '';
          const voipCtx = order.VOIP_CTX || '';
          const isTargetProdGrp = ['C', 'D', 'I'].includes(kpiProdGrpCd);
          const isVoipExcluded = voipCtx !== 'T' && voipCtx !== 'R';

          console.log('[WorkCompleteRemovalTerminate] 인입선로 철거관리 모달 조건:', {
            KPI_PROD_GRP_CD: kpiProdGrpCd,
            VOIP_CTX: voipCtx,
            isTargetProdGrp,
            isVoipExcluded
          });

          if (isTargetProdGrp && isVoipExcluded) {
            console.log('[WorkCompleteRemovalTerminate] 인입선로 철거관리 모달 표시');
            setShowRemovalLineModal(true);
            return;
          }

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
            {/* 고객명 (편집 가능) - 레거시: edt_cust_nm */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                고객명 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={cnfmCustNm}
                onChange={(e) => setCnfmCustNm(e.target.value)}
                placeholder="고객명 입력"
                className={`w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 border rounded-lg text-sm sm:text-base ${isWorkCompleted ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
            </div>

            {/* 연락처 (편집 가능) - 레거시: edt_cust_telno */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                연락처 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <input
                type="tel"
                value={cnfmCustTelno}
                onChange={(e) => setCnfmCustTelno(e.target.value)}
                placeholder="연락처 입력"
                className={`w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 border rounded-lg text-sm sm:text-base ${isWorkCompleted ? 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
            </div>

            {/* 재사용 체크박스 (조건부 표시) - 레거시: chk_reuse_yn */}
            {showReuseCheckbox && !isWorkCompleted && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <input
                  type="checkbox"
                  id="reuseYn"
                  checked={reuseYn}
                  onChange={(e) => setReuseYn(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="reuseYn" className="text-sm font-medium text-gray-700">
                  회수장비 재사용 (이전 설치 작업에 재사용)
                </label>
              </div>
            )}

            {/* 망구분 + 철거정보 버튼 (필수) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                망구분 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={networkTypeName || ''}
                  readOnly
                  disabled
                  placeholder="철거정보에서 입력 (필수)"
                  className="flex-1 min-w-0 min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600 cursor-not-allowed truncate"
                />
                <button
                  type="button"
                  onClick={() => setShowInstallInfoModal(true)}
                  className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${isWorkCompleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '철거정보'}
                </button>
              </div>
              {!isWorkCompleted && !installInfoData?.NET_CL && (
                <p className="mt-1 text-xs text-red-500">* 철거정보에서 망구분과 설치유형을 입력해주세요.</p>
              )}
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

            {/* 해지정보 (토글 섹션) */}
            <HotbillSection
              custId={order.customer?.id || order.CUST_ID || ''}
              rcptId={order.RCPT_ID || ''}
              ctrtId={order.CTRT_ID || ''}
              soId={order.SO_ID || ''}
              termDt={(order as any).TERM_DT || ''}
              wrkCd={order.WRK_CD}
              showToast={showToast}
            />

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
        </div>
      </div>

      {/* 철거정보 모달 */}
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
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD || order.KPI_PROD_GRP_CD}
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

      {/* 인입선로 철거관리 모달 (레거시 mowoa03p05) */}
      <RemovalLineManageModal
        isOpen={showRemovalLineModal}
        onClose={() => setShowRemovalLineModal(false)}
        onComplete={handleRemovalLineComplete}
        onAssignAS={handleRemovalLineAssignAS}
        showToast={showToast}
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
        title="작업 완료"
        message={confirmMessage}
        type="confirm"
        confirmText="완료"
        cancelText="취소"
      />
    </div>
  );
};

export default CompleteRemovalTerminate;
