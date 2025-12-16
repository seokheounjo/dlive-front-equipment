import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, AlertCircle, Play, Download, ChevronDown, ChevronUp,
  RefreshCw, Search, Filter, Zap, List, Terminal, Settings, Activity
} from 'lucide-react';

// ============ 타입 정의 ============
interface ApiDefinition {
  id: string;
  name: string;
  path: string;
  category: string;
  feature: string;
  apiStatus: 'working' | 'error' | 'unknown';  // 실제 동작 상태
  required: string[];
  optional: string[];
}

interface TestResult {
  apiId: string;
  apiPath: string;
  apiName: string;
  status: 'success' | 'error' | 'timeout';
  statusCode?: number;
  request: any;
  response: any;
  duration: number;
  timestamp: string;
  responseFields: string[];
  hasData: boolean;  // 빈 배열이 아닌 실제 데이터가 있는지
}

interface LogEntry {
  id: string;
  timestamp: string;
  api: string;
  method: string;
  status: 'success' | 'error' | 'timeout';
  duration: number;
  request: any;
  response: any;
}

// ============ 실제 테스트 데이터 (D'Live 시스템 기반) ============
const REAL_TEST_DATA = {
  WRKR_ID: ['20230019', '20230020', '20230021'],
  EQT_NO: ['EQT001', 'EQT002', 'EQT003', 'EQT004', 'EQT005'],
  EQT_SERNO: ['CT22947931247BA0', 'DR7227112123733F', '11420829432741', 'D1603A013377', 'S63LB43039'],
  MAC_ADDRESS: ['481B40B6F453', '0280194087'],
  SO_ID: ['100', 'SO-001', 'SO-002'],
  CARRIER_ID: ['CRR-001', 'CRR-002', 'CRR-003'],
  USR_NM: ['이진영', '김기사', '박기사'],
};

