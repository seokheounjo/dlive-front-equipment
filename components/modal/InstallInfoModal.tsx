import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './InstallInfoModal.css';
import { saveInstallInfo, getCommonCodes, getChkWorkFee } from '../../services/apiService';
import { CommonCodeItem } from '../../types';
import Select from '../ui/Select';
import BaseModal from '../common/BaseModal';
import ConfirmModal from '../common/ConfirmModal';
import { formatId } from '../../utils/dateFormatter';
import '../../styles/buttons.css';
import { useUIStore } from '../../stores/uiStore';

interface InstallInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InstallInfoData) => void;
  workId: string;
  initialData?: InstallInfoData;
  workType?: string;
  customerId?: string;
  customerName?: string;
  contractId?: string;
  addrOrd?: string;            // 주소순번 (TCMCT_NET_INFO JOIN에 필요)
  // Filtering data
  kpiProdGrpCd?: string;      // KPI product group code (V, I, C, etc.)
  prodChgGb?: string;          // Product change division (01=upgrade, 02=downgrade)
  chgKpiProdGrpCd?: string;    // Changed KPI product group code
  prodGrp?: string;            // Product group (V, I, C)
  wrkDtlTcd?: string;          // Work detail type code
  soId?: string;               // SO ID (단가 존재여부 체크용)
  readOnly?: boolean;          // 읽기 전용 모드 (완료된 작업)
  isCertifyProd?: boolean;     // LGU+ 인증 상품 여부 (망구분 기본값 LGU+)
}

export interface InstallInfoData {
  NET_CL?: string;
  NET_CL_NM?: string; // 망구분 이름
  INSTL_TP?: string;
  WRNG_TP?: string;
  CB_INSTL_TP?: string;
  CB_WRNG_TP?: string;
  INOUT_LINE_TP?: string;
  INOUT_LEN?: string;
  DVDR_YN?: string;
  BFR_LINE_YN?: string;
  TERM_NO?: string;
  RCV_STS?: string;
  SUBTAP_ID?: string;
  PORT_NUM?: string;
  EXTN_TP?: string;
  TAB_LBL?: string;
  CVT_LBL?: string;
  STB_LBL?: string;
  CUT_YN?: string;
}

