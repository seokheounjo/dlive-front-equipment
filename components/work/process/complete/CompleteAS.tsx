/**
 * CompleteAS.tsx
 * WRK_CD=03 (A/S) 작업완료 페이지
 *
 * 레거시 참조: mowoa03m03.xml
 * 특징:
 * - KPI제품그룹 선택 필수
 * - 처리유형/처리유형상세 선택 필수
 * - 설치정보 입력 필수
 * - 상향제어(UP_CTRL_CL) 선택 - 공통코드 CMCT015
 * - TV타입(TV_TYPE) 입력
 */
import React, { useState, useEffect, useMemo } from 'react';
import { WorkOrder, WorkCompleteData } from '../../../../types';
import { getCommonCodeList, CommonCode, getWorkReceiptDetail, getCustomerContractInfo, checkStbServerConnection, getCodeDetail, CommonCodeDetail, custEqtInfoDel } from '../../../../services/apiService';
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

interface CompleteASProps {
  order: WorkOrder;
  onBack: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  equipmentData?: any;
  readOnly?: boolean;
}

const CompleteAS: React.FC<CompleteASProps> = ({
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

  const [isDataLoaded, setIsDataLoaded] = useState(false);
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

  const { mutate: submitWork, isPending: isLoading } = useCompleteWork();

  const getStorageKey = () => `work_complete_draft_${order.id}`;

  // 폼 상태
  const [custRel, setCustRel] = useState('');
  const [memo, setMemo] = useState('');
  const [kpiProdGrp, setKpiProdGrp] = useState(''); // KPI제품그룹 (레거시: cmb_kpi_prod_grp)
  const [obsRcptCd, setObsRcptCd] = useState(''); // 처리유형 (레거시: cmb_obs_rcpt_cd)
  const [obsRcptDtlCd, setObsRcptDtlCd] = useState(''); // 처리유형상세 (레거시: cmb_obs_rcpt_dtl_cd)
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

  // 상향제어 (레거시: cmb_up_ctrl_cl - 공통코드 CMCT015)
  const [upCtrlCl, setUpCtrlCl] = useState('');

  // TV타입 (레거시: tv_type)
  const [tvType, setTvType] = useState('');

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

  // 공통코드
  const [custRelOptions, setCustRelOptions] = useState<{ value: string; label: string }[]>([]);
  const [internetOptions, setInternetOptions] = useState<{ value: string; label: string }[]>([]);
  const [voipOptions, setVoipOptions] = useState<{ value: string; label: string }[]>([]);
  const [dtvOptions, setDtvOptions] = useState<{ value: string; label: string }[]>([]);
  const [upCtrlClOptions, setUpCtrlClOptions] = useState<{ value: string; label: string }[]>([]); // 상향제어 (CMCT015)

  // A/S 전용 공통코드 (레거시: PP00933, CMOB000, CMOB001)
  // 전체 코드 데이터 저장 (필터링용 REF_CODE 포함)
  const [allKpiProdGrpCodes, setAllKpiProdGrpCodes] = useState<CommonCodeDetail[]>([]); // PP00933
  const [allObsRcptCdCodes, setAllObsRcptCdCodes] = useState<CommonCodeDetail[]>([]);   // CMOB000
  const [allObsRcptDtlCdCodes, setAllObsRcptDtlCdCodes] = useState<CommonCodeDetail[]>([]); // CMOB001
  // 필터링된 옵션 (Select 표시용)
  const [kpiProdGrpOptions, setKpiProdGrpOptions] = useState<{ value: string; label: string }[]>([]);
  const [obsRcptCdOptions, setObsRcptCdOptions] = useState<{ value: string; label: string }[]>([]);
  const [obsRcptDtlCdOptions, setObsRcptDtlCdOptions] = useState<{ value: string; label: string }[]>([]);

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
            setMemo((detail.MEMO || '').replace(/\\n/g, '\n'));
            setKpiProdGrp(detail.KPI_PROD_GRP || '');
            setObsRcptCd(detail.OBS_RCPT_CD || '');
            setObsRcptDtlCd(detail.OBS_RCPT_DTL_CD || '');
            setInternetUse(detail.PSN_USE_CORP || '');
            setVoipUse(detail.VOIP_USE_CORP || '');
            setDtvUse(detail.DTV_USE_CORP || '');
            setNetworkType(detail.NET_CL || '');
            setNetworkTypeName(detail.NET_CL_NM || '');
            setInstallLocationText(detail.INSTL_LOC || '');
            // 상향제어: API 응답에 없으면 장비 데이터(output1)에서 가져옴
            const upCtrlClValue = detail.UP_CTRL_CL || equipmentData?.upCtrlCl || '';
            console.log('[CompleteAS] 상향제어 값:', { API: detail.UP_CTRL_CL, 장비데이터: equipmentData?.upCtrlCl, 최종: upCtrlClValue });
            setUpCtrlCl(upCtrlClValue);
            setTvType(detail.TV_TYPE || '');
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

            // 작업처리일 복원
            if (detail.WRKR_CMPL_DT && detail.WRKR_CMPL_DT.length >= 8) {
              setWorkCompleteDate(`${detail.WRKR_CMPL_DT.slice(0,4)}-${detail.WRKR_CMPL_DT.slice(4,6)}-${detail.WRKR_CMPL_DT.slice(6,8)}`);
            }
          }
        } catch (error) {
          console.error('[WorkCompleteAS] 완료 작업 상세 조회 실패:', error);
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
        setKpiProdGrp(draftData.kpiProdGrp || '');
        setObsRcptCd(draftData.obsRcptCd || '');
        setObsRcptDtlCd(draftData.obsRcptDtlCd || '');
        setInternetUse(draftData.internetUse || '');
        setVoipUse(draftData.voipUse || '');
        setDtvUse(draftData.dtvUse || '');
        setNetworkType(draftData.networkType || '');
        setNetworkTypeName(draftData.networkTypeName || '');
        setInstallLocationText(draftData.installLocationText || '');
        setInstallInfoData(draftData.installInfoData);
        // 상향제어, TV타입 복원
        if (draftData.upCtrlCl) setUpCtrlCl(draftData.upCtrlCl);
        if (draftData.tvType) setTvType(draftData.tvType);
        // 결합계약 ID 복원
        if (draftData.voipJoinCtrtId) setVoipJoinCtrtId(draftData.voipJoinCtrtId);
      } catch (error) {
        console.error('[WorkCompleteAS] localStorage 복원 실패:', error);
      }
    }
    setIsDataLoaded(true);
  }, [order.id, isWorkCompleted]);

  // 자동 저장
  useEffect(() => {
    if (!isDataLoaded || isWorkCompleted) return;
    const draftData = {
      custRel, memo, kpiProdGrp, obsRcptCd, obsRcptDtlCd,
      internetUse, voipUse, dtvUse, networkType, networkTypeName,
      installLocationText, installInfoData, upCtrlCl, tvType,
      voipJoinCtrtId,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(draftData));
  }, [custRel, memo, kpiProdGrp, obsRcptCd, obsRcptDtlCd, internetUse, voipUse, dtvUse,
      networkType, networkTypeName, installLocationText, installInfoData,
      upCtrlCl, tvType, voipJoinCtrtId, isDataLoaded, isWorkCompleted]);

  // 공통코드 로드
  useEffect(() => {
    const loadCodes = async () => {
      try {
        // 기본 공통코드: CMCU005(고객관계), CMCU057(인터넷), CMCU110(VoIP), CMCU148(디지털), CMCT015(상향제어)
        const codes = await getCommonCodeList([
          'CMCU005', 'CMCU057', 'CMCU110', 'CMCU148', 'CMCT015'
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
        if (codes['CMCT015']) {
          console.log('[CompleteAS] 공통코드 CMCT015 옵션:', codes['CMCT015']);
          setUpCtrlClOptions(codes['CMCT015'].map((code: CommonCode) => ({
            value: code.COMMON_CD, label: code.COMMON_CD_NM
          })));
        }

        // A/S 전용 공통코드 (레거시: PP00933, CMOB000, CMOB001)
        // REF_CODE 필드가 필요하므로 getCodeDetail 사용
        const [kpiCodes, obsRcptCodes, obsRcptDtlCodes] = await Promise.all([
          getCodeDetail({ COMMON_GRP: 'PP00933' }),   // KPI상품군/서비스그룹
          getCodeDetail({ COMMON_GRP: 'CMOB000' }),   // 처리유형 (망장애유형)
          getCodeDetail({ COMMON_GRP: 'CMOB001' }),   // 처리유형상세 (망장애유형상세)
        ]);

        console.log('[CompleteAS] A/S 공통코드 로드:', {
          PP00933: kpiCodes.length,
          CMOB000: obsRcptCodes.length,
          CMOB001: obsRcptDtlCodes.length,
        });

        // 전체 코드 저장 (필터링용)
        setAllKpiProdGrpCodes(kpiCodes);
        setAllObsRcptCdCodes(obsRcptCodes);
        setAllObsRcptDtlCdCodes(obsRcptDtlCodes);

        // 초기 옵션 설정 (필터링은 별도 useEffect에서 처리)
        setKpiProdGrpOptions(kpiCodes.map((code) => ({
          value: code.COMMON_CD || '', label: code.COMMON_CD_NM || ''
        })));

      } catch (error) {
        console.error('[WorkCompleteAS] 공통코드 로드 실패:', error);
      }
    };
    loadCodes();
  }, []);

  // 상향제어: equipmentData가 나중에 로드되면 업데이트, 없으면 기본값 '01'(쌍방향) 설정
  useEffect(() => {
    if (equipmentData?.upCtrlCl && !upCtrlCl) {
      console.log('[CompleteAS] equipmentData에서 상향제어 업데이트:', equipmentData.upCtrlCl);
      setUpCtrlCl(equipmentData.upCtrlCl);
    } else if (!upCtrlCl && isDataLoaded && !isWorkCompleted) {
      // 데이터 로드 완료 후에도 상향제어 값이 없으면 기본값 '01'(쌍방향) 설정
      console.log('[CompleteAS] 상향제어 기본값 설정: 01 (쌍방향)');
      setUpCtrlCl('01');
    }
  }, [equipmentData?.upCtrlCl, isDataLoaded, isWorkCompleted, upCtrlCl]);

  // =============================================
  // A/S 공통코드 필터링 로직 (레거시: mowoDivE03.xml)
  // =============================================

  // 서비스그룹(KPI_PROD_GRP) 필터링 - 레거시: fn_filterProdGrp
  // KPI_PROD_GRP_CD 기준으로 필터링, PROD_GRP='C'면 'I' 추가
  useEffect(() => {
    if (allKpiProdGrpCodes.length === 0) return;

    const kpiProdGrpCd = (order as any).KPI_PROD_GRP_CD || equipmentData?.kpiProdGrpCd || '';
    const prodGrp = (order as any).PROD_GRP || equipmentData?.prodGrp || '';

    console.log('[CompleteAS] 서비스그룹 필터링:', { kpiProdGrpCd, prodGrp });

    let filtered = allKpiProdGrpCodes;

    if (kpiProdGrpCd) {
      // 기본 필터: KPI_PROD_GRP_CD와 일치하는 코드
      filtered = allKpiProdGrpCodes.filter(code => {
        const cd = code.COMMON_CD || '';
        // 기본 매칭
        if (cd === kpiProdGrpCd) return true;
        // PROD_GRP='C'(콤보)면 'I'(ISP) 추가 (레거시 동일)
        if (prodGrp === 'C' && cd === 'I') return true;
        return false;
      });
    }

    // 빈 선택 옵션 추가
    const options = [
      { value: '', label: '선택' },
      ...filtered.map(code => ({
        value: code.COMMON_CD || '',
        label: code.COMMON_CD_NM || ''
      }))
    ];

    setKpiProdGrpOptions(options);

    // KPI_PROD_GRP_CD 값이 있고 아직 선택 안 했으면 자동 설정
    if (kpiProdGrpCd && !kpiProdGrp && !isWorkCompleted) {
      setKpiProdGrp(kpiProdGrpCd);
    }
  }, [allKpiProdGrpCodes, order, equipmentData?.kpiProdGrpCd, equipmentData?.prodGrp, isWorkCompleted]);

  // 처리유형(OBS_RCPT_CD) 필터링 - 레거시: cmb_kpi_prod_grp_OnChanged
  // REF_CODE2에 선택된 KPI_PROD_GRP 포함, WRK_STAT_CD='2'이면 'KA' 제외
  useEffect(() => {
    if (allObsRcptCdCodes.length === 0) return;

    const wrkStatCd = order.WRK_STAT_CD || '';
    const wrkRcptCl = (order as any).WRK_RCPT_CL || '';
    const wrkRcptClDtl = (order as any).WRK_RCPT_CL_DTL || '';

    console.log('[CompleteAS] 처리유형 필터링:', { kpiProdGrp, wrkStatCd, wrkRcptCl, wrkRcptClDtl });

    // 처리유형상세 초기화
    setObsRcptDtlCdOptions([{ value: '', label: '선택' }]);

    if (!kpiProdGrp) {
      setObsRcptCdOptions([{ value: '', label: '서비스그룹을 먼저 선택하세요' }]);
      return;
    }

    const filtered = allObsRcptCdCodes.filter(code => {
      const cd = code.COMMON_CD || '';
      const refCode2 = code.REF_CODE2 || '';
      const refCode12 = code.REF_CODE12 || '';

      // REF_CODE2에 선택된 KPI_PROD_GRP 포함되어야 함
      if (!refCode2.includes(kpiProdGrp)) return false;

      // WRK_STAT_CD='2'(작업중)이면 'KA'(전송망이관) 제외
      if (wrkStatCd === '2' && cd === 'KA') return false;

      // 접수분류코드 필터링 (REF_CODE12)
      if (refCode12) {
        if (refCode12 === wrkRcptClDtl || refCode12 === wrkRcptCl) {
          return true;
        }
        return false;
      }

      return true;
    });

    const options = [
      { value: '', label: '선택' },
      ...filtered.map(code => ({
        value: code.COMMON_CD || '',
        label: code.COMMON_CD_NM || ''
      }))
    ];

    setObsRcptCdOptions(options);

    // 기존 선택값이 필터링 결과에 없으면 초기화
    if (obsRcptCd && !filtered.some(c => c.COMMON_CD === obsRcptCd)) {
      setObsRcptCd('');
      setObsRcptDtlCd('');
    }
  }, [kpiProdGrp, allObsRcptCdCodes, order.WRK_STAT_CD, (order as any).WRK_RCPT_CL, (order as any).WRK_RCPT_CL_DTL]);

  // 처리유형상세(OBS_RCPT_DTL_CD) 필터링 - 레거시: cmb_obs_rcpt_cd_OnChanged
  // REF_CODE에 OBS_RCPT_CD 포함, REF_CODE2에 KPI_PROD_GRP 포함
  useEffect(() => {
    if (allObsRcptDtlCdCodes.length === 0) return;

    const wrkDtlTcd = order.WRK_DTL_TCD || '';
    const wrkRcptCl = (order as any).WRK_RCPT_CL || '';
    const wrkRcptClDtl = (order as any).WRK_RCPT_CL_DTL || '';

    console.log('[CompleteAS] 처리유형상세 필터링:', { obsRcptCd, kpiProdGrp, wrkDtlTcd, wrkRcptClDtl });

    if (!obsRcptCd || !kpiProdGrp) {
      setObsRcptDtlCdOptions([{ value: '', label: '처리유형을 먼저 선택하세요' }]);
      return;
    }

    const filtered = allObsRcptDtlCdCodes.filter(code => {
      const cd = code.COMMON_CD || '';
      const refCode = code.REF_CODE || '';    // 상위 처리유형 코드
      const refCode2 = code.REF_CODE2 || '';  // 적용 상품군
      const refCode12 = code.REF_CODE12 || '';
      const refCode16 = code.REF_CODE16 || '';

      // REF_CODE에 OBS_RCPT_CD 포함되어야 함
      if (!refCode.includes(obsRcptCd)) return false;

      // REF_CODE2에 KPI_PROD_GRP 포함되어야 함
      if (!refCode2.includes(kpiProdGrp)) return false;

      // WRK_DTL_TCD='0350'이면 REF_CODE16='A' 또는 'Y'
      if (wrkDtlTcd === '0350') {
        if (refCode16 !== 'A' && refCode16 !== 'Y') return false;
      } else {
        // 그 외는 REF_CODE16이 비어있거나 'A'
        if (refCode16 && refCode16 !== 'A') return false;
      }

      // 접수분류코드 필터링 (REF_CODE12)
      if (refCode12) {
        if (refCode12 === wrkRcptClDtl || refCode12 === wrkRcptCl) {
          return true;
        }
        return false;
      }

      // 접수분류코드 JJO(장애감시서버)면 OOI(장비상태개선)만 표시
      if (wrkRcptClDtl === 'JJO' && cd !== 'OOI') {
        return false;
      }

      return true;
    });

    const options = [
      { value: '', label: '선택' },
      ...filtered.map(code => ({
        value: code.COMMON_CD || '',
        label: code.COMMON_CD_NM || ''
      }))
    ];

    setObsRcptDtlCdOptions(options);

    // 기존 선택값이 필터링 결과에 없으면 초기화
    if (obsRcptDtlCd && !filtered.some(c => c.COMMON_CD === obsRcptDtlCd)) {
      setObsRcptDtlCd('');
    }
  }, [obsRcptCd, kpiProdGrp, allObsRcptDtlCdCodes, order.WRK_DTL_TCD, (order as any).WRK_RCPT_CL, (order as any).WRK_RCPT_CL_DTL]);

  // 고객 계약 목록 로드 (결합계약 선택용)
  useEffect(() => {
    if (isWorkCompleted) return;

    const custId = order.customer?.id || (order as any).CUST_ID;
    if (!custId) return;

    const loadCustomerContracts = async () => {
      try {
        console.log('[WorkCompleteAS] 고객 계약 목록 조회 시작:', custId);
        const contracts = await getCustomerContractInfo({ CUST_ID: custId });
        console.log('[WorkCompleteAS] 고객 계약 목록:', contracts);
        setCustomerCtrtList(contracts || []);
      } catch (error) {
        console.error('[WorkCompleteAS] 고객 계약 목록 조회 실패:', error);
        setCustomerCtrtList([]);
      }
    };

    loadCustomerContracts();
  }, [order.customer?.id, (order as any).CUST_ID, isWorkCompleted]);

  // VoIP/ISP 결합 계약 처리 (레거시: mowoa03m03.xml)
  useEffect(() => {
    if (isWorkCompleted) return;
    if (customerCtrtList.length === 0) {
      console.log('[WorkCompleteAS] 고객 계약 목록 대기 중...');
      return;
    }

    const prodGrp = (order as any).PROD_GRP || '';
    const voipProdCd = (order as any).VOIP_PROD_CD || '';
    const ispProdCd = (order as any).ISP_PROD_CD || '';
    const wrkStatCd = order.WRK_STAT_CD || '';
    const addrOrd = (order as any).ADDR_ORD || '';

    console.log('[WorkCompleteAS] 결합계약 필터링 시작:', {
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

      console.log('[WorkCompleteAS] VoIP 결합계약 필터링 결과:', filteredContracts);

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

      console.log('[WorkCompleteAS] ISP 결합계약 필터링 결과:', filteredContracts);

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
    if (!kpiProdGrp) errors.push('제품그룹을 선택해주세요.');
    if (!obsRcptCd) errors.push('처리유형을 선택해주세요.');
    if (!obsRcptDtlCd) errors.push('처리유형상세를 선택해주세요.');
    if (!installInfoData?.NET_CL) errors.push('설치정보를 입력해주세요.');
    if (!workCompleteDate) errors.push('작업처리일을 선택해주세요.');

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
    // A/S 작업에서 장비 변경이 있는 경우, VoIP가 아니면 장비 필수
    const installedEquipments = equipmentData?.installedEquipments || [];
    const removedEquipments = equipmentData?.removedEquipments || [];
    const hasEquipmentChange = installedEquipments.length > 0 || removedEquipments.length > 0;
    // A/S는 장비 변경 없이도 완료 가능하지만, 변경 시 정상적으로 등록되어야 함
    // VoIP가 아닌 경우 장비가 하나도 없으면 경고 (단, A/S는 장비 변경 선택적)

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

  // 장비 목록 변환 함수 (nested → flat)
  const processEquipmentList = (equipments: any[], isRemoval = false) => {
    if (!equipments || equipments.length === 0) return [];
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';
    const removalStatus = equipmentData?.removalStatus || {};

    return equipments.map((eq: any) => {
      const eqtNo = eq.EQT_NO || eq.id || (eq.actualEquipment?.id) || '';
      const status = removalStatus[eqtNo] || {};
      const removalFields = isRemoval ? {
        CRR_TSK_CL: order.WRK_CD || '03',
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
          LENT_YN: actual.LENT_YN || '10',
          ITLLMT_PRD: actual.ITLLMT_PRD || '00',
          EQT_USE_STAT_CD: actual.EQT_USE_STAT_CD || '1',
          EQT_CHG_GB: '1',
          IF_DTL_ID: actual.IF_DTL_ID || '',
          VOIP_CUSTOWN_EQT: actual.VOIP_CUSTOWN_EQT || 'N',
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

  // 실제 작업 완료 처리
  const handleConfirmSubmit = async () => {
    const formattedDate = workCompleteDate.replace(/-/g, '');
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';

    // 회수 장비가 있으면 철거 신호(SMR05) 호출 (레거시: mowoa03m03.xml fn_delsignal_trans)
    const removedEquipments = equipmentData?.removedEquipments || [];
    if (removedEquipments.length > 0) {
      try {
        const regUid = user.userId || user.id || 'UNKNOWN';
        // 첫 번째 회수 장비에 대해 철거 신호 호출 (레거시 동일)
        const firstEquip = removedEquipments[0];
        console.log('[CompleteAS] 철거 신호(SMR05) 호출:', { eqtNo: firstEquip.EQT_NO || firstEquip.id });
        await checkStbServerConnection(
          regUid,
          order.CTRT_ID || '',
          order.id,
          'SMR05',  // 철거 신호
          firstEquip.EQT_NO || firstEquip.id || '',
          ''
        );
        console.log('[CompleteAS] 철거 신호(SMR05) 호출 완료');
      } catch (error) {
        console.log('[CompleteAS] 철거 신호 처리 중 오류 (무시하고 계속 진행):', error);
        // 레거시와 동일하게 에러 발생해도 작업완료 계속 진행
      }

      // 분실 상태가 있는 회수 장비에 대해 분실처리 API 호출
      const lossEquipments = removedEquipments.filter(hasLossStatus);
      if (lossEquipments.length > 0) {
        console.log('[CompleteAS] 분실처리 대상 장비:', lossEquipments.length, '개');
        for (const eq of lossEquipments) {
          try {
            const result = await custEqtInfoDel({
              WRK_ID: order.id,
              CUST_ID: order.customer?.id || '',
              CTRT_ID: order.CTRT_ID || '',
              MST_SO_ID: order.MST_SO_ID || order.SO_ID || '',
              SO_ID: order.SO_ID || '',
              EQT_NO: eq.EQT_NO || eq.id || '',
              ITEM_MID_CD: eq.ITEM_MID_CD || eq.itemMidCd || '',
              EQT_CL_CD: eq.EQT_CL_CD || eq.eqtClCd || '',
              EQT_CL: eq.EQT_CL || eq.eqtClCd || '',
              EQT_CL_NM: eq.EQT_CL_NM || eq.model || '',
              REG_UID: workerId,
              WRK_CD: order.WRK_CD || '03',
              CRR_ID: order.CRR_ID || '',
              WRKR_ID: workerId,
              RCPT_ID: order.RCPT_ID || '',
              SVC_CMPS_ID: eq.SVC_CMPS_ID || '',
              BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID || '',
              OLD_LENT_YN: eq.LENT_YN || eq.OLD_LENT_YN || '',
              EQT_CHG_GB: '02',
              REUSE_YN: '0',
              EQT_LOSS_YN: eq.EQT_LOSS_YN || '0',
              PART_LOSS_BRK_YN: eq.PART_LOSS_BRK_YN || '0',
              EQT_BRK_YN: eq.EQT_BRK_YN || '0',
              EQT_CABL_LOSS_YN: eq.EQT_CABL_LOSS_YN || '0',
              EQT_CRDL_LOSS_YN: eq.EQT_CRDL_LOSS_YN || '0',
            });
            console.log('[CompleteAS] 분실처리 완료:', eq.EQT_NO || eq.id, result);
          } catch (error) {
            console.log('[CompleteAS] 분실처리 실패 (무시하고 계속 진행):', error);
          }
        }
      }
    }

    // 분실처리 모달에서 저장한 pendingLossStatusList 처리 (deferLossProcessing 용)
    const pendingLossStatusList = equipmentData?.pendingLossStatusList || [];
    if (pendingLossStatusList.length > 0) {
      console.log('[CompleteAS] 분실처리 모달에서 저장된 대기 목록:', pendingLossStatusList.length, '개');
      for (const lossItem of pendingLossStatusList) {
        try {
          const result = await custEqtInfoDel({
            WRK_ID: order.id,
            CUST_ID: order.customer?.id || '',
            CTRT_ID: order.CTRT_ID || '',
            MST_SO_ID: order.MST_SO_ID || order.SO_ID || '',
            SO_ID: order.SO_ID || '',
            EQT_NO: lossItem.EQT_NO || '',
            ITEM_MID_CD: lossItem.ITEM_MID_CD || '',
            EQT_CL_CD: lossItem.EQT_CL_CD || '',
            EQT_CL: lossItem.EQT_CL || '',
            EQT_CL_NM: lossItem.EQT_CL_NM || '',
            REG_UID: workerId,
            WRK_CD: order.WRK_CD || '03',
            CRR_ID: order.CRR_ID || '',
            WRKR_ID: workerId,
            RCPT_ID: order.RCPT_ID || '',
            SVC_CMPS_ID: lossItem.SVC_CMPS_ID || '',
            BASIC_PROD_CMPS_ID: lossItem.BASIC_PROD_CMPS_ID || '',
            OLD_LENT_YN: lossItem.LENT_YN || '',
            EQT_CHG_GB: '02',
            REUSE_YN: '0',
            EQT_LOSS_YN: lossItem.EQT_LOSS_YN || '0',
            PART_LOSS_BRK_YN: lossItem.PART_LOSS_BRK_YN || '0',
            EQT_BRK_YN: lossItem.EQT_BRK_YN || '0',
            EQT_CABL_LOSS_YN: lossItem.EQT_CABL_LOSS_YN || '0',
            EQT_CRDL_LOSS_YN: lossItem.EQT_CRDL_LOSS_YN || '0',
          });
          console.log('[CompleteAS] 대기 분실처리 완료:', lossItem.EQT_SERNO, result);

          // 철거 신호(SMR05) 호출
          try {
            await checkStbServerConnection(
              workerId,
              order.CTRT_ID || '',
              order.id,
              'SMR05',
              lossItem.EQT_NO || '',
              ''
            );
          } catch (signalError) {
            console.log('[CompleteAS] 철거 신호 실패 (무시):', signalError);
          }
        } catch (error) {
          console.log('[CompleteAS] 대기 분실처리 실패 (무시하고 계속 진행):', error);
        }
      }
    }

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
        PSN_USE_CORP: internetUse || '',
        VOIP_USE_CORP: voipUse || '',
        DTV_USE_CORP: dtvUse || '',
        WRK_ACT_CL: '20',
        NET_CL: installInfoData?.NET_CL || '',
        WRNG_TP: installInfoData?.WRNG_TP || '',
        INSTL_TP: installInfoData?.INSTL_TP || '',
        // A/S 전용 필드
        KPI_PROD_GRP: kpiProdGrp,
        OBS_RCPT_CD: obsRcptCd,
        OBS_RCPT_DTL_CD: obsRcptDtlCd,
        // 유상AS 여부 (레거시: mowoa03m03.xml 1663-1672, MMA/MMB/MMC/II5)
        CUST_CLEAN_YN: ['MMA', 'MMB', 'MMC', 'II5'].includes(obsRcptDtlCd) ? 'A' : '',
        // 상향제어 (레거시: cmb_up_ctrl_cl, mowoa03m03.xml 1658)
        UP_CTRL_CL: upCtrlCl.replace('[]', ''),
        // TV타입 (레거시: tv_type, mowoa03m03.xml 1653)
        TV_TYPE: tvType || '',
        // 결합계약 ID
        VOIP_JOIN_CTRT_ID: voipJoinCtrtId || '',
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

            {/* 서비스그룹 (A/S 전용) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                서비스그룹 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <Select value={kpiProdGrp} onValueChange={setKpiProdGrp} options={kpiProdGrpOptions}
                placeholder="서비스그룹 선택" required disabled={isWorkCompleted} />
            </div>

            {/* 처리유형 (A/S 전용) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                처리유형 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <Select value={obsRcptCd} onValueChange={setObsRcptCd} options={obsRcptCdOptions}
                placeholder="처리유형 선택" required disabled={isWorkCompleted} />
            </div>

            {/* 처리유형상세 (A/S 전용) - 처리유형 선택 후 활성화 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                처리유형상세 {!isWorkCompleted && <span className="text-red-500">*</span>}
              </label>
              <Select value={obsRcptDtlCd} onValueChange={setObsRcptDtlCd} options={obsRcptDtlCdOptions}
                placeholder={!obsRcptCd ? "처리유형을 먼저 선택하세요" : "처리유형상세 선택"} required disabled={isWorkCompleted || !obsRcptCd} />
            </div>

            {/* 상향제어 - DTV(KPI_PROD_GRP_CD='D')일 때만 표시 (레거시: cmb_up_ctrl_cl - 공통코드 CMCT015) */}
            {(equipmentData?.kpiProdGrpCd === 'D' || equipmentData?.prodGrp === 'D' || (order as any).PROD_GRP === 'D') && (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">
                  상향제어
                </label>
                <Select value={upCtrlCl} onValueChange={setUpCtrlCl} options={upCtrlClOptions}
                  placeholder="상향제어 선택" disabled={isWorkCompleted} />
              </div>
            )}

            {/* 설치위치 */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1.5">설치위치</label>
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
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">DTV (디지털이용)</label>
                    <Select value={dtvUse} onValueChange={setDtvUse} options={dtvOptions}
                      placeholder="선택" disabled={isWorkCompleted} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">ISP (인터넷이용)</label>
                    <Select value={internetUse} onValueChange={setInternetUse} options={internetOptions}
                      placeholder="선택" disabled={isWorkCompleted} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">VoIP (VoIP이용)</label>
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
      >
        <WorkCompleteSummary
          workType="03"
          workTypeName="A/S"
          custRel={custRel}
          custRelName={custRelOptions.find(o => o.value === custRel)?.label}
          networkType={networkType}
          networkTypeName={networkTypeName}
          upCtrlCl={upCtrlCl}
          upCtrlClName={upCtrlClOptions.find(o => o.value === upCtrlCl)?.label}
          kpiProdGrp={kpiProdGrp}
          kpiProdGrpName={kpiProdGrpOptions.find(o => o.value === kpiProdGrp)?.label}
          obsRcptCd={obsRcptCd}
          obsRcptCdName={obsRcptCdOptions.find(o => o.value === obsRcptCd)?.label}
          obsRcptDtlCd={obsRcptDtlCd}
          obsRcptDtlCdName={obsRcptDtlCdOptions.find(o => o.value === obsRcptDtlCd)?.label}
          installedEquipments={equipmentData?.installedEquipments || []}
          removedEquipments={equipmentData?.removedEquipments || []}
          installLocation={installLocationText ? { position: installLocationText } : undefined}
          memo={memo}
        />
      </ConfirmModal>
    </div>
  );
};

export default CompleteAS;
