import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail, checkStbServerConnection } from '../../../../services/apiService';
import Select from '../../../ui/Select';
import InstallInfoModal, { InstallInfoData } from '../../../modal/InstallInfoModal';
import HotbillSection from '../HotbillSection';
import ConfirmModal from '../../../common/ConfirmModal';
import WorkCompleteSummary from '../WorkCompleteSummary';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useWorkEquipment } from '../../../../stores/workEquipmentStore';
import { useCompleteWork } from '../../../../hooks/mutations/useCompleteWork';
import '../../../../styles/buttons.css';

/**
 * CompleteRemoval - 부가상품(WRK_CD=09) 작업완료 컴포넌트
 *
 * 레거시 참조: mowoa03m09.xml - 작업완료(부가상품)
 *
 * 특징:
 * - 장비등록/회수/변경 버튼 모두 표시 (3단계에서 처리)
 * - 부가상품 정보 입력 (망구분 등)
 * - 설치위치 입력 필드 없음
 * - 상향제어, 인터넷/VoIP/디지털 이용구분 없음
 * - fn_signal_trans + fn_delsignal_trans (신호 삭제 처리)
 */
interface CompleteRemovalProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteRemoval: React.FC<CompleteRemovalProps> = ({
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

  // React Query Mutation
  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  // localStorage 키
  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 기본 정보 State
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');
  const [cnfmCustNm, setCnfmCustNm] = useState(order.customer?.name || '');
  const [cnfmCustTelno, setCnfmCustTelno] = useState(order.customer?.phone || '');

  // 재사용 여부 (레거시: chk_reuse_yn)
  const [reuseYn, setReuseYn] = useState(false);

  // 설치(철거)정보 모달
  const [showInstallInfoModal, setShowInstallInfoModal] = useState(false);
  const [networkType, setNetworkType] = useState('');
  const [networkTypeName, setNetworkTypeName] = useState('');
  const [installInfoData, setInstallInfoData] = useState<InstallInfoData | undefined>(undefined);


  // 작업완료 확인 모달
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  // 재사용 체크박스 표시 조건 (레거시: mowoa03m08 592-601)
  // MVM_TP='1'(기사변경), WRK_STAT_CD in ('1','2'), 해당 CTRT_ID의 정상 계약
  const showReuseCheckbox = (order as any).MVM_TP === '1'
    && ['1', '2'].includes(order.WRK_STAT_CD || '')
    && order.CTRT_ID;

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

  // 데이터 복원 - API에서 기존 설치정보 로드 (레거시 fn_get_instl_up_info와 동일)
  useEffect(() => {
    const fetchWorkDetail = async () => {
      try {
        console.log('[WorkCompleteRemoval] getWorkReceiptDetail API 호출');
        const detail = await getWorkReceiptDetail({
          WRK_DRCTN_ID: order.directionId || order.WRK_DRCTN_ID || '',
          WRK_ID: order.id,  // order.id가 실제 WRK_ID
          SO_ID: order.SO_ID
        });

        if (detail) {
          console.log('[WorkCompleteRemoval] API 응답:', detail);

          // 완료된 작업: API 데이터로 모든 필드 복원
          if (isWorkCompleted) {
            setCustRel(detail.CUST_REL || '');
            setMemo((detail.MEMO || '').replace(/\\n/g, '\n'));
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
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          } else {
            // 진행 중 작업: localStorage 확인 후 없으면 API 데이터 사용
            const savedDraft = localStorage.getItem(getStorageKey());
            if (savedDraft) {
              try {
                const draftData = JSON.parse(savedDraft);
                // localStorage에 철거정보가 있으면 사용
                if (draftData.installInfoData && draftData.installInfoData.NET_CL) {
                  console.log('[WorkCompleteRemoval] localStorage에서 철거정보 복원');
                  setCustRel(draftData.custRel || '');
                  setMemo(draftData.memo || '');
                  setNetworkType(draftData.networkType || '');
                  setNetworkTypeName(draftData.networkTypeName || '');
                  setInstallInfoData(draftData.installInfoData);
                } else {
                  // localStorage에 철거정보 없으면 API 데이터를 초기값으로 설정
                  console.log('[WorkCompleteRemoval] API에서 기존 철거정보 로드');
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
                  });
                  // localStorage의 다른 필드는 복원
                  setCustRel(draftData.custRel || '');
                  setMemo(draftData.memo || '');
                }
              } catch (error) {
                console.error('[WorkCompleteRemoval] localStorage 파싱 실패:', error);
                // 파싱 실패 시 API 데이터 사용
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
                });
              }
            } else {
              // localStorage 없으면 API 데이터를 초기값으로 설정
              console.log('[WorkCompleteRemoval] localStorage 없음 - API에서 기존 철거정보 로드');
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
              });
            }
          }
        } else {
          console.log('[WorkCompleteRemoval] API 응답 없음 - localStorage에서 복원 시도');
          // API 응답 없으면 localStorage에서 복원
          const savedDraft = localStorage.getItem(getStorageKey());
          if (savedDraft) {
            try {
              const draftData = JSON.parse(savedDraft);
              setCustRel(draftData.custRel || '');
              setMemo(draftData.memo || '');
              setNetworkType(draftData.networkType || '');
              setNetworkTypeName(draftData.networkTypeName || '');
              setInstallInfoData(draftData.installInfoData);
            } catch (error) {
              console.error('[WorkCompleteRemoval] localStorage 복원 실패:', error);
            }
          }
        }
      } catch (error) {
        console.error('[WorkCompleteRemoval] API 호출 실패:', error);
        // API 실패 시 localStorage에서 복원
        const savedDraft = localStorage.getItem(getStorageKey());
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            setCustRel(draftData.custRel || '');
            setMemo(draftData.memo || '');
            setNetworkType(draftData.networkType || '');
            setNetworkTypeName(draftData.networkTypeName || '');
            setInstallInfoData(draftData.installInfoData);
          } catch (parseError) {
            console.error('[WorkCompleteRemoval] localStorage 복원 실패:', parseError);
          }
        }
      } finally {
        setIsDataLoaded(true);
      }
    };

    fetchWorkDetail();
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;

    const draftData = {
      custRel, memo,
      networkType, networkTypeName,
      installInfoData,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, networkType, networkTypeName, installInfoData, isDataLoaded, isWorkCompleted]);

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
        console.error('[WorkCompleteRemoval] 초기 데이터 로드 실패:', error);
      }
    };

    loadInitialData();
  }, []);

  // 검증 - 레거시 mowoa03m09 동일
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
    // 고객관계 필수
    if (!custRel || custRel === '[]') {
      errors.push('고객과의 관계를 선택해주세요.');
    }
    // 철거정보 필수: 망구분
    if (!installInfoData?.NET_CL) {
      errors.push('철거정보에서 망구분을 선택해주세요.');
    }
    // 철거정보 필수: 배선방식
    if (!installInfoData?.WRNG_TP) {
      errors.push('철거정보에서 배선방식을 선택해주세요.');
    }
    // 철거정보 필수: 설치유형
    if (!installInfoData?.INSTL_TP) {
      errors.push('철거정보에서 설치유형을 선택해주세요.');
    }
    // 작업처리일 필수
    if (!workCompleteDate) {
      errors.push('작업처리일을 선택해주세요.');
    }

    // 장비 철거 검증 (레거시 동일)
    // VoIP가 아닌 경우 철거 장비가 최소 1개 이상 있어야 함
    const prodGrp = (order as any).PROD_GRP || '';
    const removedEquipments = equipmentData?.removedEquipments || [];
    if (prodGrp !== 'V' && removedEquipments.length < 1) {
      errors.push('철거할 장비가 없습니다. 장비 정보를 확인해주세요.');
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

  // 작업 완료 처리 - 확인 모달 표시
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

    // 레거시 mowoa03m09: 철거는 fn_signal_trans + fn_delsignal_trans 동시 처리
    const message = (equipmentData?.removedEquipments?.length > 0 || equipmentData?.installedEquipments?.length > 0)
      ? '작업을 완료하시겠습니까?\n(신호번호 처리 및 삭제 업무도 동시에 처리됩니다.)'
      : '작업을 완료하시겠습니까?';

    setConfirmMessage(message);
    setShowConfirmModal(true);
  };

  // 실제 작업 완료 처리
  const handleConfirmSubmit = async () => {
    console.log('[WorkCompleteRemoval] 작업완료 처리 시작');

    const formattedDate = workCompleteDate.replace(/-/g, '');
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';

    // 부가상품 전용 신호 호출 (레거시 fn_signal_buga_trans - mowoa03m09.xml Line 1032-1076)
    // WRK_DTL_TCD='0910' (부가상품 설치) → SMR06
    // WRK_DTL_TCD='0920' (부가상품 철거) → SMR08
    const wrkDtlTcd = order.WRK_DTL_TCD || '';
    if (wrkDtlTcd === '0910' || wrkDtlTcd === '0920') {
      const bugaMsgId = wrkDtlTcd === '0910' ? 'SMR06' : 'SMR08';
      try {
        const regUid = user.userId || user.id || 'UNKNOWN';
        // 고객장비에서 첫 번째 장비 번호 가져오기
        const customerEquipments = equipmentData?.customerEquipments || [];
        const firstEquip = customerEquipments[0] || equipmentData?.installedEquipments?.[0];
        const eqtNo = firstEquip?.EQT_NO || firstEquip?.id || '';

        console.log(`[CompleteRemoval] 부가상품 신호(${bugaMsgId}) 호출:`, { eqtNo, wrkDtlTcd });
        await checkStbServerConnection(
          regUid,
          order.CTRT_ID || '',
          order.id,
          bugaMsgId,
          eqtNo,
          ''
        );
        console.log(`[CompleteRemoval] 부가상품 신호(${bugaMsgId}) 호출 완료`);
      } catch (error) {
        console.log('[CompleteRemoval] 부가상품 신호 처리 중 오류 (무시하고 계속 진행):', error);
      }
    }

    // 회수 장비가 있으면 철거 신호(SMR05) 호출 (레거시 fn_delsignal_trans 동일)
    const removedEquipments = equipmentData?.removedEquipments || [];
    if (removedEquipments.length > 0) {
      try {
        const regUid = user.userId || user.id || 'UNKNOWN';
        const firstEquip = removedEquipments[0];
        console.log('[CompleteRemoval] 철거 신호(SMR05) 호출:', { eqtNo: firstEquip.EQT_NO || firstEquip.id });
        await checkStbServerConnection(
          regUid,
          order.CTRT_ID || '',
          order.id,
          'SMR05',
          firstEquip.EQT_NO || firstEquip.id || '',
          ''
        );
        console.log('[CompleteRemoval] 철거 신호(SMR05) 호출 완료');
      } catch (error) {
        console.log('[CompleteRemoval] 철거 신호 처리 중 오류 (무시하고 계속 진행):', error);
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
          CRR_TSK_CL: order.WRK_CD || '09',
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
            OLD_LENT_YN: actual.OLD_LENT_YN || 'N',
            LENT: actual.LENT || '10',
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
        CNFM_CUST_NM: cnfmCustNm,
        CNFM_CUST_TELNO: cnfmCustTelno,
        REUSE_YN: reuseYn ? 'Y' : 'N',
        // 부가상품: 기존 설치위치 유지 (레거시 mowoa03m09.xml:1343)
        INSTL_LOC: (order as any).INSTL_LOC || order.installLocation || '',
        // 철거: 상향제어, 서비스이용구분 없음
        UP_CTRL_CL: '',
        PSN_USE_CORP: '',
        VOIP_USE_CORP: '',
        DTV_USE_CORP: '',
        WRK_ACT_CL: '20',
        // 철거정보
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
        VOIP_JOIN_CTRT_ID: '',
        AGREE_YN: '',
        ISP_YN: '',
        AGREE_GB: '',
        CUST_CLEAN_YN: '',
        EQT_RMV_FLAG: '',
        TV_TYPE: ''
      },
      // 철거: 설치/회수 장비 모두 가능
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
                  className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${isWorkCompleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {isWorkCompleted ? '보기' : '철거정보'}
                </button>
              </div>
            </div>

            {/* 고객명 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                고객명 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={cnfmCustNm}
                onChange={(e) => setCnfmCustNm(e.target.value)}
                placeholder="고객명을 입력하세요"
                className={`w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base ${isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
                연락처 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <input
                type="tel"
                value={cnfmCustTelno}
                onChange={(e) => setCnfmCustTelno(e.target.value)}
                placeholder="연락처를 입력하세요"
                className={`w-full min-h-10 sm:min-h-12 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base ${isWorkCompleted ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`}
                readOnly={isWorkCompleted}
                disabled={isWorkCompleted}
              />
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

            {/* 재사용 여부 체크박스 - MVM_TP='1', WRK_STAT_CD in (1,2), 계약있는 경우만 표시 */}
            {showReuseCheckbox && !isWorkCompleted && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <input
                  type="checkbox"
                  id="reuseYn"
                  checked={reuseYn}
                  onChange={(e) => setReuseYn(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="reuseYn" className="text-sm font-medium text-gray-700">
                  재사용 (기사변경 시 기존 장비 재사용)
                </label>
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
            {!isWorkCompleted && (
              <div className="flex gap-1.5 sm:gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-gray-200">
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
              </div>
            )}

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
        addrOrd={(order as any).ADDR_ORD || ''}
        kpiProdGrpCd={equipmentData?.kpiProdGrpCd || equipmentData?.KPI_PROD_GRP_CD || order.KPI_PROD_GRP_CD}
        prodChgGb={equipmentData?.prodChgGb || equipmentData?.PROD_CHG_GB || (order as any).PROD_CHG_GB}
        chgKpiProdGrpCd={equipmentData?.chgKpiProdGrpCd || equipmentData?.CHG_KPI_PROD_GRP_CD || (order as any).CHG_KPI_PROD_GRP_CD}
        prodGrp={equipmentData?.prodGrp || equipmentData?.PROD_GRP || (order as any).PROD_GRP}
        wrkDtlTcd={order.WRK_DTL_TCD}
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
          equipmentData={equipmentData}
          installInfoData={installInfoData}
          custRel={custRel}
          custRelOptions={custRelOptions}
          memo={memo}
          order={order}
        />
      </ConfirmModal>
    </div>
  );
};

export default CompleteRemoval;
