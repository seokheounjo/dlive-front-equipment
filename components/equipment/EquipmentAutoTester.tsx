import React, { useState } from 'react';
import { Play, Download, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface TestCase {
  caseId: string;
  description: string;
  params: Record<string, any>;
  expectedStatus: string;
}

interface API {
  id: string;
  name: string;
  path: string;
  method: string;
  priority: string;
  testCases: TestCase[];
}

interface TestResult {
  caseId: string;
  apiId: string;
  apiName: string;
  path: string;
  params: Record<string, any>;
  response: any;
  error: string | null;
  duration: number;
  status: 'success' | 'error' | 'pending';
  expectedStatus: string;
  actualStatus: string;
  passed: boolean;
}

const EquipmentAutoTester: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testApis, setTestApis] = useState<API[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');

  // 테스트 케이스 로드
  const loadTestCases = async () => {
    try {
      const response = await fetch('/equipment_test_cases.json');
      const data = await response.json();
      setTestApis(data.apis || []);
      return data.apis || [];
    } catch (error) {
      console.error('테스트 케이스 로드 실패:', error);
      return [];
    }
  };

  // 전체 자동 테스트 실행
  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setProgress(0);

    const apis = await loadTestCases();
    if (apis.length === 0) {
      alert('테스트 케이스를 로드할 수 없습니다.');
      setIsRunning(false);
      return;
    }

    // 우선순위 필터링
    let filteredApis = apis;
    if (selectedPriority !== 'ALL') {
      filteredApis = apis.filter((api: API) => api.priority === selectedPriority);
    }

    const allResults: TestResult[] = [];
    let completed = 0;
    let totalTests = 0;

    // 총 테스트 케이스 수 계산
    filteredApis.forEach((api: API) => {
      totalTests += api.testCases.length;
    });

    // 각 API별로 테스트 실행
    for (const api of filteredApis) {
      for (const testCase of api.testCases) {
        setCurrentTest(`${api.name} - ${testCase.description}`);

        const result = await runSingleTest(api, testCase);
        allResults.push(result);
        setTestResults([...allResults]);

        completed++;
        setProgress(Math.round((completed / totalTests) * 100));

        // API 부하 방지를 위한 딜레이 (500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);
    setCurrentTest('');

    // 자동 다운로드
    downloadResults(allResults);
  };

  // 단일 테스트 실행
  const runSingleTest = async (api: API, testCase: TestCase): Promise<TestResult> => {
    const startTime = performance.now();
    let result: TestResult = {
      caseId: testCase.caseId,
      apiId: api.id,
      apiName: api.name,
      path: api.path,
      params: testCase.params,
      response: null,
      error: null,
      duration: 0,
      status: 'pending',
      expectedStatus: testCase.expectedStatus,
      actualStatus: '',
      passed: false,
    };

    try {
      const url = `/api${api.path}`;
      const fetchOptions: RequestInit = {
        method: api.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (api.method === 'POST') {
        fetchOptions.body = JSON.stringify(testCase.params);
      }

      const response = await fetch(url, fetchOptions);
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      result.response = data;
      result.duration = Math.round(duration);
      result.status = 'success';
      result.actualStatus = 'success';
      result.passed = testCase.expectedStatus === 'success';
    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      result.error = error.message;
      result.duration = Math.round(duration);
      result.status = 'error';
      result.actualStatus = 'error';
      result.passed = testCase.expectedStatus === 'error';
    }

    return result;
  };

  // 결과 다운로드
  const downloadResults = (results: TestResult[]) => {
    const summary = {
      테스트_일시: new Date().toISOString(),
      총_테스트_수: results.length,
      성공_수: results.filter(r => r.status === 'success').length,
      실패_수: results.filter(r => r.status === 'error').length,
      통과_수: results.filter(r => r.passed).length,
      실패_수_예상과_다름: results.filter(r => !r.passed).length,
      평균_응답시간_ms: Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length),
      결과: results,
    };

    const dataStr = JSON.stringify(summary, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `equipment-test-results-${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // 통계 계산
  const successCount = testResults.filter(r => r.status === 'success').length;
  const errorCount = testResults.filter(r => r.status === 'error').length;
  const passedCount = testResults.filter(r => r.passed).length;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">장비관리 API 전체 자동 테스트</h1>
          <p className="text-gray-600 mb-4">
            73개의 테스트 케이스를 자동으로 실행하고 결과를 다운로드합니다.
          </p>

          {/* 우선순위 필터 */}
          <div className="flex items-center gap-4 mb-4">
            <label className="font-medium">우선순위:</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              disabled={isRunning}
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="ALL">전체 (P0 + P1)</option>
              <option value="P0">P0 필수만 (9개 API, 68개 케이스)</option>
              <option value="P1">P1 중요만 (1개 API, 3개 케이스)</option>
            </select>
          </div>

          {/* 실행 버튼 */}
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                테스트 실행 중... ({progress}%)
              </>
            ) : (
              <>
                <Play size={20} />
                전체 테스트 시작
              </>
            )}
          </button>

          {/* 현재 진행 중인 테스트 */}
          {isRunning && currentTest && (
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <div className="text-sm text-blue-900 font-medium">현재 테스트 중:</div>
              <div className="text-sm text-blue-700">{currentTest}</div>
              <div className="mt-2 bg-blue-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* 통계 */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">테스트 결과 요약</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-gray-900">{testResults.length}</div>
                <div className="text-sm text-gray-600">총 테스트</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">{successCount}</div>
                <div className="text-sm text-gray-600">성공</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                <div className="text-sm text-gray-600">실패</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">{passedCount}</div>
                <div className="text-sm text-gray-600">예상대로 통과</div>
              </div>
            </div>

            {!isRunning && (
              <button
                onClick={() => downloadResults(testResults)}
                className="mt-4 w-full bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Download size={20} />
                결과 다운로드 (JSON)
              </button>
            )}
          </div>
        )}

        {/* 결과 목록 */}
        {testResults.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">상세 결과</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={result.caseId}
                  className={`p-3 rounded border-2 ${
                    result.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle2 size={20} className="text-green-600" />
                      ) : (
                        <XCircle size={20} className="text-red-600" />
                      )}
                      <span className="font-medium text-sm">
                        {index + 1}. {result.apiName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.passed ? (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          예상대로
                        </span>
                      ) : (
                        <AlertCircle size={16} className="text-orange-600" />
                      )}
                      <span className="text-xs text-gray-500">{result.duration}ms</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{result.path}</div>
                  <div className="text-xs text-gray-500 mt-1">{result.caseId}: {testResults.find(t => t.caseId === result.caseId)?.params && Object.keys(result.params).length > 0 ? `${Object.keys(result.params).length}개 파라미터` : '파라미터 없음'}</div>
                  {result.error && (
                    <div className="text-xs text-red-600 mt-1">에러: {result.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EquipmentAutoTester;
