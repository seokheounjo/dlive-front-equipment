/**
 * API 디버그 대시보드
 * - 원클릭 전체 API 상태 체크
 * - 실시간 로그 뷰어
 * - 파라미터 탐색기
 * - 결과 다운로드
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  runFullApiCheck,
  getApiLogs,
  clearApiLogs,
  discoverApiParameters,
  downloadApiCheckResult,
  EQUIPMENT_TEST_CASES,
  PARAMETER_VARIATIONS,
  type ApiLog,
  type FullApiCheckResult,
  type ApiDiscoveryResult
} from '../../services/apiDebugger';

const API_BASE = '/api';

// ============ 메인 대시보드 ============

const ApiDebugDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'check' | 'logs' | 'discover' | 'manual'>('check');
  const [isRunning, setIsRunning] = useState(false);
  const [checkResult, setCheckResult] = useState<FullApiCheckResult | null>(null);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [discoveryResults, setDiscoveryResults] = useState<ApiDiscoveryResult[]>([]);

  // 로그 실시간 업데이트
  useEffect(() => {
    const handleLogAdded = () => {
      setLogs([...getApiLogs()]);
    };

    window.addEventListener('api-log-added', handleLogAdded);
    setLogs(getApiLogs());

    return () => {
      window.removeEventListener('api-log-added', handleLogAdded);
    };
  }, []);

  // 전체 API 점검 실행
  const handleRunFullCheck = async () => {
    setIsRunning(true);
    setCheckResult(null);

    try {
      const result = await runFullApiCheck(API_BASE);
      setCheckResult(result);
    } catch (e) {
      console.error('전체 점검 실패:', e);
    } finally {
      setIsRunning(false);
    }
  };

  // 파라미터 탐색 실행
  const handleDiscoverParams = async (apiUrl: string) => {
    const baseParams = EQUIPMENT_TEST_CASES.find(tc => tc.api === apiUrl)?.params || {};
    const variations = PARAMETER_VARIATIONS[apiUrl] || [];

    if (variations.length === 0) {
      alert('이 API에 대한 파라미터 변형이 정의되지 않았습니다.');
      return;
    }

    setIsRunning(true);

    try {
      const result = await discoverApiParameters(apiUrl, baseParams, variations, API_BASE);
      setDiscoveryResults(prev => [...prev, result]);
    } catch (e) {
      console.error('파라미터 탐색 실패:', e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          🔧 API 디버그 대시보드
        </h2>
        <p className="text-sm opacity-80 mt-1">
          원클릭으로 모든 API 상태를 확인하고 파라미터를 탐색합니다
        </p>
      </div>

      {/* 탭 */}
      <div className="flex border-b bg-gray-50">
        {[
          { id: 'check', label: '🚀 전체 점검', icon: '🚀' },
          { id: 'logs', label: '📋 실시간 로그', icon: '📋' },
          { id: 'discover', label: '🔍 파라미터 탐색', icon: '🔍' },
          { id: 'manual', label: '🛠️ 수동 테스트', icon: '🛠️' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div className="p-4">
        {activeTab === 'check' && (
          <FullCheckTab
            isRunning={isRunning}
            result={checkResult}
            onRun={handleRunFullCheck}
          />
        )}
        {activeTab === 'logs' && (
          <LogViewerTab logs={logs} onClear={() => { clearApiLogs(); setLogs([]); }} />
        )}
        {activeTab === 'discover' && (
          <DiscoverTab
            isRunning={isRunning}
            results={discoveryResults}
            onDiscover={handleDiscoverParams}
          />
        )}
        {activeTab === 'manual' && (
          <ManualTestTab />
        )}
      </div>
    </div>
  );
};

// ============ 전체 점검 탭 ============

const FullCheckTab: React.FC<{
  isRunning: boolean;
  result: FullApiCheckResult | null;
  onRun: () => void;
}> = ({ isRunning, result, onRun }) => {
  return (
    <div>
      {/* 실행 버튼 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`px-6 py-3 rounded-lg font-bold text-white transition-all ${
            isRunning
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
          }`}
        >
          {isRunning ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span> 점검 중...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              🚀 원클릭 전체 API 점검
            </span>
          )}
        </button>

        {result && (
          <button
            onClick={() => downloadApiCheckResult(result)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            📥 결과 다운로드
          </button>
        )}
      </div>

      {/* API 목록 */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-700 mb-2">테스트 대상 API ({EQUIPMENT_TEST_CASES.length}개)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {EQUIPMENT_TEST_CASES.map((tc, idx) => (
            <div key={idx} className="bg-gray-50 p-2 rounded text-gray-600">
              {idx + 1}. {tc.name}
            </div>
          ))}
        </div>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div>
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-blue-600">{result.totalApis}</div>
              <div className="text-sm text-gray-600">총 API</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-green-600">{result.successCount}</div>
              <div className="text-sm text-gray-600">성공</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-red-600">{result.failCount}</div>
              <div className="text-sm text-gray-600">실패</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-yellow-600">{result.timeoutCount}</div>
              <div className="text-sm text-gray-600">타임아웃</div>
            </div>
          </div>

          {/* 상세 결과 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">상태</th>
                  <th className="p-2 text-left">API명</th>
                  <th className="p-2 text-left">엔드포인트</th>
                  <th className="p-2 text-left">응답시간</th>
                  <th className="p-2 text-left">응답 필드</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, idx) => (
                  <tr key={idx} className={`border-b ${
                    r.status === 'success' ? 'bg-green-50' :
                    r.status === 'error' ? 'bg-red-50' : 'bg-yellow-50'
                  }`}>
                    <td className="p-2">
                      {r.status === 'success' ? '✅' : r.status === 'error' ? '❌' : '⏱️'}
                    </td>
                    <td className="p-2 font-medium">{r.name}</td>
                    <td className="p-2 text-gray-600 text-xs">{r.api}</td>
                    <td className="p-2">{r.duration}ms</td>
                    <td className="p-2 text-xs text-gray-500">
                      {r.responseFields?.slice(0, 5).join(', ')}
                      {(r.responseFields?.length || 0) > 5 && '...'}
                      {r.error && <span className="text-red-500">{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 로그 뷰어 탭 ============

const LogViewerTab: React.FC<{
  logs: ApiLog[];
  onClear: () => void;
}> = ({ logs, onClear }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'success') return log.status === 'success';
    return log.status === 'error' || log.status === 'timeout';
  });

  return (
    <div>
      {/* 필터 및 컨트롤 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['all', 'success', 'error'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${
                filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? '전체' : f === 'success' ? '✅ 성공' : '❌ 실패'}
              {' '}
              ({logs.filter(l => f === 'all' ? true : f === 'success' ? l.status === 'success' : l.status !== 'success').length})
            </button>
          ))}
        </div>
        <button
          onClick={onClear}
          className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200"
        >
          🗑️ 로그 초기화
        </button>
      </div>

      {/* 로그 목록 */}
      <div
        ref={logContainerRef}
        className="bg-gray-900 rounded-lg p-4 max-h-[600px] overflow-y-auto font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            로그가 없습니다. API를 호출하면 여기에 표시됩니다.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              className={`mb-2 p-2 rounded cursor-pointer transition-colors ${
                log.status === 'success' ? 'bg-green-900/30 hover:bg-green-900/50' :
                log.status === 'error' ? 'bg-red-900/30 hover:bg-red-900/50' :
                'bg-yellow-900/30 hover:bg-yellow-900/50'
              }`}
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              {/* 로그 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⏱️'}</span>
                  <span className="text-blue-400">[{log.method}]</span>
                  <span className="text-white">{log.api}</span>
                  <span className="text-gray-400">({log.duration}ms)</span>
                </div>
                <span className="text-gray-500 text-xs">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* 확장 상세 */}
              {expandedId === log.id && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <div className="mb-2">
                    <span className="text-blue-400">📤 Request:</span>
                    <pre className="text-green-300 text-xs mt-1 overflow-x-auto">
                      {JSON.stringify(log.request, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className={log.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                      📥 Response:
                    </span>
                    <pre className={`text-xs mt-1 overflow-x-auto ${
                      log.status === 'success' ? 'text-green-300' : 'text-red-300'
                    }`}>
                      {log.error || JSON.stringify(log.response, null, 2).slice(0, 1000)}
                      {JSON.stringify(log.response)?.length > 1000 && '... (truncated)'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============ 파라미터 탐색 탭 ============

const DiscoverTab: React.FC<{
  isRunning: boolean;
  results: ApiDiscoveryResult[];
  onDiscover: (apiUrl: string) => void;
}> = ({ isRunning, results, onDiscover }) => {
  const apisWithVariations = Object.keys(PARAMETER_VARIATIONS);

  return (
    <div>
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <p className="text-sm text-yellow-700">
          <strong>🔍 파라미터 탐색기</strong><br />
          암호화되거나 문서화되지 않은 파라미터 값을 자동으로 찾습니다.<br />
          여러 값 조합을 시도하여 작동하는 파라미터를 발견합니다.
        </p>
      </div>

      {/* 탐색 가능한 API 목록 */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-700 mb-2">탐색 가능한 API</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {apisWithVariations.map(api => {
            const variations = PARAMETER_VARIATIONS[api];
            return (
              <div key={api} className="bg-gray-50 p-3 rounded-lg">
                <div className="font-medium text-sm mb-1">{api}</div>
                <div className="text-xs text-gray-500 mb-2">
                  {variations.map(v => v.param).join(', ')} 파라미터 탐색
                </div>
                <button
                  onClick={() => onDiscover(api)}
                  disabled={isRunning}
                  className={`px-3 py-1 text-xs rounded ${
                    isRunning
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  }`}
                >
                  {isRunning ? '탐색 중...' : '🔍 탐색 시작'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 탐색 결과 */}
      {results.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-700 mb-2">탐색 결과</h3>
          {results.map((result, idx) => (
            <div key={idx} className="bg-white border rounded-lg p-4 mb-4">
              <h4 className="font-bold text-blue-600 mb-2">{result.api}</h4>

              {/* 작동하는 파라미터 */}
              <div className="mb-3">
                <span className="text-green-600 font-medium">✅ 작동하는 조합 ({result.workingParams.length}개)</span>
                <div className="mt-1 space-y-1">
                  {result.workingParams.slice(0, 5).map((p, i) => (
                    <div key={i} className="text-xs bg-green-50 p-2 rounded">
                      <code>{JSON.stringify(p)}</code>
                    </div>
                  ))}
                  {result.workingParams.length > 5 && (
                    <div className="text-xs text-gray-500">
                      +{result.workingParams.length - 5}개 더...
                    </div>
                  )}
                </div>
              </div>

              {/* 발견된 필드 */}
              <div className="mb-3">
                <span className="text-blue-600 font-medium">📋 발견된 응답 필드</span>
                <div className="text-xs text-gray-600 mt-1">
                  {result.discoveredFields.join(', ')}
                </div>
              </div>

              {/* 메모 */}
              <div>
                <span className="text-purple-600 font-medium">📝 메모</span>
                <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                  {result.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ 수동 테스트 탭 ============

const ManualTestTab: React.FC = () => {
  const [selectedApi, setSelectedApi] = useState(EQUIPMENT_TEST_CASES[0]?.api || '');
  const [params, setParams] = useState('{}');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API 선택 시 기본 파라미터 설정
  useEffect(() => {
    const testCase = EQUIPMENT_TEST_CASES.find(tc => tc.api === selectedApi);
    if (testCase) {
      setParams(JSON.stringify(testCase.params, null, 2));
    }
  }, [selectedApi]);

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const parsedParams = JSON.parse(params);

      const response = await fetch(API_BASE + selectedApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedParams),
        credentials: 'include'
      });

      const data = await response.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 입력 영역 */}
      <div>
        <h3 className="font-bold text-gray-700 mb-2">API 선택</h3>
        <select
          value={selectedApi}
          onChange={e => setSelectedApi(e.target.value)}
          className="w-full p-2 border rounded-lg mb-4"
        >
          {EQUIPMENT_TEST_CASES.map(tc => (
            <option key={tc.api} value={tc.api}>
              {tc.name} - {tc.api}
            </option>
          ))}
        </select>

        <h3 className="font-bold text-gray-700 mb-2">파라미터 (JSON)</h3>
        <textarea
          value={params}
          onChange={e => setParams(e.target.value)}
          className="w-full h-48 p-2 border rounded-lg font-mono text-sm"
          placeholder='{"WRKR_ID": "20230019"}'
        />

        <button
          onClick={handleTest}
          disabled={isLoading}
          className={`w-full mt-4 py-2 rounded-lg font-bold text-white ${
            isLoading
              ? 'bg-gray-400'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isLoading ? '테스트 중...' : '🚀 API 테스트'}
        </button>
      </div>

      {/* 결과 영역 */}
      <div>
        <h3 className="font-bold text-gray-700 mb-2">응답 결과</h3>
        <div className="bg-gray-900 rounded-lg p-4 h-80 overflow-auto">
          {error ? (
            <pre className="text-red-400 text-sm">{error}</pre>
          ) : result ? (
            <pre className="text-green-300 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <div className="text-gray-500 text-center py-8">
              테스트 결과가 여기에 표시됩니다
            </div>
          )}
        </div>

        {/* 응답 필드 분석 */}
        {result && !error && (
          <div className="mt-4 bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-blue-700 mb-1">📋 응답 분석</h4>
            <div className="text-sm text-gray-600">
              {Array.isArray(result) ? (
                <>
                  <div>타입: Array[{result.length}]</div>
                  {result.length > 0 && (
                    <div>필드: {Object.keys(result[0]).join(', ')}</div>
                  )}
                </>
              ) : typeof result === 'object' ? (
                <div>필드: {Object.keys(result).join(', ')}</div>
              ) : (
                <div>타입: {typeof result}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiDebugDashboard;
