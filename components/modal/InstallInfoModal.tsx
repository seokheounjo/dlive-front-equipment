import React, { useState, useEffect, useMemo } from 'react';
import './InstallInfoModal.css';
import { saveInstallInfo, getCommonCodes } from '../../services/apiService';
import { CommonCodeItem } from '../../types';
import Select from '../ui/Select';
import BaseModal from '../common/BaseModal';
import '../../styles/buttons.css';

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
  // Filtering data
  kpiProdGrpCd?: string;      // KPI product group code (V, I, C, etc.)
  prodChgGb?: string;          // Product change division (01=upgrade, 02=downgrade)
  chgKpiProdGrpCd?: string;    // Changed KPI product group code
  prodGrp?: string;            // Product group (V, I, C)
  wrkDtlTcd?: string;          // Work detail type code
  readOnly?: boolean;          // 읽기 전용 모드 (완료된 작업)
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
  kpiProdGrpCd,
  prodChgGb,
  chgKpiProdGrpCd,
  prodGrp,
  wrkDtlTcd,
  readOnly = false
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

  useEffect(() => {
    if (isOpen && workId) {
      loadData();
    }
  }, [isOpen, workId]);

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

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

    console.log('🔍 [Filter] 초기 필터링 시작:', { WRK_CD, KPI_PROD_GRP_CD, PROD_CHG_GB, PROD_GRP, WRK_DTL_TCD });
    console.log('🔍 [Filter] 필터링 전 항목 개수:', {
      instlTpList: instlTpList.length,
      wrngTpList: wrngTpList.length,
      cbInstlTpList: cbInstlTpList.length,
      cbWrngTpList: cbWrngTpList.length
    });

    let filteredInstlTp = instlTpList;
    let filteredCbInstlTp = cbInstlTpList;
    let filteredCbWrngTp = cbWrngTpList;

    // Legacy filter logic (line 512-579)
    if (WRK_CD === '01' || WRK_CD === '03' || WRK_CD === '06' || WRK_CD === '07' || WRK_CD === '09') {
      console.log('🔍 [Filter] 작업유형:', WRK_CD, '- 신규/AS/장애 등');
      if (WRK_DTL_TCD === '0920') {
        console.log('🔍 [Filter] 작업세부:', WRK_DTL_TCD, '- code=77만 필터링');
        filteredInstlTp = instlTpList.filter(item =>
          pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code === '77'
        );
      } else {
        console.log('🔍 [Filter] 작업세부:', WRK_DTL_TCD, '- code!=77 필터링');
        filteredInstlTp = instlTpList.filter(item =>
          pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
          (item.ref_code3 || '') >= '20090901' &&
          item.code !== '77'
        );
      }
      console.log('🔍 [Filter] 설치유형 필터링 결과:', filteredInstlTp.length, '개');

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
      // Relocation work
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
      // Default case
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

    // Filter wrng_tp by KPI_PROD_GRP_CD
    const filteredWrngTp = wrngTpList.filter(item =>
      pos(item.ref_code, KPI_PROD_GRP_CD || '') > -1 &&
      (item.ref_code3 || '') >= '20090901'
    );

    console.log('✅ [Filter] 초기 필터링 완료:', {
      instlTp: filteredInstlTp.length,
      wrngTp: filteredWrngTp.length,
      cbInstlTp: filteredCbInstlTp.length,
      cbWrngTp: filteredCbWrngTp.length,
    });

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
      console.log('🔄 [InstallInfoModal] 공통코드 로드 시작');
      console.log('🔍 [InstallInfoModal] 필터링 파라미터:', {
        workType,
        kpiProdGrpCd,
        prodChgGb,
        chgKpiProdGrpCd,
        prodGrp,
        wrkDtlTcd
      });

      const [netCl, wrngTp, instlTp, cbWrngTp, cbInstlTp] = await Promise.all([
        getCommonCodes('CMCU048'),
        getCommonCodes('BLST014'),
        getCommonCodes('BLST010'),
        getCommonCodes('CMCU030'),
        getCommonCodes('CMCU046'),
      ]);

      console.log('📦 [InstallInfoModal] 받은 공통코드:', {
        netCl: netCl.length,
        wrngTp: wrngTp.length,
        instlTp: instlTp.length,
        cbWrngTp: cbWrngTp.length,
        cbInstlTp: cbInstlTp.length,
      });

      // 첫 번째 항목의 REF_CODE 구조 확인
      if (instlTp.length > 0) {
        console.log('🔍 [InstallInfoModal] 설치유형(BLST010) 첫 번째 항목 (선택):', instlTp[0]);
        console.log('🔍 [InstallInfoModal] 첫 번째 ref_code 필드들:', {
          ref_code: instlTp[0].ref_code,
          ref_code2: instlTp[0].ref_code2,
          ref_code3: instlTp[0].ref_code3,
        });
      }
      if (instlTp.length > 1) {
        console.log('🔍 [InstallInfoModal] 설치유형(BLST010) 두 번째 항목 (실제 데이터):', instlTp[1]);
        console.log('🔍 [InstallInfoModal] 두 번째 ref_code 필드들:', {
          ref_code: instlTp[1].ref_code,
          ref_code2: instlTp[1].ref_code2,
          ref_code3: instlTp[1].ref_code3,
        });
        console.log('🔍 [InstallInfoModal] 두 번째 항목의 모든 키:', Object.keys(instlTp[1]));
      }
      if (wrngTp.length > 1) {
        console.log('🔍 [InstallInfoModal] 배선형태(BLST014) 두 번째 항목:', wrngTp[1]);
      }

      // Apply initial filters only if essential filtering data is available
      if (kpiProdGrpCd && workType) {
        const filtered = applyInitialFilters(instlTp, wrngTp, cbInstlTp, cbWrngTp);
        setNetClCodes(netCl);
        setWrngTpCodes(filtered.filteredWrngTp);
        setWrngTpCodesOriginal(wrngTp);
        setInstlTpCodes(filtered.filteredInstlTp);
        setCbWrngTpCodes(filtered.filteredCbWrngTp);
        setCbInstlTpCodes(filtered.filteredCbInstlTp);
        console.log('✅ [Filter] 초기 필터 적용 - instlTp:', filtered.filteredInstlTp.length, '개');
      } else {
        // No filtering data available, show all
        setNetClCodes(netCl);
        setWrngTpCodes(wrngTp);
        setWrngTpCodesOriginal(wrngTp);
        setInstlTpCodes(instlTp);
        setCbWrngTpCodes(cbWrngTp);
        setCbInstlTpCodes(cbInstlTp);
        console.log('⚠️ [Filter] 필터링 데이터 없음 - 전체 목록 표시');
      }

      console.log('✅ [InstallInfoModal] 공통코드 state 설정 완료');
    } catch (error: any) {
      console.error('❌ [InstallInfoModal] Failed to load common codes:', error);
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
    console.log('🔍 [Filter] 배선형태 필터링:', { instlTpValue, workType, prodChgGb, kpiProdGrpCd, chgKpiProdGrpCd });

    if (!instlTpValue || wrngTpCodesOriginal.length === 0) {
      setWrngTpCodes(wrngTpCodesOriginal);
      return;
    }

    // If no filtering data available, just filter by instlTpValue (ref_code2 only)
    if (!kpiProdGrpCd && !chgKpiProdGrpCd) {
      console.log('⚠️ [Filter] KPI_PROD_GRP_CD 없음 - ref_code2만 필터링');
      const filtered = wrngTpCodesOriginal.filter(item =>
        pos(item.ref_code2, instlTpValue) > -1
      );
      console.log('✅ [Filter] 배선형태 필터링 완료:', filtered.length, '개');
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

    console.log('✅ [Filter] 배선형태 필터링 완료:', filtered.length, '개');
    setWrngTpCodes(filtered);

    // Reset selected value if filtered out
    if (formData.WRNG_TP && !filtered.find(c => c.code === formData.WRNG_TP)) {
      setFormData(prev => ({ ...prev, WRNG_TP: '' }));
    }
  };

  // 콤보설치유형에 따른 콤보배선형태 필터링 (레거시 line 323-331)
  const filterCbWrngTpByCbInstlTp = (cbInstlTpValue: string) => {
    console.log('🔍 [Filter] 콤보배선형태 필터링:', cbInstlTpValue);

    if (!cbInstlTpValue) {
      return;
    }

    // Get original cb_wrng_tp codes (need to store original separately)
    const filtered = cbWrngTpCodes.filter(item =>
      pos(item.ref_code2, cbInstlTpValue) > -1 &&
      pos(item.ref_code, 'I') > -1
    );

    console.log('✅ [Filter] 콤보배선형태 필터링 완료:', filtered.length, '개');
    setCbWrngTpCodes(filtered);
  };

  const handleSave = async () => {
    if (!formData.NET_CL) {
      alert('망구분을 선택해주세요.');
      return;
    }
    if (!formData.INSTL_TP) {
      alert('설치유형을 선택해주세요.');
      return;
    }
    if (!formData.WRNG_TP) {
      alert('배선형태를 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      // 망구분 이름 찾기
      const netClName = netClCodes.find(code => code.code === formData.NET_CL)?.name || '';

      // 망구분 이름 포함한 데이터
      const dataWithNames = {
        ...formData,
        NET_CL_NM: netClName
      };

      const result = await saveInstallInfo({
        WRK_ID: workId,
        ...formData
      });

      if (result.code === 'SUCCESS') {
        onSave(dataWithNames); // 이름 포함된 데이터 전달
        onClose();
      } else {
        alert(result.message || '저장에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('Save failed:', error);
      alert(error.message || '설치 정보 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // SubHeader - 고객 정보
  const subHeader = loading ? null : (
    <div className="install-subheader">
      <div className="info-row">
        <span className="info-label">고객ID:</span>
        <span className="info-value">{customerId || '-'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">고객명:</span>
        <span className="info-value">{customerName || '-'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">계약ID:</span>
        <span className="info-value">{contractId || '-'}</span>
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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="설치정보"
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

                <div className="install-form-row">
                  <label className="install-label">콤보설치형태</label>
                  <Select
                    value={formData.CB_INSTL_TP || ''}
                    onValueChange={(val) => handleChange('CB_INSTL_TP', val)}
                    options={cbInstlTpOptions}
                    placeholder="선택"
                    disabled={true}
                  />
                </div>

                <div className="install-form-row">
                  <label className="install-label">콤보배선형태</label>
                  <Select
                    value={formData.CB_WRNG_TP || ''}
                    onValueChange={(val) => handleChange('CB_WRNG_TP', val)}
                    options={cbWrngTpOptions}
                    placeholder="선택"
                    disabled={true}
                  />
                </div>

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

                {/* 분배기여부 + 기존선로여부 (같은 줄) */}
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
                  <label className="install-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.BFR_LINE_YN === 'Y'}
                      onChange={(e) => handleChange('BFR_LINE_YN', e.target.checked ? 'Y' : 'N')}
                      disabled={readOnly}
                    />
                    <span>기존선로여부</span>
                  </label>
                </div>
              </div>
            </>
          )}
      </div>
    </BaseModal>
  );
};

export default InstallInfoModal;