// ============ 20개 장비관리 API 정의 (2025-12-11 테스트 결과 기반) ============
// apiStatus: 'working' = 200 OK 응답, 'error' = 500 에러
const EQUIPMENT_APIS: ApiDefinition[] = [
  // 1. 장비할당/반납처리 (9개)
  { id: 'api01', name: '기사할당장비조회', path: '/customer/equipment/getEquipmentOutList', category: '장비할당/반납처리', feature: '출고된 장비 목록 조회', apiStatus: 'working', required: ['WRKR_ID'], optional: ['SO_ID', 'OUT_DATE', 'CARRIER_ID'] },
  { id: 'api02', name: '기사할당장비확인', path: '/customer/equipment/getEquipmentProcYnCheck', category: '장비할당/반납처리', feature: '장비 처리 가능 여부 확인', apiStatus: 'error', required: ['WRKR_ID', 'SO_ID', 'EQT_NO'], optional: [] },
  { id: 'api03', name: '법인장비쿼터추가', path: '/customer/equipment/addCorporationEquipmentQuota', category: '장비할당/반납처리', feature: '법인 장비 쿼터 추가', apiStatus: 'error', required: ['SO_ID', 'EQT_NO', 'CARRIER_ID', 'WRKR_ID'], optional: ['CORP_ID', 'EQT_TYPE', 'QUOTA', 'REG_UID'] },
  { id: 'api04', name: '반납요청목록조회', path: '/customer/equipment/getEquipmentReturnRequestList', category: '장비할당/반납처리', feature: '반납 요청 목록', apiStatus: 'working', required: ['WRKR_ID'], optional: ['SO_ID', 'START_DATE', 'END_DATE'] },
  { id: 'api05', name: '반납요청확인', path: '/customer/equipment/getEquipmentReturnRequestCheck', category: '장비할당/반납처리', feature: '반납 요청 존재 여부', apiStatus: 'error', required: ['WRKR_ID', 'SO_ID', 'EQT_NO'], optional: [] },
  { id: 'api06', name: '반납요청등록', path: '/customer/equipment/addEquipmentReturnRequest', category: '장비할당/반납처리', feature: '새 반납 요청 등록', apiStatus: 'error', required: ['EQT_NO', 'WRKR_ID'], optional: ['SO_ID', 'RETURN_REASON', 'REG_UID'] },
  { id: 'api07', name: '작업자보유장비조회', path: '/customer/equipment/getWrkrHaveEqtList', category: '장비할당/반납처리', feature: '기사 보유 장비 목록', apiStatus: 'working', required: ['WRKR_ID'], optional: ['SO_ID', 'EQT_STAT_CD'] },
  { id: 'api08', name: '분실처리', path: '/customer/equipment/cmplEqtCustLossIndem', category: '장비할당/반납처리', feature: '장비 분실 배상 처리', apiStatus: 'error', required: ['EQT_NO'], optional: ['WRKR_ID', 'SO_ID', 'LOSS_REASON', 'REG_UID'] },
  { id: 'api09', name: '장비상태변경(검사대기)', path: '/customer/equipment/setEquipmentChkStndByY', category: '장비할당/반납처리', feature: '검사대기 상태 설정', apiStatus: 'error', required: ['EQT_NO', 'WRKR_ID'], optional: ['SO_ID', 'REG_UID'] },

  // 2. 장비상태조회 (2개)
  { id: 'api10', name: '장비이력조회', path: '/statistics/equipment/getEquipmentHistoryInfo', category: '장비상태조회', feature: 'S/N 또는 MAC으로 장비 이력 조회', apiStatus: 'error', required: [], optional: ['EQT_NO', 'EQT_SERNO', 'MAC_ADDRESS', 'WRKR_ID', 'SO_ID', 'SERIAL_NO'] },
  { id: 'api11', name: '장비기사이관', path: '/customer/equipment/changeEqtWrkr_3', category: '장비상태조회', feature: '장비 담당자 변경', apiStatus: 'error', required: ['EQT_NO', 'TO_WRKR_ID'], optional: ['FROM_WRKR_ID', 'CTRT_ID', 'SO_ID', 'CRR_ID', 'REG_UID'] },

  // 3. 기사간 장비이동 (2개)
  { id: 'api12', name: '타기사조회', path: '/system/cm/getFindUsrList3', category: '기사간 장비이동', feature: '기사 정보 검색', apiStatus: 'working', required: ['USR_NM'], optional: ['WRKR_ID', 'SO_ID', 'SEARCH_TEXT', 'SEARCH_TYPE'] },
  { id: 'api13', name: '타기사문자발송', path: '/customer/sigtrans/saveENSSendHist', category: '기사간 장비이동', feature: '장비이관 SMS 발송', apiStatus: 'error', required: ['EQT_NO', 'TO_WRKR_ID', 'FROM_WRKR_ID'], optional: ['DEST_PHONE', 'MESSAGE', 'REG_UID'] },

  // 4. 미회수 장비 회수처리 (2개)
  { id: 'api14', name: '미회수장비조회', path: '/customer/work/getEquipLossInfo', category: '미회수 장비 회수처리', feature: '미회수 장비 리스트', apiStatus: 'working', required: [], optional: ['WRKR_ID', 'EQT_NO', 'SO_ID', 'START_DATE', 'END_DATE'] },
  { id: 'api15', name: '미회수장비회수처리', path: '/customer/work/modEquipLoss', category: '미회수 장비 회수처리', feature: '미회수 장비 회수', apiStatus: 'error', required: ['EQT_NO', 'STATE'], optional: ['MEMO', 'WRKR_ID', 'SO_ID', 'RECOVERY_STATUS', 'REG_UID'] },

  // 5. 작업장비정보 (3개)
  { id: 'api16', name: '작업장비정보조회', path: '/customer/work/getCustProdInfo', category: '작업장비정보', feature: '고객 장비 정보 조회 (output1~4)', apiStatus: 'working', required: [], optional: ['CUST_ID', 'SO_ID', 'WRKR_ID'] },
  { id: 'api17', name: '장비구성변경', path: '/customer/work/eqtCmpsInfoChg', category: '작업장비정보', feature: '장비 구성 정보 변경', apiStatus: 'error', required: ['EQT_NO'], optional: ['CMPS_INFO', 'WRKR_ID'] },
  { id: 'api18', name: '신호체크', path: '/customer/work/signalCheck', category: '작업장비정보', feature: '장비 신호 상태 체크 (signalStrength 반환)', apiStatus: 'working', required: [], optional: ['EQT_NO', 'SO_ID'] },

  // 6. 계약장비 (2개) - 73개 장비 모델 데이터 반환!
  { id: 'api19', name: '상품별모델조회', path: '/customer/receipt/contract/getEquipmentNmListOfProd', category: '계약장비', feature: '상품별 장비 모델 목록 (73개 모델)', apiStatus: 'working', required: [], optional: ['PROD_ID', 'SO_ID'] },
  { id: 'api20', name: '계약장비조회', path: '/customer/receipt/contract/getContractEqtList', category: '계약장비', feature: '계약 장비 목록 (output1~3)', apiStatus: 'working', required: [], optional: ['CTRT_ID', 'SO_ID'] },
];

