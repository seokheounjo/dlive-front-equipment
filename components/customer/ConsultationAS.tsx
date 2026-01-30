import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Wrench, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Send, Calendar, Clock,
  RefreshCw, ArrowLeft, FileText
} from 'lucide-react';
import {
  getConsultationHistory,
  getWorkHistory,
  registerConsultation,
  registerASRequest,
  getConsultationCodes,
  getConsultationLargeCodes,
  getConsultationMiddleCodes,
  getConsultationSmallCodes,
  getASReasonCodes,
  ConsultationHistory,
  WorkHistory,
  ConsultationRequest,
  ASRequestParams,
  formatDate
} from '../../services/customerApi';

interface ConsultationASProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer: {
    custId: string;
    custNm: string;
    telNo: string;
  } | null;
  selectedContract: {
    ctrtId: string;
    prodNm: string;
    instAddr: string;
    postId?: string;
  } | null;
  onNavigateToBasicInfo: () => void;
  initialTab?: 'consultation' | 'as';  // 초기 탭 지정 (AS 버튼에서 이동 시 'as')
}

interface CodeItem {
  CODE: string;
  CODE_NM: string;
}

// D'Live 코드 형식 (CMCS010/020/030)
interface DLiveCode {
  code: string;
  name: string;
  ref_code?: string;  // 상위 분류 코드 참조
}

/**
 * 상담/AS 화면
 *
 * 회의록 기준:
 * - 상담이력 조회/등록
 * - AS 접수 (반드시 1개의 계약이 특정되어야 함)
 * - 작업이력 조회
 */
