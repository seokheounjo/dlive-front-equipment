import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Play, Download, ChevronDown, ChevronUp } from 'lucide-react';

interface ApiInfo {
  path: string;
  name: string;
  tab: string;
  feature: string;
  status: 'completed' | 'incomplete';
  testable: boolean;
  required: string[];
  optional: string[];
}

interface TestCase {
  name: string;
  description: string;
  payload: Record<string, any>;
}

interface TestResult {
  apiPath: string;
  apiName: string;
  testCase: string;
  status: 'success' | 'error';
  statusCode?: number;
  request?: any;
  response?: any;
  error?: string;
  timestamp: string;
}

const EquipmentApiStatus: React.FC = () => {
  const [testingApi, setTestingApi] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [currentTestCase, setCurrentTestCase] = useState(0);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  // 장비관리 4개 탭의 API 목록 (필수/선택 파라미터 포함)
  // 중요: legacy-server의 모든 API는 .req 확장자를 필요로 함 (Spring MVC PropertiesMethodNameResolver 설정)
  const equipmentApis: ApiInfo[] = [
    // 1. 장비할당/반납처리 (9개) - EquipmentManagerDelegate.java
    { path: '/customer/equipment/getEquipmentOutList.req', name: '기사할당장비조회', tab: '장비할당/반납처리', feature: '출고일자/지점 조건으로 기사 할당 장비 조회', status: 'completed', testable: true, required: ['WRKR_ID'], optional: ['SO_ID', 'OUT_DATE', 'CARRIER_ID'] },
    { path: '/customer/equipment/getEquipmentProcYnCheck.req', name: '기사할당장비확인', tab: '장비할당/반납처리', feature: '장비할당처리 확인', status: 'incomplete', testable: true, required: ['WRKR_ID', 'SO_ID', 'EQT_NO'], optional: [] },
    { path: '/customer/equipment/addCorporationEquipmentQuota.req', name: '법인장비쿼터추가', tab: '장비할당/반납처리', feature: '법인 장비 할당', status: 'incomplete', testable: true, required: ['SO_ID', 'EQT_NO', 'CARRIER_ID', 'WRKR_ID'], optional: ['CORP_ID', 'EQT_TYPE', 'QUOTA', 'REG_UID'] },
    { path: '/customer/equipment/getEquipmentReturnRequestList.req', name: '반납요청목록조회', tab: '장비할당/반납처리', feature: '기사가 보유한 장비 조회', status: 'completed', testable: true, required: ['WRKR_ID'], optional: ['SO_ID', 'START_DATE', 'END_DATE'] },
    { path: '/customer/equipment/getEquipmentReturnRequestCheck.req', name: '반납요청확인', tab: '장비할당/반납처리', feature: '장비상태 체크', status: 'incomplete', testable: true, required: ['WRKR_ID', 'SO_ID', 'EQT_NO'], optional: [] },
    { path: '/customer/equipment/addEquipmentReturnRequest.req', name: '반납요청등록', tab: '장비할당/반납처리', feature: '장비반납 요청', status: 'incomplete', testable: true, required: ['EQT_NO', 'WRKR_ID'], optional: ['SO_ID', 'RETURN_REASON', 'REG_UID'] },
    { path: '/customer/equipment/getWrkrHaveEqtList.req', name: '작업자보유장비조회', tab: '장비할당/반납처리', feature: '기사 보유 장비 조회 (분실처리용)', status: 'completed', testable: true, required: ['WRKR_ID'], optional: ['SO_ID', 'EQT_STATUS'] },
    { path: '/customer/equipment/cmplEqtCustLossIndem.req', name: '분실처리', tab: '장비할당/반납처리', feature: '장비 분실 처리', status: 'incomplete', testable: true, required: ['EQT_NO'], optional: ['WRKR_ID', 'SO_ID', 'LOSS_REASON', 'REG_UID'] },
    { path: '/customer/equipment/setEquipmentChkStndByY.req', name: '장비상태변경(검사대기)', tab: '장비할당/반납처리', feature: '검사대기 → 사용가능 상태 변경', status: 'incomplete', testable: true, required: ['EQT_NO', 'WRKR_ID'], optional: ['SO_ID', 'REG_UID'] },

    // 2. 장비상태조회 (2개)
    { path: '/statistics/equipment/getEquipmentHistoryInfo.req', name: '장비이력조회', tab: '장비상태조회', feature: 'S/N으로 장비 현재상태 조회', status: 'incomplete', testable: true, required: ['EQT_NO'], optional: ['WRKR_ID', 'SO_ID', 'SERIAL_NO'] },
    { path: '/customer/equipment/changeEqtWrkr_3.req', name: '장비기사이관', tab: '장비상태조회', feature: '다른 기사 장비를 내가 인수', status: 'incomplete', testable: true, required: ['EQT_NO', 'TO_WRKR_ID'], optional: ['FROM_WRKR_ID', 'CTRT_ID', 'SO_ID', 'CRR_ID', 'REG_UID'] },

    // 3. 기사간 장비이동 (2개)
    { path: '/system/cm/getFindUsrList3.req', name: '타기사조회', tab: '기사간 장비이동', feature: '기사 정보 조회', status: 'completed', testable: true, required: ['USR_NM'], optional: ['WRKR_ID', 'SO_ID', 'SEARCH_TEXT', 'SEARCH_TYPE'] },
    { path: '/customer/sigtrans/saveENSSendHist.req', name: '타기사문자발송', tab: '기사간 장비이동', feature: '장비이관 문자 발송', status: 'incomplete', testable: true, required: ['EQT_NO', 'TO_WRKR_ID', 'FROM_WRKR_ID'], optional: ['DEST_PHONE', 'MESSAGE', 'REG_UID', 'WRKR_ID', 'SO_ID'] },

    // 4. 미회수 장비 회수처리 (2개) - WorkmanAssignDelegate.java
    { path: '/customer/work/getEquipLossInfo.req', name: '미회수장비조회', tab: '미회수 장비 회수처리', feature: '미회수 장비 리스트 조회', status: 'completed', testable: true, required: [], optional: ['WRKR_ID', 'EQT_NO', 'SO_ID', 'START_DATE', 'END_DATE'] },
    { path: '/customer/work/modEquipLoss.req', name: '미회수장비회수처리', tab: '미회수 장비 회수처리', feature: '미회수 장비 회수', status: 'incomplete', testable: true, required: ['EQT_NO', 'STATE'], optional: ['MEMO', 'WRKR_ID', 'SO_ID', 'RECOVERY_STATUS', 'REG_UID'] },
  ];

  // API별 테스트 케이스 생성
  const generateTestCases = (api: ApiInfo): TestCase[] => {
    const cases: TestCase[] = [];

    // Case 1: 필수값만 (실제 데이터 사용)
    const requiredOnlyPayload: Record<string, any> = {};
    api.required.forEach(key => {
      if (key === 'WRKR_ID' || key === 'TO_WRKR_ID' || key === 'FROM_WRKR_ID') requiredOnlyPayload[key] = '20230019';  // 이진영
      else if (key === 'SO_ID') requiredOnlyPayload[key] = 'SO-001';
      else if (key === 'EQT_NO') requiredOnlyPayload[key] = 'EQT001';  // 케이블모뎀 001ADE73A6F0
      else if (key === 'CARRIER_ID' || key === 'CRR_ID') requiredOnlyPayload[key] = 'CRR-001';
      else if (key === 'USR_NM') requiredOnlyPayload[key] = '이진영';
      else if (key === 'STATE') requiredOnlyPayload[key] = 'RECOVERED';
      else requiredOnlyPayload[key] = 'TEST_VALUE';
    });

    if (api.required.length > 0) {
      cases.push({
        name: '필수값만',
        description: `필수 파라미터만 전송 (${api.required.join(', ')})`,
        payload: requiredOnlyPayload
      });
    }

    // Case 2: 필수값 + 선택값 전부 (실제 데이터 사용)
    const allPayload: Record<string, any> = { ...requiredOnlyPayload };
    api.optional.forEach(key => {
      if (key === 'WRKR_ID' || key === 'FROM_WRKR_ID') allPayload[key] = '20230019';  // 이진영
      else if (key === 'SO_ID') allPayload[key] = 'SO-001';
      else if (key === 'OUT_DATE' || key === 'START_DATE') allPayload[key] = '2024-12-01';
      else if (key === 'END_DATE') allPayload[key] = '2024-12-31';
      else if (key === 'CARRIER_ID') allPayload[key] = 'CRR-001';
      else if (key === 'EQT_STATUS') allPayload[key] = 'Assigned';
      else if (key === 'SEARCH_TEXT') allPayload[key] = '이진';
      else if (key === 'SEARCH_TYPE') allPayload[key] = 'NAME';
      else if (key === 'MESSAGE') allPayload[key] = '장비 이관 알림';
      else if (key === 'MEMO') allPayload[key] = '테스트 메모';
      else if (key === 'RETURN_REASON') allPayload[key] = '장비 교체';
      else if (key === 'LOSS_REASON') allPayload[key] = '분실';
      else allPayload[key] = 'OPT_VALUE';
    });

    cases.push({
      name: '전체값',
      description: `필수 + 선택 파라미터 전부 전송`,
      payload: allPayload
    });

    return cases;
  };

  // 단일 API 단일 테스트 케이스 실행
  const testApiWithCase = async (api: ApiInfo, testCase: TestCase): Promise<TestResult> => {
    try {
      const url = `/api${api.path}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.payload),
      });

      const data = await response.json();

      return {
        apiPath: api.path,
        apiName: api.name,
        testCase: testCase.name,
        status: response.ok ? 'success' : 'error',
        statusCode: response.status,
        request: testCase.payload,
        response: data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        apiPath: api.path,
        apiName: api.name,
        testCase: testCase.name,
        status: 'error',
        request: testCase.payload,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  };

  // 전체 API 전체 테스트 케이스 실행
  const testAllApis = async () => {
    setIsTestingAll(true);
    setTestResults([]);
    setCurrentTestIndex(0);
    setCurrentTestCase(0);

    const allResults: TestResult[] = [];

    for (let i = 0; i < equipmentApis.length; i++) {
      const api = equipmentApis[i];
      setCurrentTestIndex(i + 1);

      const testCases = generateTestCases(api);

      for (let j = 0; j < testCases.length; j++) {
        setCurrentTestCase(j + 1);
        const result = await testApiWithCase(api, testCases[j]);
        allResults.push(result);
        setTestResults([...allResults]);

        // API 부하 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setIsTestingAll(false);
    setCurrentTestIndex(0);
    setCurrentTestCase(0);
  };

  // JSON 다운로드 - API별로 Request/Response 정리
  const downloadResults = () => {
    const successResults = testResults.filter(r => r.status === 'success');
    const errorResults = testResults.filter(r => r.status === 'error');

    // API별로 그룹화
    const apiGroups: Record<string, any> = {};

    testResults.forEach(result => {
      if (!apiGroups[result.apiPath]) {
        const apiInfo = equipmentApis.find(api => api.path === result.apiPath);
        apiGroups[result.apiPath] = {
          apiName: result.apiName,
          apiPath: result.apiPath,
          category: apiInfo?.tab || 'Unknown',
          feature: apiInfo?.feature || '',
          status: apiInfo?.status || 'unknown',
          testCases: []
        };
      }

      apiGroups[result.apiPath].testCases.push({
        testCase: result.testCase,
        status: result.status,
        statusCode: result.statusCode,
        request: result.request,
        response: result.response,
        error: result.error,
        timestamp: result.timestamp
      });
    });

    const downloadData = {
      summary: {
        totalTests: testResults.length,
        successCount: successResults.length,
        errorCount: errorResults.length,
        successRate: testResults.length > 0 ? ((successResults.length / testResults.length) * 100).toFixed(2) + '%' : '0%',
        totalAPIs: equipmentApis.length,
        completedAPIs: equipmentApis.filter(api => api.status === 'completed').length,
        incompleteAPIs: equipmentApis.filter(api => api.status === 'incomplete').length,
        timestamp: new Date().toISOString(),
      },
      apiDetails: Object.values(apiGroups),
      successfulTests: successResults,
      failedTests: errorResults,
    };

    const blob = new Blob([JSON.stringify(downloadData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipment-api-test-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 통계
  const completedCount = equipmentApis.filter(api => api.status === 'completed').length;
  const incompleteCount = equipmentApis.filter(api => api.status === 'incomplete').length;
  const successCount = testResults.filter(r => r.status === 'success').length;
  const errorCount = testResults.filter(r => r.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">장비관리 API 구현 현황</h1>
          <p className="text-gray-600 mb-4">
            15개 API 중 5개 검증 완료 | 4개 카테고리: 장비할당/반납처리(9개), 장비상태조회(2개), 기사간 장비이동(2개), 미회수 장비 회수처리(2개)
          </p>

          {/* 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-gray-900">{equipmentApis.length}</div>
              <div className="text-sm text-gray-600">총 API</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              <div className="text-sm text-gray-600">구현 완료</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">{incompleteCount}</div>
              <div className="text-sm text-gray-600">미구현</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{successCount}</div>
              <div className="text-sm text-gray-600">테스트 성공</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <div className="text-2xl font-bold text-orange-600">{errorCount}</div>
              <div className="text-sm text-gray-600">테스트 실패</div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={testAllApis}
              disabled={isTestingAll}
              className="bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isTestingAll ? (
                <>
                  <Play className="animate-pulse" size={20} />
                  테스트 중... API {currentTestIndex}/{equipmentApis.length}, Case {currentTestCase}/2
                </>
              ) : (
                <>
                  <Play size={20} />
                  구현 완료 API 테스트 (5개 × 2케이스 = 10 테스트)
                </>
              )}
            </button>
            <button
              onClick={downloadResults}
              disabled={testResults.length === 0}
              className="bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Download size={20} />
              JSON 결과 다운로드 ({testResults.length}건)
            </button>
          </div>
        </div>

        {/* 테스트 결과 */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              테스트 결과 상세 (Request/Response 확인 가능)
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {testResults.map((result, index) => {
                const isExpanded = expandedResults.has(index);
                return (
                  <div
                    key={index}
                    className={`rounded border ${result.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                  >
                    <div
                      className="p-3 cursor-pointer hover:opacity-80"
                      onClick={() => {
                        const newExpanded = new Set(expandedResults);
                        if (isExpanded) {
                          newExpanded.delete(index);
                        } else {
                          newExpanded.add(index);
                        }
                        setExpandedResults(newExpanded);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 flex items-center gap-2">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          <span className="font-medium">{result.apiName}</span>
                          <span className="text-sm text-gray-600">({result.testCase})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${result.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {result.statusCode || result.error}
                          </span>
                          {result.status === 'success' ? (
                            <CheckCircle2 size={16} className="text-green-600" />
                          ) : (
                            <XCircle size={16} className="text-red-600" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Request/Response 상세 정보 */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-gray-200 pt-3">
                        {/* API Path */}
                        <div>
                          <div className="text-xs font-semibold text-gray-700 mb-1">API Path:</div>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded block">{result.apiPath}</code>
                        </div>

                        {/* Request */}
                        <div>
                          <div className="text-xs font-semibold text-blue-700 mb-1">Request:</div>
                          <pre className="text-xs bg-blue-50 p-2 rounded overflow-x-auto border border-blue-200">
                            {JSON.stringify(result.request, null, 2)}
                          </pre>
                        </div>

                        {/* Response */}
                        <div>
                          <div className="text-xs font-semibold text-purple-700 mb-1">Response:</div>
                          <pre className="text-xs bg-purple-50 p-2 rounded overflow-x-auto border border-purple-200 max-h-60 overflow-y-auto">
                            {result.response ? JSON.stringify(result.response, null, 2) : result.error || 'No response'}
                          </pre>
                        </div>

                        {/* Timestamp */}
                        <div className="text-xs text-gray-500">
                          <span className="font-semibold">Timestamp:</span> {new Date(result.timestamp).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* API 파라미터 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">API 파라미터 정보</h2>
          <div className="space-y-4">
            {equipmentApis.map((api, index) => (
              <div key={api.path} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  {api.status === 'completed' ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : (
                    <XCircle size={20} className="text-red-600" />
                  )}
                  <span className="font-bold">{index + 1}. {api.name}</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {api.tab}
                  </span>
                </div>
                <div className="text-sm text-gray-700 mb-2">{api.feature}</div>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded block mb-2">{api.path}</code>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium text-red-600">필수: </span>
                    {api.required.length > 0 ? api.required.join(', ') : '없음'}
                  </div>
                  <div>
                    <span className="font-medium text-blue-600">선택: </span>
                    {api.optional.length > 0 ? api.optional.join(', ') : '없음'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentApiStatus;