// ============ 메인 컴포넌트 ============
const EquipmentApiTester: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'test' | 'logs' | 'manual'>('overview');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [expandedApis, setExpandedApis] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'working' | 'error'>('all');
  const [manualParams, setManualParams] = useState<Record<string, string>>({});
  const [selectedApi, setSelectedApi] = useState<string>(EQUIPMENT_APIS[0].path);
  const [manualResult, setManualResult] = useState<any>(null);

  // 파라미터 기본값 생성
  const getDefaultParams = (api: ApiDefinition): Record<string, string> => {
    const params: Record<string, string> = {};
    [...api.required, ...api.optional].forEach(key => {
      if (key === 'WRKR_ID' || key === 'TO_WRKR_ID' || key === 'FROM_WRKR_ID') params[key] = '20230019';
      else if (key === 'SO_ID') params[key] = 'SO-001';
      else if (key === 'EQT_NO') params[key] = 'EQT001';
      else if (key === 'EQT_SERNO' || key === 'SERIAL_NO') params[key] = 'CT22947931247BA0';
      else if (key === 'MAC_ADDRESS') params[key] = '0280194087';
      else if (key === 'CARRIER_ID' || key === 'CRR_ID') params[key] = 'CRR-001';
      else if (key === 'USR_NM') params[key] = '이진영';
      else if (key === 'STATE') params[key] = 'RECOVERED';
      else if (key === 'OUT_DATE' || key === 'START_DATE') params[key] = '2024-12-01';
      else if (key === 'END_DATE') params[key] = '2024-12-31';
      else if (key === 'EQT_STAT_CD') params[key] = '10';
      else if (key === 'SEARCH_TEXT') params[key] = '이진';
      else if (key === 'SEARCH_TYPE') params[key] = 'NAME';
      else if (key === 'MESSAGE') params[key] = '장비 이관 알림';
      else if (key === 'MEMO') params[key] = '테스트 메모';
      else if (key === 'RETURN_REASON') params[key] = '장비 교체';
      else if (key === 'LOSS_REASON') params[key] = '분실';
      else params[key] = '';
    });
    return params;
  };

  // API 호출 함수
  const callApi = async (api: ApiDefinition, params: Record<string, any>): Promise<TestResult> => {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`/api${api.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const data = await response.json();

      const responseFields = Array.isArray(data) && data.length > 0
        ? Object.keys(data[0])
        : (typeof data === 'object' && data !== null ? Object.keys(data) : []);

      const hasData = Array.isArray(data) ? data.length > 0 : (data && Object.keys(data).length > 0);

      const result: TestResult = {
        apiId: api.id,
        apiPath: api.path,
        apiName: api.name,
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        request: params,
        response: data,
        duration,
        timestamp: new Date().toISOString(),
        responseFields,
        hasData,
      };

      // 로그 추가
      addLog(result);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      const isTimeout = error.name === 'AbortError';

      const result: TestResult = {
        apiId: api.id,
        apiPath: api.path,
        apiName: api.name,
        status: isTimeout ? 'timeout' : 'error',
        request: params,
        response: { error: error.message },
        duration,
        timestamp: new Date().toISOString(),
        responseFields: [],
        hasData: false,
      };

      addLog(result);
      return result;
    }
  };

  // 로그 추가
  const addLog = (result: TestResult) => {
    const log: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: result.timestamp,
      api: result.apiPath,
      method: 'POST',
      status: result.status,
      duration: result.duration,
      request: result.request,
      response: result.response,
    };
    setLogs(prev => [log, ...prev].slice(0, 200));
  };

  // 전체 테스트 실행
  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    const results: TestResult[] = [];
    const apisToTest = filter === 'all' ? EQUIPMENT_APIS : EQUIPMENT_APIS.filter(api => api.apiStatus === filter);
    setProgress({ current: 0, total: apisToTest.length });

    for (let i = 0; i < apisToTest.length; i++) {
      const api = apisToTest[i];
      setProgress({ current: i + 1, total: apisToTest.length });

      const params = getDefaultParams(api);
      // 필수 파라미터만 전송
      const requiredParams: Record<string, string> = {};
      api.required.forEach(key => {
        if (params[key]) requiredParams[key] = params[key];
      });

      const result = await callApi(api, Object.keys(requiredParams).length > 0 ? requiredParams : params);
      results.push(result);
      setTestResults([...results]);

      await new Promise(r => setTimeout(r, 300));
    }

    setIsRunning(false);
  };

  // 수동 테스트 실행
  const runManualTest = async () => {
    const api = EQUIPMENT_APIS.find(a => a.path === selectedApi);
    if (!api) return;

    setManualResult(null);
    const result = await callApi(api, manualParams);
    setManualResult(result);
  };

  // 결과 다운로드
  const downloadResults = () => {
    const workingApis = testResults.filter(r => r.status === 'success');
    const errorApis = testResults.filter(r => r.status !== 'success');
    const apisWithData = testResults.filter(r => r.hasData);

    const data = {
      summary: {
        timestamp: new Date().toISOString(),
        totalAPIs: EQUIPMENT_APIS.length,
        testedAPIs: testResults.length,
        workingAPIs: workingApis.length,
        errorAPIs: errorApis.length,
        apisWithData: apisWithData.length,
        successRate: testResults.length > 0 ? `${((workingApis.length / testResults.length) * 100).toFixed(1)}%` : '0%',
      },
      workingAPIs: workingApis.map(r => ({
        name: r.apiName,
        path: r.apiPath,
        statusCode: r.statusCode,
        duration: r.duration,
        hasData: r.hasData,
        responseFields: r.responseFields,
        request: r.request,
        response: r.response,
      })),
      errorAPIs: errorApis.map(r => ({
        name: r.apiName,
        path: r.apiPath,
        statusCode: r.statusCode,
        duration: r.duration,
        error: r.response,
        request: r.request,
      })),
      allResults: testResults,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipment-api-unified-test-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 선택된 API 변경 시 파라미터 초기화
  useEffect(() => {
    const api = EQUIPMENT_APIS.find(a => a.path === selectedApi);
    if (api) {
      setManualParams(getDefaultParams(api));
    }
  }, [selectedApi]);

  // 통계 계산
  const stats = {
    total: EQUIPMENT_APIS.length,
    working: EQUIPMENT_APIS.filter(a => a.apiStatus === 'working').length,
    error: EQUIPMENT_APIS.filter(a => a.apiStatus === 'error').length,
    tested: testResults.length,
    success: testResults.filter(r => r.status === 'success').length,
    withData: testResults.filter(r => r.hasData).length,
  };

  const filteredApis = filter === 'all' ? EQUIPMENT_APIS : EQUIPMENT_APIS.filter(api => api.apiStatus === filter);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">장비관리 API 통합 테스터</h1>
              <p className="text-sm text-gray-600 mt-1">20개 API 원클릭 테스트 및 실시간 모니터링</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={runAllTests}
                disabled={isRunning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {isRunning ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                {isRunning ? `테스트 중 (${progress.current}/${progress.total})` : '전체 테스트'}
              </button>
              <button
                onClick={downloadResults}
                disabled={testResults.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <Download size={18} />
                결과 다운로드
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mt-4 border-b">
            {[
              { id: 'overview', label: 'API 현황', icon: List },
              { id: 'test', label: '테스트 결과', icon: Activity },
              { id: 'logs', label: '실시간 로그', icon: Terminal },
              { id: 'manual', label: '수동 테스트', icon: Settings },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">전체 API</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.working}</div>
            <div className="text-sm text-gray-600">정상 작동</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.error}</div>
            <div className="text-sm text-gray-600">오류 발생</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.tested}</div>
            <div className="text-sm text-gray-600">테스트 완료</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{stats.success}</div>
            <div className="text-sm text-gray-600">성공 (200)</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{stats.withData}</div>
            <div className="text-sm text-gray-600">데이터 있음</div>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 mb-4">
          {[
            { id: 'all', label: '전체' },
            { id: 'working', label: '정상' },
            { id: 'error', label: '오류' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1 rounded-full text-sm ${
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* API 현황 탭 */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow">
            <div className="divide-y">
              {filteredApis.map((api, index) => {
                const result = testResults.find(r => r.apiPath === api.path);
                const isExpanded = expandedApis.has(api.id);

                return (
                  <div key={api.id} className="p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => {
                        const newSet = new Set(expandedApis);
                        isExpanded ? newSet.delete(api.id) : newSet.add(api.id);
                        setExpandedApis(newSet);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span className="w-8 text-gray-500">{index + 1}.</span>
                        {api.apiStatus === 'working' ? (
                          <CheckCircle2 size={20} className="text-green-600" />
                        ) : (
                          <XCircle size={20} className="text-red-600" />
                        )}
                        <div>
                          <div className="font-medium">{api.name}</div>
                          <code className="text-xs text-gray-500">{api.path}</code>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {api.category}
                        </span>
                        {result && (
                          <span className={`text-sm font-medium ${
                            result.status === 'success' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {result.statusCode || result.status} ({result.duration}ms)
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pl-12 space-y-3">
                        <div className="text-sm text-gray-600">{api.feature}</div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-red-600">필수: </span>
                            {api.required.length > 0 ? api.required.join(', ') : '없음'}
                          </div>
                          <div>
                            <span className="font-medium text-blue-600">선택: </span>
                            {api.optional.length > 0 ? api.optional.join(', ') : '없음'}
                          </div>
                        </div>
                        {result && (
                          <div className="bg-gray-50 rounded p-3 space-y-2">
                            <div className="text-xs font-semibold">최근 테스트 결과:</div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-blue-600 font-medium mb-1">Request:</div>
                                <pre className="text-xs bg-blue-50 p-2 rounded overflow-auto max-h-32">
                                  {JSON.stringify(result.request, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-xs text-purple-600 font-medium mb-1">Response:</div>
                                <pre className="text-xs bg-purple-50 p-2 rounded overflow-auto max-h-32">
                                  {JSON.stringify(result.response, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 테스트 결과 탭 */}
        {activeTab === 'test' && (
          <div className="bg-white rounded-lg shadow p-4">
            {testResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Activity size={48} className="mx-auto mb-4 opacity-30" />
                <p>테스트 결과가 없습니다. "전체 테스트" 버튼을 클릭하세요.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {result.status === 'success' ? (
                          <CheckCircle2 size={18} className="text-green-600" />
                        ) : (
                          <XCircle size={18} className="text-red-600" />
                        )}
                        <span className="font-medium">{result.apiName}</span>
                        {result.hasData && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                            데이터 있음
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                          {result.statusCode || result.status}
                        </span>
                        <span className="text-gray-500">{result.duration}ms</span>
                      </div>
                    </div>
                    <code className="text-xs text-gray-600 block mb-2">{result.apiPath}</code>
                    {result.responseFields.length > 0 && (
                      <div className="text-xs text-gray-500">
                        응답 필드: {result.responseFields.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 실시간 로그 탭 */}
        {activeTab === 'logs' && (
          <div className="bg-gray-900 rounded-lg shadow p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Terminal size={48} className="mx-auto mb-4 opacity-30" />
                <p>로그가 없습니다. API 호출 시 자동으로 기록됩니다.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className="border-b border-gray-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString('ko-KR')}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        log.status === 'success'
                          ? 'bg-green-800 text-green-200'
                          : 'bg-red-800 text-red-200'
                      }`}>
                        {log.status}
                      </span>
                      <span className="text-blue-400">{log.method}</span>
                      <span className="text-white flex-1 truncate">{log.api}</span>
                      <span className="text-gray-400">{log.duration}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 수동 테스트 탭 */}
        {activeTab === 'manual' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-4">API 선택 및 파라미터</h3>
              <select
                value={selectedApi}
                onChange={(e) => setSelectedApi(e.target.value)}
                className="w-full p-2 border rounded mb-4"
              >
                {EQUIPMENT_APIS.map(api => (
                  <option key={api.path} value={api.path}>
                    {api.name} - {api.path}
                  </option>
                ))}
              </select>

              <div className="space-y-3">
                {EQUIPMENT_APIS.find(a => a.path === selectedApi)?.required.map(key => (
                  <div key={key}>
                    <label className="text-sm font-medium text-red-600">{key} *</label>
                    <input
                      type="text"
                      value={manualParams[key] || ''}
                      onChange={(e) => setManualParams({...manualParams, [key]: e.target.value})}
                      className="w-full p-2 border rounded mt-1"
                    />
                  </div>
                ))}
                {EQUIPMENT_APIS.find(a => a.path === selectedApi)?.optional.map(key => (
                  <div key={key}>
                    <label className="text-sm font-medium text-blue-600">{key}</label>
                    <input
                      type="text"
                      value={manualParams[key] || ''}
                      onChange={(e) => setManualParams({...manualParams, [key]: e.target.value})}
                      className="w-full p-2 border rounded mt-1"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={runManualTest}
                className="w-full mt-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Play size={18} />
                테스트 실행
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-bold mb-4">응답 결과</h3>
              {manualResult ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {manualResult.status === 'success' ? (
                      <CheckCircle2 className="text-green-600" />
                    ) : (
                      <XCircle className="text-red-600" />
                    )}
                    <span className="font-medium">
                      {manualResult.statusCode || manualResult.status} ({manualResult.duration}ms)
                    </span>
                  </div>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-[400px]">
                    {JSON.stringify(manualResult.response, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Settings size={48} className="mx-auto mb-4 opacity-30" />
                  <p>파라미터를 설정하고 테스트를 실행하세요.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentApiTester;