const ConsultationAS: React.FC<ConsultationASProps> = ({
  onBack,
  showToast,
  selectedCustomer,
  selectedContract,
  onNavigateToBasicInfo,
  initialTab = 'consultation'
}) => {
  // 탭 상태 (initialTab prop으로 초기값 설정)
  const [activeTab, setActiveTab] = useState<'consultation' | 'as'>(initialTab);

  // initialTab이 변경되면 activeTab 업데이트 (AS 버튼 클릭 시)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // 이력 데이터
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([]);

  // 코드 데이터
  const [consultationCodes, setConsultationCodes] = useState<CodeItem[]>([]);
  const [asReasonCodes, setASReasonCodes] = useState<CodeItem[]>([]);

  // 상담 등록 폼 (와이어프레임 기준: 대/중/소분류)
  const [consultationForm, setConsultationForm] = useState({
    cnslLClCd: '',      // 상담대분류
    cnslMClCd: '',      // 상담중분류
    cnslSClCd: '',      // 상담소분류
    reqCntn: '',
    transYn: 'N',
    transDeptCd: ''
  });

  // 상담 분류 코드 데이터 (D'Live API에서 로드)
  const [cnslLCodes, setCnslLCodes] = useState<DLiveCode[]>([]);
  const [allCnslMCodes, setAllCnslMCodes] = useState<DLiveCode[]>([]);  // 전체 중분류 (필터용)
  const [allCnslSCodes, setAllCnslSCodes] = useState<DLiveCode[]>([]);  // 전체 소분류 (필터용)
  const [cnslMCodes, setCnslMCodes] = useState<DLiveCode[]>([]);        // 필터된 중분류
  const [cnslSCodes, setCnslSCodes] = useState<DLiveCode[]>([]);        // 필터된 소분류

  // 상담대분류 변경 시 중분류 필터링
  const handleCnslLChange = (code: string) => {
    setConsultationForm(prev => ({ ...prev, cnslLClCd: code, cnslMClCd: '', cnslSClCd: '' }));
    setCnslSCodes([]);
    // allCnslMCodes에서 ref_code가 선택된 대분류와 일치하는 것만 필터링
    const filtered = allCnslMCodes.filter(m => m.ref_code === code);
    setCnslMCodes(filtered);
  };

  // 상담중분류 변경 시 소분류 필터링
  const handleCnslMChange = (code: string) => {
    setConsultationForm(prev => ({ ...prev, cnslMClCd: code, cnslSClCd: '' }));
    // allCnslSCodes에서 ref_code가 선택된 중분류와 일치하는 것만 필터링
    const filtered = allCnslSCodes.filter(s => s.ref_code === code);
    setCnslSCodes(filtered);
  };

  // AS 접수 폼 (와이어프레임 기준 확장)
  const [asForm, setASForm] = useState({
    asClCd: '',           // AS구분
    asClDtlCd: '',        // 콤보상세
    tripFeeCd: '',        // 출장비
    asResnLCd: '',        // AS접수사유(대)
    asResnMCd: '',        // AS접수사유(중)
    asCntn: '',           // AS 내용
    schdDt: new Date().toISOString().split('T')[0],  // 작업예정일
    schdHour: '09',       // 작업예정시 (09~21)
    schdMin: '00'         // 작업예정분 (10분 단위)
  });

  // AS 코드 데이터
  const [asClCodes] = useState([
    { CODE: '01', CODE_NM: 'A/S' },
    { CODE: '02', CODE_NM: '재설치' },
    { CODE: '03', CODE_NM: '철거' },
    { CODE: '04', CODE_NM: '장비교체' }
  ]);

  const [asClDtlCodes] = useState([
    { CODE: '01', CODE_NM: '화면불량' },
    { CODE: '02', CODE_NM: '음성불량' },
    { CODE: '03', CODE_NM: '인터넷불량' },
    { CODE: '04', CODE_NM: '리모컨불량' },
    { CODE: '05', CODE_NM: '기타' }
  ]);

  const [tripFeeCodes] = useState([
    { CODE: '00', CODE_NM: '무료' },
    { CODE: '01', CODE_NM: '유료' }
  ]);

  const [asResnLCodes] = useState([
    { CODE: '01', CODE_NM: '장비장애' },
    { CODE: '02', CODE_NM: '회선장애' },
    { CODE: '03', CODE_NM: '고객요청' },
    { CODE: '04', CODE_NM: '기타' }
  ]);

  const [asResnMCodes, setAsResnMCodes] = useState<CodeItem[]>([]);

  // AS사유(대) 변경 시 중분류 설정
  const handleAsResnLChange = (code: string) => {
    setASForm(prev => ({ ...prev, asResnLCd: code, asResnMCd: '' }));
    // 대분류에 따른 중분류 설정
    const mCodes: Record<string, CodeItem[]> = {
      '01': [
        { CODE: '0101', CODE_NM: 'STB 불량' },
        { CODE: '0102', CODE_NM: '모뎀 불량' },
        { CODE: '0103', CODE_NM: '케이블 불량' }
      ],
      '02': [
        { CODE: '0201', CODE_NM: '신호불량' },
        { CODE: '0202', CODE_NM: '단선' },
        { CODE: '0203', CODE_NM: '혼선' }
      ],
      '03': [
        { CODE: '0301', CODE_NM: '위치변경' },
        { CODE: '0302', CODE_NM: '추가설치' },
        { CODE: '0303', CODE_NM: '해지요청' }
      ],
      '04': [
        { CODE: '0401', CODE_NM: '기타' }
      ]
    };
    setAsResnMCodes(mCodes[code] || []);
  };

  // 시간 옵션 생성
  const hourOptions = Array.from({ length: 13 }, (_, i) => {
    const hour = (9 + i).toString().padStart(2, '0');
    return { value: hour, label: `${hour}시` };
  });

  const minOptions = Array.from({ length: 6 }, (_, i) => {
    const min = (i * 10).toString().padStart(2, '0');
    return { value: min, label: `${min}분` };
  });

  // 로딩 상태
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 섹션 펼침 상태
  const [showHistory, setShowHistory] = useState(true);

  // 초기 데이터 로드
  useEffect(() => {
    loadCodes();
    if (selectedCustomer && selectedContract) {
      loadHistory();
    }
  }, [selectedCustomer, selectedContract]);

  const loadCodes = async () => {
    setIsLoadingCodes(true);
    try {
      // D'Live 상담분류 코드 (CMCS010/020/030) 로드
      const [lCodesRes, mCodesRes, sCodesRes, asRes] = await Promise.all([
        getConsultationLargeCodes(),
        getConsultationMiddleCodes(),
        getConsultationSmallCodes(),
        getASReasonCodes()
      ]);

      // 대분류 (CMCS010) - 빈 코드와 선택 제외
      if (lCodesRes.success && lCodesRes.data) {
        const filtered = lCodesRes.data
          .filter((item: any) => item.code && item.code !== '[]' && item.name !== '선택')
          .map((item: any) => ({
            code: item.code,
            name: item.name,
            ref_code: item.ref_code
          }));
        setCnslLCodes(filtered);
      }

      // 중분류 (CMCS020) - ref_code로 대분류와 연결
      if (mCodesRes.success && mCodesRes.data) {
        const filtered = mCodesRes.data
          .filter((item: any) => item.code && item.code !== '[]' && item.name !== '선택')
          .map((item: any) => ({
            code: item.code,
            name: item.name,
            ref_code: item.ref_code  // 대분류 코드 참조
          }));
        setAllCnslMCodes(filtered);
      }

      // 소분류 (CMCS030) - ref_code로 중분류와 연결
      if (sCodesRes.success && sCodesRes.data) {
        const filtered = sCodesRes.data
          .filter((item: any) => item.code && item.code !== '[]' && item.name !== '선택')
          .map((item: any) => ({
            code: item.code,
            name: item.name,
            ref_code: item.ref_code  // 중분류 코드 참조
          }));
        setAllCnslSCodes(filtered);
      }

      if (asRes.success && asRes.data) {
        setASReasonCodes(asRes.data);
      }
    } catch (error) {
      console.error('Load codes error:', error);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  const loadHistory = async () => {
    if (!selectedCustomer || !selectedContract) {
      setConsultationHistory([]);
      setWorkHistory([]);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const [consultRes, workRes] = await Promise.all([
        getConsultationHistory(selectedCustomer.custId, selectedContract.ctrtId, 20),
        getWorkHistory(selectedCustomer.custId, selectedContract.ctrtId, 20)
      ]);

      if (consultRes.success && consultRes.data) {
        setConsultationHistory(consultRes.data);
      }
      if (workRes.success && workRes.data) {
        setWorkHistory(workRes.data);
      }
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 상담 등록
  const handleRegisterConsultation = async () => {
    if (!selectedCustomer) {
      showToast?.('먼저 고객을 선택해주세요.', 'warning');
      return;
    }

    if (!consultationForm.cnslLClCd || !consultationForm.cnslMClCd || !consultationForm.cnslSClCd) {
      showToast?.('상담 분류를 모두 선택해주세요.', 'warning');
      return;
    }

    if (!consultationForm.reqCntn.trim()) {
      showToast?.('요청사항을 입력해주세요.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      // D'Live API에 맞는 파라미터명 사용
      // CNSL_LCL_CD (대분류), CNSL_MCL_CD (중분류), CNSL_SCL_CD (소분류)
      const params: any = {
        CUST_ID: selectedCustomer.custId,
        CTRT_ID: selectedContract?.ctrtId || '',
        CNSL_LCL_CD: consultationForm.cnslLClCd,   // 대분류 (CMCS010: AS, IN, RT, etc)
        CNSL_MCL_CD: consultationForm.cnslMClCd,   // 중분류 (CMCS020: ASC, INE, etc)
        CNSL_SCL_CD: consultationForm.cnslSClCd,   // 소분류 (CMCS030: ASE1, etc)
        CNSL_CNTN: consultationForm.reqCntn,       // 상담내용
        POST_ID: selectedContract?.postId || '',
        SAVE_TP: '2',  // 완료 저장
        TRANS_YN: consultationForm.transYn,
        TRANS_DEPT_CD: consultationForm.transDeptCd || undefined
      };

      const response = await registerConsultation(params);

      if (response.success) {
        showToast?.('상담이 등록되었습니다.', 'success');
        // 폼 초기화
        setConsultationForm({
          cnslLClCd: '',
          cnslMClCd: '',
          cnslSClCd: '',
          reqCntn: '',
          transYn: 'N',
          transDeptCd: ''
        });
        setCnslMCodes([]);
        setCnslSCodes([]);
        // 이력 새로고침
        loadHistory();
      } else {
        showToast?.(response.message || '상담 등록에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Register consultation error:', error);
      showToast?.('상담 등록 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // AS 접수
  const handleRegisterAS = async () => {
    if (!selectedCustomer) {
      showToast?.('먼저 고객을 선택해주세요.', 'warning');
      return;
    }

    if (!selectedContract) {
      showToast?.('AS 접수를 위해 계약을 선택해주세요.', 'warning');
      return;
    }

    if (!asForm.asClCd) {
      showToast?.('AS구분을 선택해주세요.', 'warning');
      return;
    }

    if (!asForm.asResnLCd || !asForm.asResnMCd) {
      showToast?.('AS접수사유를 선택해주세요.', 'warning');
      return;
    }

    if (!asForm.asCntn.trim()) {
      showToast?.('AS 내용을 입력해주세요.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      // 로그인 사용자 정보 (localStorage에서)
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

      const params = {
        CUST_ID: selectedCustomer.custId,
        CTRT_ID: selectedContract.ctrtId,
        POST_ID: selectedContract.postId || '',
        INST_ADDR: selectedContract.instAddr,
        AS_CL_CD: asForm.asClCd,
        AS_CL_DTL_CD: asForm.asClDtlCd,
        TRIP_FEE_CD: asForm.tripFeeCd,
        AS_RESN_L_CD: asForm.asResnLCd,
        AS_RESN_M_CD: asForm.asResnMCd,
        AS_CNTN: asForm.asCntn,
        SCHD_DT: asForm.schdDt.replace(/-/g, ''),
        SCHD_TM: asForm.schdHour + asForm.schdMin,
        WRKR_ID: userInfo.userId || ''
      };

      const response = await registerASRequest(params);

      if (response.success) {
        showToast?.('AS가 접수되었습니다.', 'success');
        // 폼 초기화
        setASForm({
          asClCd: '',
          asClDtlCd: '',
          tripFeeCd: '',
          asResnLCd: '',
          asResnMCd: '',
          asCntn: '',
          schdDt: new Date().toISOString().split('T')[0],
          schdHour: '09',
          schdMin: '00'
        });
        setAsResnMCodes([]);
        // 이력 새로고침
        loadHistory();
      } else {
        showToast?.(response.message || 'AS 접수에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Register AS error:', error);
      showToast?.('AS 접수 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 고객 미선택 시 안내
  if (!selectedCustomer) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">고객을 먼저 선택해주세요</h3>
          <p className="text-gray-500 mb-4">
            기본조회 탭에서 고객을 검색하고 선택한 후<br />
            상담/AS를 진행할 수 있습니다.
          </p>
          <button
            onClick={onNavigateToBasicInfo}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            기본조회로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 탭 선택 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-1">
          <button
            onClick={() => setActiveTab('consultation')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
              activeTab === 'consultation'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            상담 등록
          </button>
          <button
            onClick={() => setActiveTab('as')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
              activeTab === 'as'
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            AS 접수
          </button>
        </div>

        {/* 상담 등록 */}
        {activeTab === 'consultation' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              상담 등록
            </h3>

            {/* 고객 정보 */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-800">
                <span className="font-medium">{selectedCustomer.custNm}</span>
                <span className="ml-2 text-blue-600">({selectedCustomer.custId})</span>
              </div>
              {selectedContract && (
                <div className="text-xs text-blue-600 mt-1">
                  선택된 계약: {selectedContract.prodNm}
                </div>
              )}
            </div>

            {/* 상담 분류 (대/중/소) - D'Live CMCS010/020/030 코드 사용 */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">상담대분류 *</label>
                <select
                  value={consultationForm.cnslLClCd}
                  onChange={(e) => handleCnslLChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">선택</option>
                  {cnslLCodes.map(item => (
                    <option key={item.code} value={item.code}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">상담중분류 *</label>
                  <select
                    value={consultationForm.cnslMClCd}
                    onChange={(e) => handleCnslMChange(e.target.value)}
                    disabled={!consultationForm.cnslLClCd || cnslMCodes.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">선택</option>
                    {cnslMCodes.map(item => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">상담소분류 *</label>
                  <select
                    value={consultationForm.cnslSClCd}
                    onChange={(e) => setConsultationForm(prev => ({ ...prev, cnslSClCd: e.target.value }))}
                    disabled={!consultationForm.cnslMClCd || cnslSCodes.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">선택</option>
                    {cnslSCodes.map(item => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 요청사항 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">요청사항 *</label>
              <textarea
                value={consultationForm.reqCntn}
                onChange={(e) => setConsultationForm(prev => ({
                  ...prev,
                  reqCntn: e.target.value
                }))}
                placeholder="요청사항을 입력해주세요."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* 전달 처리 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="transYn"
                checked={consultationForm.transYn === 'Y'}
                onChange={(e) => setConsultationForm(prev => ({
                  ...prev,
                  transYn: e.target.checked ? 'Y' : 'N'
                }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="transYn" className="text-sm text-gray-600">
                전달 처리 (지점/업체에 전달)
              </label>
            </div>

            {/* 등록 버튼 */}
            <button
              onClick={handleRegisterConsultation}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  등록 중...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  상담 등록
                </>
              )}
            </button>
          </div>
        )}

        {/* AS 접수 */}
        {activeTab === 'as' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              AS 접수
            </h3>

            {/* 계약 선택 안내 */}
            {!selectedContract ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      AS 접수를 위해 계약을 선택해주세요
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      기본조회 탭에서 계약현황에서 계약을 선택한 후 AS 접수가 가능합니다.
                    </p>
                    <button
                      onClick={onNavigateToBasicInfo}
                      className="mt-2 text-sm text-yellow-700 underline hover:text-yellow-800"
                    >
                      계약 선택하러 가기 →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* 선택된 계약 정보 */}
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm text-orange-800">
                    <span className="font-medium">{selectedContract.prodNm}</span>
                    <span className="ml-2 text-orange-600">({selectedContract.ctrtId})</span>
                  </div>
                  <div className="text-xs text-orange-600 mt-1">
                    {selectedContract.instAddr}
                  </div>
                </div>

                {/* AS구분 & 콤보상세 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">AS구분 *</label>
                    <select
                      value={asForm.asClCd}
                      onChange={(e) => setASForm(prev => ({ ...prev, asClCd: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">선택</option>
                      {asClCodes.map(code => (
                        <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">콤보상세</label>
                    <select
                      value={asForm.asClDtlCd}
                      onChange={(e) => setASForm(prev => ({ ...prev, asClDtlCd: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">선택</option>
                      {asClDtlCodes.map(code => (
                        <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 출장비 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">출장비</label>
                  <select
                    value={asForm.tripFeeCd}
                    onChange={(e) => setASForm(prev => ({ ...prev, tripFeeCd: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">선택</option>
                    {tripFeeCodes.map(code => (
                      <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                    ))}
                  </select>
                </div>

                {/* AS접수사유 (대/중) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">AS접수사유(대) *</label>
                    <select
                      value={asForm.asResnLCd}
                      onChange={(e) => handleAsResnLChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">선택</option>
                      {asResnLCodes.map(code => (
                        <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">AS접수사유(중) *</label>
                    <select
                      value={asForm.asResnMCd}
                      onChange={(e) => setASForm(prev => ({ ...prev, asResnMCd: e.target.value }))}
                      disabled={!asForm.asResnLCd}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                    >
                      <option value="">선택</option>
                      {asResnMCodes.map(code => (
                        <option key={code.CODE} value={code.CODE}>{code.CODE_NM}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* AS 내용 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">AS 내용 *</label>
                  <textarea
                    value={asForm.asCntn}
                    onChange={(e) => setASForm(prev => ({ ...prev, asCntn: e.target.value }))}
                    placeholder="AS 내용을 입력해주세요."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                </div>

                {/* 작업예정일시 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">작업예정일시 *</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={asForm.schdDt}
                      onChange={(e) => setASForm(prev => ({ ...prev, schdDt: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <select
                      value={asForm.schdHour}
                      onChange={(e) => setASForm(prev => ({ ...prev, schdHour: e.target.value }))}
                      className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {hourOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <select
                      value={asForm.schdMin}
                      onChange={(e) => setASForm(prev => ({ ...prev, schdMin: e.target.value }))}
                      className="w-20 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {minOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 접수 버튼 */}
                <button
                  onClick={handleRegisterAS}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      접수 중...
                    </>
                  ) : (
                    <>
                      <Wrench className="w-5 h-5" />
                      AS 접수
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* 이력 조회 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-800">
                {activeTab === 'consultation' ? '상담 이력' : '작업 이력'}
              </span>
              <span className="text-sm text-gray-500">
                ({activeTab === 'consultation' ? consultationHistory.length : workHistory.length}건)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  loadHistory();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              </button>
              {showHistory ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </button>

          {showHistory && (
            <div className="px-4 pb-4">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : !selectedContract ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  기본조회에서 계약을 선택해주세요.
                </div>
              ) : activeTab === 'consultation' ? (
                consultationHistory.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {consultationHistory.map((item, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{item.CNSL_SLV_CL_NM}</span>
                          <span className="text-xs text-gray-500">{item.START_DATE}</span>
                        </div>
                        <div className="text-sm text-gray-600">{item.REQ_CTX}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            item.CNSL_RSLT?.includes('완료') ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {item.CNSL_RSLT || '처리중'}
                          </span>
                          <span className="text-xs text-gray-400">{item.RCPT_NM}</span>
                        </div>
                        {item.PROC_CT && (
                          <div className="text-xs text-gray-500 mt-2 border-t pt-2">{item.PROC_CT}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    상담 이력이 없습니다.
                  </div>
                )
              ) : (
                workHistory.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {workHistory.map((item, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{item.WRK_CD_NM}</span>
                          <span className="text-xs text-gray-500">{item.HOPE_DT}</span>
                        </div>
                        <div className="text-sm text-gray-600">{item.PROD_NM}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            item.WRK_STAT_CD_NM?.includes('완료') ? 'bg-green-100 text-green-700' :
                            item.WRK_STAT_CD_NM?.includes('진행') ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.WRK_STAT_CD_NM}
                          </span>
                          <span className="text-xs text-gray-400">{item.WRK_NM}</span>
                          {item.WRK_CRR_NM && <span className="text-xs text-gray-400">({item.WRK_CRR_NM})</span>}
                        </div>
                        {item.CMPL_DATE && (
                          <div className="text-xs text-gray-500 mt-1">완료: {item.CMPL_DATE}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    작업 이력이 없습니다.
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultationAS;
