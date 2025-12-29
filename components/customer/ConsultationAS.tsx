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
  } | null;
  onNavigateToBasicInfo: () => void;
}

interface CodeItem {
  CODE: string;
  CODE_NM: string;
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
  onNavigateToBasicInfo
}) => {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'consultation' | 'as'>('consultation');

  // 이력 데이터
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistory[]>([]);
  const [workHistory, setWorkHistory] = useState<WorkHistory[]>([]);

  // 코드 데이터
  const [consultationCodes, setConsultationCodes] = useState<CodeItem[]>([]);
  const [asReasonCodes, setASReasonCodes] = useState<CodeItem[]>([]);

  // 상담 등록 폼
  const [consultationForm, setConsultationForm] = useState({
    cnslClCd: '',
    reqCntn: '',
    transYn: 'N',
    transDeptCd: ''
  });

  // AS 접수 폼
  const [asForm, setASForm] = useState({
    asResnCd: '',
    asCntn: '',
    schdDt: new Date().toISOString().split('T')[0]
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
    if (selectedCustomer) {
      loadHistory();
    }
  }, [selectedCustomer]);

  const loadCodes = async () => {
    setIsLoadingCodes(true);
    try {
      const [consultRes, asRes] = await Promise.all([
        getConsultationCodes(),
        getASReasonCodes()
      ]);

      if (consultRes.success && consultRes.data) {
        setConsultationCodes(consultRes.data);
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
    if (!selectedCustomer) return;

    setIsLoadingHistory(true);
    try {
      const [consultRes, workRes] = await Promise.all([
        getConsultationHistory(selectedCustomer.custId, 20),
        getWorkHistory(selectedCustomer.custId, 20)
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

    if (!consultationForm.cnslClCd) {
      showToast?.('상담 분류를 선택해주세요.', 'warning');
      return;
    }

    if (!consultationForm.reqCntn.trim()) {
      showToast?.('요청사항을 입력해주세요.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const params: ConsultationRequest = {
        CUST_ID: selectedCustomer.custId,
        CTRT_ID: selectedContract?.ctrtId,
        CNSL_CL_CD: consultationForm.cnslClCd,
        REQ_CNTN: consultationForm.reqCntn,
        TRANS_YN: consultationForm.transYn,
        TRANS_DEPT_CD: consultationForm.transDeptCd || undefined
      };

      const response = await registerConsultation(params);

      if (response.success) {
        showToast?.('상담이 등록되었습니다.', 'success');
        // 폼 초기화
        setConsultationForm({
          cnslClCd: '',
          reqCntn: '',
          transYn: 'N',
          transDeptCd: ''
        });
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

    if (!asForm.asResnCd) {
      showToast?.('AS 사유를 선택해주세요.', 'warning');
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

      const params: ASRequestParams = {
        CUST_ID: selectedCustomer.custId,
        CTRT_ID: selectedContract.ctrtId,
        INST_ADDR: selectedContract.instAddr,
        AS_RESN_CD: asForm.asResnCd,
        AS_CNTN: asForm.asCntn,
        SCHD_DT: asForm.schdDt.replace(/-/g, ''),
        WRKR_ID: userInfo.userId || ''
      };

      const response = await registerASRequest(params);

      if (response.success) {
        showToast?.('AS가 접수되었습니다.', 'success');
        // 폼 초기화
        setASForm({
          asResnCd: '',
          asCntn: '',
          schdDt: new Date().toISOString().split('T')[0]
        });
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

            {/* 상담 분류 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">상담 분류 *</label>
              <select
                value={consultationForm.cnslClCd}
                onChange={(e) => setConsultationForm(prev => ({
                  ...prev,
                  cnslClCd: e.target.value
                }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">선택</option>
                {consultationCodes.map(code => (
                  <option key={code.CODE} value={code.CODE}>
                    {code.CODE_NM}
                  </option>
                ))}
                {/* 기본 옵션 */}
                {consultationCodes.length === 0 && (
                  <>
                    <option value="01">일반문의</option>
                    <option value="02">요금문의</option>
                    <option value="03">장애문의</option>
                    <option value="04">해지문의</option>
                    <option value="99">기타</option>
                  </>
                )}
              </select>
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

                {/* AS 사유 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">AS 사유 *</label>
                  <select
                    value={asForm.asResnCd}
                    onChange={(e) => setASForm(prev => ({
                      ...prev,
                      asResnCd: e.target.value
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">선택</option>
                    {asReasonCodes.map(code => (
                      <option key={code.CODE} value={code.CODE}>
                        {code.CODE_NM}
                      </option>
                    ))}
                    {/* 기본 옵션 */}
                    {asReasonCodes.length === 0 && (
                      <>
                        <option value="01">화면불량</option>
                        <option value="02">음성불량</option>
                        <option value="03">인터넷불량</option>
                        <option value="04">장비교체</option>
                        <option value="99">기타</option>
                      </>
                    )}
                  </select>
                </div>

                {/* AS 내용 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">AS 내용 *</label>
                  <textarea
                    value={asForm.asCntn}
                    onChange={(e) => setASForm(prev => ({
                      ...prev,
                      asCntn: e.target.value
                    }))}
                    placeholder="AS 내용을 입력해주세요."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                </div>

                {/* 작업예정일 */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">작업예정일 *</label>
                  <input
                    type="date"
                    value={asForm.schdDt}
                    onChange={(e) => setASForm(prev => ({
                      ...prev,
                      schdDt: e.target.value
                    }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
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
              ) : activeTab === 'consultation' ? (
                consultationHistory.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {consultationHistory.map((item, index) => (
                      <div key={item.CNSL_ID || index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{item.CNSL_CL_NM}</span>
                          <span className="text-xs text-gray-500">{item.RCPT_DT}</span>
                        </div>
                        <div className="text-sm text-gray-600">{item.REQ_CNTN}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            item.PROC_STAT_NM === '완료' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {item.PROC_STAT_NM}
                          </span>
                        </div>
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
                      <div key={item.WORK_ID || index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{item.WORK_TP_NM}</span>
                          <span className="text-xs text-gray-500">{item.SCHD_DT}</span>
                        </div>
                        <div className="text-sm text-gray-600">{item.PROD_NM}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            item.WORK_STAT_NM === '완료' ? 'bg-green-100 text-green-700' :
                            item.WORK_STAT_NM === '진행중' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.WORK_STAT_NM}
                          </span>
                          <span className="text-xs text-gray-400">{item.WRKR_NM}</span>
                        </div>
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