const InstallInfoModal: React.FC<InstallInfoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  workId,
  initialData,
  workType,
  customerId,
  customerName,
  contractId,
  addrOrd,
  kpiProdGrpCd,
  prodChgGb,
  chgKpiProdGrpCd,
  prodGrp,
  wrkDtlTcd,
  soId,
  readOnly = false,
  isCertifyProd = false
}) => {
  const [formData, setFormData] = useState<InstallInfoData>({
    NET_CL: '',
    INSTL_TP: '',
    WRNG_TP: '',
    CB_INSTL_TP: '',
    CB_WRNG_TP: '',
    INOUT_LINE_TP: 'N',
    INOUT_LEN: '',
    DVDR_YN: 'N',
    BFR_LINE_YN: 'N',
    CUT_YN: 'N',
    TERM_NO: '',
    RCV_STS: '',
    SUBTAP_ID: '',
    PORT_NUM: '',
    EXTN_TP: '',
    TAB_LBL: '',
    CVT_LBL: '',
    STB_LBL: '',
  });

  const [netClCodes, setNetClCodes] = useState<CommonCodeItem[]>([]);
  const [wrngTpCodes, setWrngTpCodes] = useState<CommonCodeItem[]>([]);
  const [wrngTpCodesOriginal, setWrngTpCodesOriginal] = useState<CommonCodeItem[]>([]); // 원본 보존
  const [instlTpCodes, setInstlTpCodes] = useState<CommonCodeItem[]>([]);
  const [cbWrngTpCodes, setCbWrngTpCodes] = useState<CommonCodeItem[]>([]);
  const [cbInstlTpCodes, setCbInstlTpCodes] = useState<CommonCodeItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 확인 팝업 상태 (토스트 대신 확인 버튼 필요한 알림)
  const [alertModal, setAlertModal] = useState<{ message: string; type: 'warning' | 'success' | 'error'; onConfirm?: () => void } | null>(null);

  // 확인 팝업을 Promise로 사용 (순차적으로 확인 후 진행)
  const showAlert = useCallback((message: string, type: 'warning' | 'success' | 'error' = 'warning'): Promise<void> => {
    return new Promise((resolve) => {
      setAlertModal({ message, type, onConfirm: resolve });
    });
  }, []);

  useEffect(() => {
    if (isOpen && workId) {
      loadData();
    }
  }, [isOpen, workId]);

  useEffect(() => {
    if (initialData) {
      // 철거 작업에서 기본값 설정 후 빈 값으로 덮어쓰지 않도록 필터링
      const isRemovalWork = workType === '02' || workType === '04' || workType === '08';
      const filteredData = { ...initialData };

      // 철거 작업에서 빈 값은 기본값을 유지하도록 제외
      if (isRemovalWork) {
        if (!initialData.NET_CL || initialData.NET_CL.trim() === '') {
          delete filteredData.NET_CL;
          delete filteredData.NET_CL_NM;
        }
        if (!initialData.INSTL_TP || initialData.INSTL_TP.trim() === '') {
          delete filteredData.INSTL_TP;
        }
      }

      setFormData(prev => ({ ...prev, ...filteredData }));
    }
  }, [initialData, workType]);


  // Filter helper: mimic MiPlatform's pos() function
  const pos = (str: string | undefined, search: string): number => {
    if (!str || !search) return -1;
    return str.indexOf(search);
  };

  // Apply initial filters based on work type
  const applyInitialFilters = (
    instlTpList: CommonCodeItem[],
    wrngTpList: CommonCodeItem[],
    cbInstlTpList: CommonCodeItem[],
    cbWrngTpList: CommonCodeItem[]
  ) => {
    const WRK_CD = workType;
    const KPI_PROD_GRP_CD = kpiProdGrpCd;
    const PROD_CHG_GB = prodChgGb;
    const CHG_KPI_PROD_GRP_CD = chgKpiProdGrpCd;
    const PROD_GRP = prodGrp;
    const WRK_DTL_TCD = wrkDtlTcd;

    let filteredInstlTp = instlTpList;
    let filteredCbInstlTp = cbInstlTpList;
    let filteredCbWrngTp = cbWrngTpList;

    // Legacy filter logic (line 512-579)
    if (WRK_CD === '01' || WRK_CD === '03' || WRK_CD === '06' || WRK_CD === '07' || WRK_CD === '09') {
      if (WRK_DTL_TCD === '0920') {
        filteredInstlTp = instlTpList.filter(item =>
          pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code === '77'
        );
      } else {
        filteredInstlTp = instlTpList.filter(item =>
          pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code !== '77'
        );
      }

      if (PROD_GRP === 'C') {
        if (WRK_DTL_TCD === '0920') {
          filteredCbInstlTp = cbInstlTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code === '77'
          );
        } else {
          filteredCbInstlTp = cbInstlTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code !== '77'
          );
        }
      }
    } else if (WRK_CD === '05') {
      // Product change work
      if (PROD_CHG_GB === '01') {
        filteredInstlTp = instlTpList.filter(item =>
          pos(item.ref_code, CHG_KPI_PROD_GRP_CD || '') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code !== '77'
        );

        if (PROD_GRP === 'C') {
          filteredCbInstlTp = cbInstlTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code !== '77'
          );
          filteredCbWrngTp = cbWrngTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code !== '77'
          );
        }
      } else if (PROD_CHG_GB === '02') {
        filteredInstlTp = instlTpList.filter(item =>
          pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code === '77'
        );

        if (PROD_GRP === 'C') {
          filteredCbInstlTp = cbInstlTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code === '77'
          );
          filteredCbWrngTp = cbWrngTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code === '77'
          );
        }
      }
    } else if (WRK_CD === '04') {
      // 정지 작업 (WRK_DTL_TCD: 0430=일시철거, 0440=일시정지해제)
      if (WRK_DTL_TCD === '0440') {
        filteredInstlTp = instlTpList.filter(item =>
          pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code !== '77'
        );

        if (PROD_GRP === 'C') {
          filteredCbInstlTp = cbInstlTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code !== '77'
          );
          filteredCbWrngTp = cbWrngTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code !== '77'
          );
        }
      } else if (WRK_DTL_TCD === '0430') {
        filteredInstlTp = instlTpList.filter(item =>
          pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code === '77'
        );

        if (PROD_GRP === 'C') {
          filteredCbInstlTp = cbInstlTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code === '77'
          );
          filteredCbWrngTp = cbWrngTpList.filter(item =>
            pos(item.ref_code, 'I') > -1 &&
            (item.ref_code3 || '') >= '20090901' &&
            item.code === '77'
          );
        }
      }
    } else {
      // Default case - 철거 작업 (WRK_CD='02', '08', '09' 등)
      // code='77' (철거)만 표시, KPI_PROD_GRP_CD 필터는 있을 때만 적용
      filteredInstlTp = instlTpList.filter(item => {
        const matchesCode77 = item.code === '77';
        const matchesDate = (item.ref_code3 || '') >= '20090901';
        // KPI_PROD_GRP_CD가 있으면 ref_code 필터도 적용, 없으면 code=77만 필터링
        const matchesRefCode = KPI_PROD_GRP_CD
          ? pos(item.ref_code, KPI_PROD_GRP_CD) > -1
          : true;
        return matchesCode77 && matchesDate && matchesRefCode;
      });

      if (PROD_GRP === 'C') {
        filteredCbInstlTp = cbInstlTpList.filter(item =>
          pos(item.ref_code, 'I') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code === '77'
        );
        filteredCbWrngTp = cbWrngTpList.filter(item =>
          pos(item.ref_code, 'I') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code === '77'
        );
      }
    }

    // Filter wrng_tp by KPI_PROD_GRP_CD
    const filteredWrngTp = wrngTpList.filter(item =>
      pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
      (item.ref_code3 || '') >= '20090901'
    );

    return {
      filteredInstlTp,
      filteredWrngTp,
      filteredCbInstlTp,
      filteredCbWrngTp
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [netCl, wrngTp, instlTp, cbWrngTp, cbInstlTp] = await Promise.all([
        getCommonCodes('CMCU048'),
        getCommonCodes('BLST014'),
        getCommonCodes('BLST010'),
        getCommonCodes('CMCU030'),
        getCommonCodes('CMCU046'),
      ]);

      // Apply initial filters
      // 철거 작업(WRK_CD='02', '04', '08')은 kpiProdGrpCd 없이도 code='77' 필터링 적용
      const isRemovalWork = workType === '02' || workType === '04' || workType === '08';
      if (workType && (kpiProdGrpCd || isRemovalWork)) {
        const filtered = applyInitialFilters(instlTp, wrngTp, cbInstlTp, cbWrngTp);
        setNetClCodes(netCl);

        // 배선형태 초기 필터: 레거시 fn_ds_filter (line 578)
        // ds_wrng_tp.Filter("pos(ref_code,'"+KPI_PROD_GRP_CD+"') > -1 && REF_CODE3>='20090901'")
        // 설치유형 선택 후에 ref_code2로 추가 필터링됨 (filterWrngTpByInstlTp 함수에서 처리)
        setWrngTpCodes(filtered.filteredWrngTp);
        setWrngTpCodesOriginal(wrngTp);
        setInstlTpCodes(filtered.filteredInstlTp);
        setCbWrngTpCodes(filtered.filteredCbWrngTp);
        setCbInstlTpCodes(filtered.filteredCbInstlTp);
      } else {
        // No filtering data available, show all
        setNetClCodes(netCl);
        setWrngTpCodes(wrngTp);
        setWrngTpCodesOriginal(wrngTp);
        setInstlTpCodes(instlTp);
        setCbWrngTpCodes(cbWrngTp);
        setCbInstlTpCodes(cbInstlTp);
      }

      // 망구분 기본값 설정 - 모든 작업 유형에서 NET_CL 없으면 기본값 설정
      // LGU+ 인증 상품이면 "LGU+" 기본값, 그 외는 "DLIVE 자가" 기본값
      const hasNetCl = initialData?.NET_CL && initialData.NET_CL.trim() !== '';
      if (!hasNetCl && netCl.length > 0) {
        let defaultNetCl;
        if (isCertifyProd) {
          defaultNetCl = netCl.find(item => item.name?.includes('LGU'));
        }
        if (!defaultNetCl) {
          defaultNetCl = netCl.find(item =>
            item.name && (item.name.includes('DLIVE') || item.name.includes('자가'))
          );
        }
        if (defaultNetCl) {
          setFormData(prev => ({
            ...prev,
            NET_CL: defaultNetCl.code,
            NET_CL_NM: defaultNetCl.name
          }));
        }
      }

      // 철거 작업(02, 04, 08)이면 추가 기본값 설정 (레거시와 동일)
      if (isRemovalWork) {
        const hasInstlTp = initialData?.INSTL_TP && initialData.INSTL_TP.trim() !== '';

        // INSTL_TP가 없으면 '77'(철거) 기본값
        if (!hasInstlTp) {
          setFormData(prev => ({ ...prev, INSTL_TP: '77' }));
        }

        // 배선형태 필터링 (INSTL_TP='77' 기준)
        const targetInstlTp = hasInstlTp ? initialData?.INSTL_TP : '77';
        if (targetInstlTp === '77') {
          const wrngTpFiltered = wrngTp.filter(item =>
            pos(item.ref_code2, '77') > -1
          );
          setWrngTpCodes(wrngTpFiltered);
        }
      }
    } catch (error: any) {
      console.error('[InstallInfoModal] Failed to load common codes:', error);
    } finally {
      setLoading(false);
    }
  };

  // 공통코드를 Select 옵션 형태로 변환
  const netClOptions = useMemo(() =>
    netClCodes.map(code => ({ value: code.code, label: code.name })),
    [netClCodes]
  );

  const instlTpOptions = useMemo(() =>
    instlTpCodes.map(code => ({ value: code.code, label: code.name })),
    [instlTpCodes]
  );

  const wrngTpOptions = useMemo(() =>
    wrngTpCodes.map(code => ({ value: code.code, label: code.name })),
    [wrngTpCodes]
  );

  const cbInstlTpOptions = useMemo(() =>
    cbInstlTpCodes.map(code => ({ value: code.code, label: code.name })),
    [cbInstlTpCodes]
  );

  const cbWrngTpOptions = useMemo(() =>
    cbWrngTpCodes.map(code => ({ value: code.code, label: code.name })),
    [cbWrngTpCodes]
  );

  if (!isOpen) return null;

  const handleChange = (field: keyof InstallInfoData, value: string) => {
    if (readOnly) return; // 읽기 전용 모드에서는 변경 불가
    setFormData(prev => ({ ...prev, [field]: value }));

    // 설치유형 변경 시 배선형태 필터링 및 초기화
    if (field === 'INSTL_TP') {
      // 배선형태 초기화
      setFormData(prev => ({ ...prev, WRNG_TP: '' }));

      if (value) {
        filterWrngTpByInstlTp(value);
      } else {
        // 설치유형이 비어있으면 원본으로 복원
        setWrngTpCodes(wrngTpCodesOriginal);
      }
    }

    // 콤보설치유형 변경 시 콤보배선형태 필터링 및 초기화
    if (field === 'CB_INSTL_TP') {
      // 콤보배선형태 초기화
      setFormData(prev => ({ ...prev, CB_WRNG_TP: '' }));

      if (value) {
        filterCbWrngTpByCbInstlTp(value);
      }
    }
  };

  // 설치유형에 따른 배선형태 필터링 (레거시 line 285-299)
  const filterWrngTpByInstlTp = (instlTpValue: string) => {
    if (!instlTpValue || wrngTpCodesOriginal.length === 0) {
      setWrngTpCodes(wrngTpCodesOriginal);
      return;
    }

    // If no filtering data available, just filter by instlTpValue (ref_code2 only)
    if (!kpiProdGrpCd && !chgKpiProdGrpCd) {
      const filtered = wrngTpCodesOriginal.filter(item =>
        pos(item.ref_code2, instlTpValue) > -1
      );
      setWrngTpCodes(filtered);
      return;
    }

    let filtered = wrngTpCodesOriginal;

    // Legacy filter logic (line 285-299)
    if (workType === '05') {
      // Product change work
      if (prodChgGb === '01') {
        // Upgrade
        filtered = wrngTpCodesOriginal.filter(item =>
          pos(item.ref_code2, instlTpValue) > -1 &&
          pos(item.ref_code, chgKpiProdGrpCd || '') > -1
        );
      } else if (prodChgGb === '02') {
        // Downgrade
        filtered = wrngTpCodesOriginal.filter(item =>
          pos(item.ref_code2, instlTpValue) > -1 &&
          pos(item.ref_code, kpiProdGrpCd || '') > -1
        );
      } else {
        filtered = wrngTpCodesOriginal.filter(item =>
          pos(item.ref_code2, instlTpValue) > -1 &&
          pos(item.ref_code, kpiProdGrpCd || '') > -1
        );
      }
    } else {
      // Normal work (not product change)
      filtered = wrngTpCodesOriginal.filter(item =>
        pos(item.ref_code2, instlTpValue) > -1 &&
        pos(item.ref_code, kpiProdGrpCd || '') > -1
      );
    }

    setWrngTpCodes(filtered);

    // Reset selected value if filtered out
    if (formData.WRNG_TP && !filtered.find(c => c.code === formData.WRNG_TP)) {
      setFormData(prev => ({ ...prev, WRNG_TP: '' }));
    }
  };

  // 콤보설치유형에 따른 콤보배선형태 필터링 (레거시 line 323-331)
  const filterCbWrngTpByCbInstlTp = (cbInstlTpValue: string) => {
    if (!cbInstlTpValue) {
      return;
    }

    // Get original cb_wrng_tp codes (need to store original separately)
    const filtered = cbWrngTpCodes.filter(item =>
      pos(item.ref_code2, cbInstlTpValue) > -1 &&
      pos(item.ref_code, 'I') > -1
    );

    setCbWrngTpCodes(filtered);
  };

  const handleSave = async () => {
    // 필수값 검증 (레거시: mowoa03p04.xml btn_save_OnClick lines 336-367)
    if (!formData.NET_CL || !formData.INSTL_TP) {
      useUIStore.getState().showGlobalToast('네트워크,설치유형 필수항목을 입력하세요.', 'warning');
      return;
    }

    // REF_CODE="*" 체크 - 와일드카드면 배선형태 검증 스킵 (레거시 line 343)
    const selectedInstlTp = instlTpCodes.find(c => c.code === formData.INSTL_TP);
    const refCode = selectedInstlTp?.ref_code || '';
    const skipWrngTpCheck = refCode === '*';

    if (!skipWrngTpCheck) {
      if (prodGrp === 'C') {
        // 케이블 상품: 배선유형 + 분기케이블배선유형 필수 (레거시 lines 345-352)
        if (!formData.WRNG_TP || !formData.CB_WRNG_TP) {
          useUIStore.getState().showGlobalToast('배선유형,분기케이블배선유형 필수항목을 입력하세요.', 'warning');
          return;
        }
        // 분기점설치유형 필수 (레거시 lines 354-358)
        if (!formData.CB_INSTL_TP) {
          useUIStore.getState().showGlobalToast('분기점설치유형 필수항목을 입력하세요.', 'warning');
          return;
        }
      } else {
        // 비케이블 상품: 배선유형만 필수 (레거시 lines 359-366)
        if (!formData.WRNG_TP) {
          useUIStore.getState().showGlobalToast('배선유형 필수항목을 입력하세요.', 'warning');
          return;
        }
      }
    }

    setSaving(true);
    try {
      // 단가 존재여부 체크 (확인 팝업, 레거시 lines 397-451)
      // 1차: WRNG_TP != "N" 이면 FEE_TYPE="N"으로 호출
      if (formData.WRNG_TP && formData.WRNG_TP !== 'N') {
        try {
          const feeResult = await getChkWorkFee({
            FEE_TYPE: 'N',
            WRK_ID: workId,
            ADDR_ORD: addrOrd || '',
            WRK_DTL_TCD: wrkDtlTcd || '',
            CTRT_ID: contractId || '',
            SO_ID: soId || '',
            INSTL_TP: formData.INSTL_TP || '',
            WRNG_TP: formData.WRNG_TP || '',
            INOUT_LEN: formData.INOUT_LEN || '',
            WRK_CD: workType || '',
          });
          if (!feeResult?.data || feeResult.data.length === 0) {
            await showAlert('설치정보에 해당하는 공사비가 존재하지 않습니다. 작업예정자료와 설정정보를 다시 확인하시기 바랍니다.', 'warning');
          }
        } catch (e) {
          console.error('단가 체크 실패 (N):', e);
        }
      }

      // 2차: 콤보상품군인 경우 CB_WRNG_TP 단가 체크
      if (prodGrp === 'C' && formData.CB_WRNG_TP && formData.CB_WRNG_TP !== 'N') {
        try {
          const cbFeeResult = await getChkWorkFee({
            FEE_TYPE: 'C',
            WRK_ID: workId,
            ADDR_ORD: addrOrd || '',
            WRK_DTL_TCD: wrkDtlTcd || '',
            CTRT_ID: contractId || '',
            SO_ID: soId || '',
            INSTL_TP: formData.CB_INSTL_TP || '',
            WRNG_TP: formData.CB_WRNG_TP || '',
            INOUT_LEN: formData.INOUT_LEN || '',
            WRK_CD: workType || '',
          });
          if (!cbFeeResult?.data || cbFeeResult.data.length === 0) {
            await showAlert('분기점설치정보 설정가격이 존재하지 않습니다. 작업예정자료와 설정정보를 다시 확인하시기 바랍니다.', 'warning');
          }
        } catch (e) {
          console.error('단가 체크 실패 (C):', e);
        }
      }

      // 망구분 이름 찾기
      const netClName = netClCodes.find(code => code.code === formData.NET_CL)?.name || '';

      // 망구분 이름 포함한 데이터
      const dataWithNames = {
        ...formData,
        NET_CL_NM: netClName
      };

      const result = await saveInstallInfo({
        WRK_ID: workId,
        CTRT_ID: contractId || '',
        ADDR_ORD: addrOrd || '',
        WRK_DTL_TCD: wrkDtlTcd || '',
        ...formData
      });

      if (result.code === 'SUCCESS') {
        onSave(dataWithNames);
        await showAlert('설치 정보가 저장되었습니다.', 'success');
        onClose();
      } else {
        await showAlert(result.message || '저장에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      console.error('Save failed:', error);
      await showAlert(error.message || '설치 정보 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // SubHeader - 고객 정보
  const subHeader = loading ? null : (
    <div className="install-subheader">
      <div className="info-row whitespace-nowrap">
        <span className="info-label">고객ID:</span>
        <span className="info-value">{formatId(customerId)}</span>
      </div>
      <div className="info-row whitespace-nowrap">
        <span className="info-label">고객명:</span>
        <span className="info-value">{customerName || '-'}</span>
      </div>
      <div className="info-row whitespace-nowrap">
        <span className="info-label">계약ID:</span>
        <span className="info-value">{formatId(contractId)}</span>
      </div>
    </div>
  );

  // Footer - 버튼 (readOnly일 때는 닫기 버튼만)
  const footer = readOnly ? (
    <button
      className="btn btn-secondary btn-sm"
      onClick={onClose}
    >
      닫기
    </button>
  ) : (
    <button
      className="btn btn-primary btn-sm"
      onClick={handleSave}
      disabled={loading || saving}
    >
      {saving ? '저장 중...' : '저장'}
    </button>
  );

  return (
    <>
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={workType === '02' || workType === '04' || workType === '08' || workType === '09' ? '철거정보' : '설치정보'}
      size="medium"
      subHeader={subHeader}
      footer={footer}
    >
      <div className="install-modal-content">
        {loading ? (
          <div className="loading-message">
            <div className="spinner"></div>
            <p>데이터를 불러오는 중...</p>
          </div>
        ) : (
          <>
            {/* 설치 정보 */}
            <div className="install-info-section">
                <div className="install-form-row">
                  <label className="install-label">
                    망구분 {!readOnly && <span className="required">*</span>}
                  </label>
                  <Select
                    value={formData.NET_CL || ''}
                    onValueChange={(val) => handleChange('NET_CL', val)}
                    options={netClOptions}
                    placeholder="선택"
                    required={!readOnly}
                    disabled={readOnly}
                  />
                </div>

                <div className="install-form-row">
                  <label className="install-label">
                    설치유형 {!readOnly && <span className="required">*</span>}
                  </label>
                  <Select
                    value={formData.INSTL_TP || ''}
                    onValueChange={(val) => handleChange('INSTL_TP', val)}
                    options={instlTpOptions}
                    placeholder="선택"
                    required={!readOnly}
                    disabled={readOnly}
                  />
                </div>

                <div className="install-form-row">
                  <label className="install-label">
                    배선형태 {!readOnly && <span className="required">*</span>}
                  </label>
                  <Select
                    value={formData.WRNG_TP || ''}
                    onValueChange={(val) => handleChange('WRNG_TP', val)}
                    options={wrngTpOptions}
                    placeholder={formData.INSTL_TP ? "선택" : "설치유형을 먼저 선택하세요"}
                    disabled={readOnly || !formData.INSTL_TP}
                    required={!readOnly}
                  />
                </div>

                {/* 콤보설치형태/콤보배선형태 - PROD_GRP="C" (케이블)인 경우만 활성화 (레거시 동일) */}
                {prodGrp === 'C' && (
                  <>
                    <div className="install-form-row">
                      <label className="install-label">
                        분기점설치유형 {!readOnly && <span className="required">*</span>}
                      </label>
                      <Select
                        value={formData.CB_INSTL_TP || ''}
                        onValueChange={(val) => handleChange('CB_INSTL_TP', val)}
                        options={cbInstlTpOptions}
                        placeholder="선택"
                        disabled={readOnly}
                      />
                    </div>

                    <div className="install-form-row">
                      <label className="install-label">
                        분기케이블배선유형 {!readOnly && <span className="required">*</span>}
                      </label>
                      <Select
                        value={formData.CB_WRNG_TP || ''}
                        onValueChange={(val) => handleChange('CB_WRNG_TP', val)}
                        options={cbWrngTpOptions}
                        placeholder={formData.CB_INSTL_TP ? "선택" : "분기점설치유형을 먼저 선택하세요"}
                        disabled={readOnly || !formData.CB_INSTL_TP}
                      />
                    </div>
                  </>
                )}

                {/* 인입관통여부 + 인입선길이 (같은 줄) */}
                <div className="install-form-row-inline">
                  <label className="install-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.INOUT_LINE_TP === 'Y'}
                      onChange={(e) => handleChange('INOUT_LINE_TP', e.target.checked ? 'Y' : 'N')}
                      disabled={readOnly}
                    />
                    <span>인입관통여부</span>
                  </label>
                  <div className="install-inline-group">
                    <label className="install-inline-label">인입선길이</label>
                    <input
                      type="text"
                      className="install-input-inline"
                      value={formData.INOUT_LEN || ''}
                      onChange={(e) => handleChange('INOUT_LEN', e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                {/* 분배기여부 + 기존선로여부/절단여부 (같은 줄) */}
                {/* 레거시: WRK_CD 02/08일 때 기존선로여부 숨기고 절단여부 표시 */}
                <div className="install-form-row-inline">
                  <label className="install-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.DVDR_YN === 'Y'}
                      onChange={(e) => handleChange('DVDR_YN', e.target.checked ? 'Y' : 'N')}
                      disabled={readOnly}
                    />
                    <span>분배기여부</span>
                  </label>
                  {workType === '02' || workType === '08' ? (
                    <label className="install-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.CUT_YN === 'Y'}
                        onChange={(e) => handleChange('CUT_YN', e.target.checked ? 'Y' : 'N')}
                        disabled={readOnly}
                      />
                      <span>절단여부</span>
                    </label>
                  ) : (
                    <label className="install-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.BFR_LINE_YN === 'Y'}
                        onChange={(e) => handleChange('BFR_LINE_YN', e.target.checked ? 'Y' : 'N')}
                        disabled={readOnly}
                      />
                      <span>기존선로여부</span>
                    </label>
                  )}
                </div>
              </div>
            </>
          )}
      </div>
    </BaseModal>

      {/* 확인 팝업 (단가 체크 경고, 저장 성공/실패) */}
      {alertModal && (
        <ConfirmModal
          isOpen={true}
          message={alertModal.message}
          type={alertModal.type === 'success' ? 'info' : 'warning'}
          showCancel={false}
          confirmText="확인"
          onConfirm={() => {
            const cb = alertModal.onConfirm;
            setAlertModal(null);
            cb?.();
          }}
          onClose={() => {
            const cb = alertModal.onConfirm;
            setAlertModal(null);
            cb?.();
          }}
        />
      )}
    </>
  );
};

export default InstallInfoModal;
