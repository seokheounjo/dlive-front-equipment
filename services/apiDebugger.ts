/**
 * API 디버거 시스템
 * - 모든 API 호출 자동 로깅
 * - 파라미터 조합 자동 테스트
 * - 암호화된 파라미터 값 탐색
 * - 원클릭 전체 API 상태 체크
 */

// ============ 타입 정의 ============

export interface ApiLog {
  id: string;
  timestamp: string;
  api: string;
  method: string;
  request: any;
  response: any;
  status: 'success' | 'error' | 'timeout';
  duration: number;
  error?: string;
}

export interface ApiTestCase {
  name: string;
  api: string;
  method: 'GET' | 'POST';
  params: Record<string, any>;
  expectedFields?: string[];
  description: string;
}

export interface ParameterVariation {
  param: string;
  values: (string | number)[];
  description: string;
}

export interface ApiDiscoveryResult {
  api: string;
  workingParams: Record<string, any>[];
  failedParams: Record<string, any>[];
  discoveredFields: string[];
  notes: string[];
}

// ============ 글로벌 로그 스토리지 ============

const MAX_LOGS = 500;
let apiLogs: ApiLog[] = [];
let isDebugMode = true;

// 로그 저장
export const addApiLog = (log: Omit<ApiLog, 'id' | 'timestamp'>) => {
  const newLog: ApiLog = {
    ...log,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  apiLogs.unshift(newLog);

  // 최대 로그 수 유지
  if (apiLogs.length > MAX_LOGS) {
    apiLogs = apiLogs.slice(0, MAX_LOGS);
  }

  // 콘솔에 시각화
  if (isDebugMode) {
    printApiLog(newLog);
  }

  // 커스텀 이벤트 발생 (UI 업데이트용)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api-log-added', { detail: newLog }));
  }

  return newLog;
};

// 로그 조회
export const getApiLogs = () => [...apiLogs];
export const clearApiLogs = () => { apiLogs = []; };
export const setDebugMode = (enabled: boolean) => { isDebugMode = enabled; };

// ============ 콘솔 시각화 ============

const printApiLog = (log: ApiLog) => {
  const statusEmoji = {
    success: '✅',
    error: '❌',
    timeout: '⏱️'
  }[log.status];

  const statusColor = {
    success: 'color: #10B981',
    error: 'color: #EF4444',
    timeout: 'color: #F59E0B'
  }[log.status];

  console.group(
    `%c${statusEmoji} [${log.method}] ${log.api} (${log.duration}ms)`,
    `font-weight: bold; ${statusColor}`
  );

  console.log('%c📤 Request:', 'color: #3B82F6; font-weight: bold');
  console.table(log.request);

  if (log.status === 'success') {
    console.log('%c📥 Response:', 'color: #10B981; font-weight: bold');
    if (Array.isArray(log.response)) {
      console.log(`Array[${log.response.length}]`);
      if (log.response.length > 0) {
        console.log('First item fields:', Object.keys(log.response[0]));
        console.table(log.response.slice(0, 3));
      }
    } else if (typeof log.response === 'object') {
      console.table(log.response);
    } else {
      console.log(log.response);
    }
  } else {
    console.log('%c💥 Error:', 'color: #EF4444; font-weight: bold', log.error);
  }

  console.groupEnd();
};

// ============ API 테스트 케이스 정의 ============

export const EQUIPMENT_TEST_CASES: ApiTestCase[] = [
  // 그룹 1: 장비 할당/반납 (9개)
  {
    name: '기사할당장비조회',
    api: '/customer/equipment/getEquipmentOutList',
    method: 'POST',
    params: { WRKR_ID: '20230019' },
    expectedFields: ['EQT_NO', 'EQT_TYPE', 'SERIAL_NO', 'WRKR_ID'],
    description: '출고된 장비 목록 조회'
  },
  {
    name: '기사할당장비확인',
    api: '/customer/equipment/getEquipmentProcYnCheck',
    method: 'POST',
    params: { WRKR_ID: '20230019', SO_ID: 'SO001', EQT_NO: 'EQT001' },
    expectedFields: ['PROC_YN', 'EQT_NO'],
    description: '장비 처리 가능 여부 확인'
  },
  {
    name: '법인장비쿼터추가',
    api: '/customer/equipment/addCorporationEquipmentQuota',
    method: 'POST',
    params: { SO_ID: 'SO001', EQT_NO: 'EQT001', CARRIER_ID: 'CRR001', WRKR_ID: '20230019' },
    expectedFields: ['RESULT', 'MESSAGE'],
    description: '법인 장비 쿼터 추가 (입고처리)'
  },
  {
    name: '반납요청목록조회',
    api: '/customer/equipment/getEquipmentReturnRequestList',
    method: 'POST',
    params: { WRKR_ID: '20230019' },
    expectedFields: ['REQUEST_ID', 'EQT_NO', 'STATUS'],
    description: '반납 요청 목록'
  },
  {
    name: '반납요청확인',
    api: '/customer/equipment/getEquipmentReturnRequestCheck',
    method: 'POST',
    params: { WRKR_ID: '20230019', SO_ID: 'SO001', EQT_NO: 'EQT001' },
    expectedFields: ['RETURN_YN'],
    description: '특정 장비 반납 요청 존재 여부'
  },
  {
    name: '반납요청등록',
    api: '/customer/equipment/addEquipmentReturnRequest',
    method: 'POST',
    params: { EQT_NO: 'EQT001', WRKR_ID: '20230019' },
    expectedFields: ['RESULT', 'REQUEST_ID'],
    description: '새 반납 요청 등록'
  },
  {
    name: '작업자보유장비조회',
    api: '/customer/equipment/getWrkrHaveEqtList',
    method: 'POST',
    params: { WRKR_ID: '20230019' },
    expectedFields: ['EQT_NO', 'EQT_TYPE', 'SERIAL_NO', 'STATUS'],
    description: '기사 보유 장비 목록'
  },
  {
    name: '분실처리',
    api: '/customer/equipment/cmplEqtCustLossIndem',
    method: 'POST',
    params: { EQT_NO: 'EQT001' },
    expectedFields: ['RESULT', 'INDEM_AMOUNT'],
    description: '장비 분실 배상 처리'
  },
  {
    name: '장비상태변경(검사대기)',
    api: '/customer/equipment/setEquipmentChkStndByY',
    method: 'POST',
    params: { EQT_NO: 'EQT001', WRKR_ID: '20230019' },
    expectedFields: ['RESULT', 'NEW_STATUS'],
    description: '검사대기 상태로 변경'
  },

  // 그룹 2: 장비 상태 조회 (2개)
  {
    name: '장비이력조회',
    api: '/statistics/equipment/getEquipmentHistoryInfo',
    method: 'POST',
    params: { EQT_NO: 'EQT001' },
    expectedFields: ['HIST_ID', 'HIST_TYPE', 'HIST_DATE'],
    description: '장비 상태변화 이력'
  },
  {
    name: '장비기사이관',
    api: '/customer/equipment/changeEqtWrkr_3',
    method: 'POST',
    params: { EQT_NO: 'EQT001', TO_WRKR_ID: '20230020' },
    expectedFields: ['RESULT', 'TO_WRKR_NM'],
    description: '장비 다른 기사에게 이관'
  },

  // 그룹 3: 기사간 장비이동 (2개)
  {
    name: '타기사조회',
    api: '/system/cm/getFindUsrList3',
    method: 'POST',
    params: { USR_NM: '김' },
    expectedFields: ['USR_ID', 'USR_NM', 'MOBILE'],
    description: '기사명으로 검색'
  },
  {
    name: '타기사문자발송',
    api: '/customer/sigtrans/saveENSSendHist',
    method: 'POST',
    params: { EQT_NO: 'EQT001', TO_WRKR_ID: '20230020', FROM_WRKR_ID: '20230019' },
    expectedFields: ['RESULT', 'ENS_ID'],
    description: '이관 알림 문자 발송'
  },

  // 그룹 4: 미회수 장비 (2개)
  {
    name: '미회수장비조회',
    api: '/customer/work/getEquipLossInfo',
    method: 'POST',
    params: {},
    expectedFields: ['LOSS_ID', 'EQT_NO', 'STATE'],
    description: '미회수/분실 장비 목록'
  },
  {
    name: '미회수장비회수처리',
    api: '/customer/work/modEquipLoss',
    method: 'POST',
    params: { EQT_NO: 'EQT001', STATE: 'Recovered' },
    expectedFields: ['RESULT', 'NEW_STATE'],
    description: '미회수 장비 회수 처리'
  },

  // 그룹 5: 작업용 장비 (5개)
  {
    name: '작업장비정보조회',
    api: '/customer/work/getCustProdInfo',
    method: 'POST',
    params: { WRKR_ID: '20230019', EQT_SEL: '0', EQT_CL: 'ALL' },
    expectedFields: ['output1', 'output2', 'output3'],
    description: '작업 3단계용 장비 정보'
  },
  {
    name: '장비구성변경',
    api: '/customer/work/eqtCmpsInfoChg',
    method: 'POST',
    params: { WRK_ID: 'WRK001', parameters: [] },
    expectedFields: ['RESULT'],
    description: '작업완료 시 장비 구성 저장'
  },
  {
    name: '신호체크',
    api: '/customer/work/signalCheck',
    method: 'POST',
    params: { serialNo: 'TEST001', equipmentType: 'modem' },
    expectedFields: ['status', 'message'],
    description: '모뎀/STB 신호 체크'
  },
  {
    name: '상품별모델조회',
    api: '/customer/receipt/contract/getEquipmentNmListOfProd',
    method: 'POST',
    params: { PROD_CD: 'PROD001' },
    expectedFields: ['EQT_CL_CD', 'EQT_CL_NM'],
    description: '상품에 사용 가능한 장비 모델'
  },
  {
    name: '계약장비조회',
    api: '/customer/receipt/contract/getContractEqtList',
    method: 'POST',
    params: { CTRT_ID: 'CTRT001', PROD_CD: 'PROD001' },
    expectedFields: ['SVC_CMPS_ID', 'EQT_NO'],
    description: '계약에 포함된 장비'
  },
];

// ============ 파라미터 변형 탐색 ============

export const PARAMETER_VARIATIONS: Record<string, ParameterVariation[]> = {
  '/customer/equipment/getWrkrHaveEqtList': [
    {
      param: 'EQT_STAT_CD',
      values: ['10', '3', '20', '30', 'Assigned', 'Available', 'Lost'],
      description: '장비 상태 코드 (숫자 vs 문자열)'
    },
    {
      param: 'ITEM_MID_CD',
      values: ['04', '05', '07', '03', '4', '5', 'MODEM', 'STB'],
      description: '품목 중분류 (04:모뎀, 05:STB)'
    },
    {
      param: 'EQT_SEL',
      values: ['0', '1', 'Y', 'N', 'ALL'],
      description: '장비 선택 구분'
    },
    {
      param: 'EQT_CL',
      values: ['ALL', 'MODEM', 'STB', '04', '05'],
      description: '장비 분류'
    }
  ],
  '/customer/equipment/getEquipmentOutList': [
    {
      param: 'OUT_STAT',
      values: ['Y', 'N', '1', '0', 'OUT', 'IN'],
      description: '출고 상태'
    },
    {
      param: 'SEARCH_TYPE',
      values: ['1', '2', '3', 'A', 'B', 'ALL'],
      description: '검색 유형'
    }
  ],
  '/customer/work/getCustProdInfo': [
    {
      param: 'EQT_SEL',
      values: ['0', '1', '2', 'Y', 'N'],
      description: '장비 선택 모드'
    },
    {
      param: 'EQT_CL',
      values: ['ALL', '04', '05', 'MODEM', 'STB', '1', '2'],
      description: '장비 분류 필터'
    },
    {
      param: 'CRR_TSK_CL',
      values: ['01', '05', '07', '09', '11', '1', '5', '7', '9'],
      description: '작업 유형 (01:신규, 05:이전, 07:변경, 09:AS)'
    }
  ],
  '/system/cm/getFindUsrList3': [
    {
      param: 'SEARCH_TYPE',
      values: ['1', '2', '3', 'NM', 'ID', 'ALL'],
      description: '검색 유형'
    },
    {
      param: 'USR_TYPE',
      values: ['W', 'M', 'A', 'Worker', 'Manager', '1', '2'],
      description: '사용자 유형'
    }
  ]
};

// ============ API 자동 탐색기 ============

export const discoverApiParameters = async (
  apiUrl: string,
  baseParams: Record<string, any>,
  variations: ParameterVariation[],
  apiBase: string
): Promise<ApiDiscoveryResult> => {
  const result: ApiDiscoveryResult = {
    api: apiUrl,
    workingParams: [],
    failedParams: [],
    discoveredFields: [],
    notes: []
  };

  console.group(`%c🔍 파라미터 탐색: ${apiUrl}`, 'font-weight: bold; color: #8B5CF6');
  console.log('기본 파라미터:', baseParams);
  console.log('탐색할 변형:', variations.length, '개 파라미터');

  // 기본 파라미터로 먼저 테스트
  try {
    const baseResult = await testApiCall(apiBase + apiUrl, 'POST', baseParams);
    if (baseResult.success) {
      result.workingParams.push({ ...baseParams, _note: '기본 파라미터' });
      result.discoveredFields = baseResult.fields;
      result.notes.push('✅ 기본 파라미터 동작 확인');
    }
  } catch (e) {
    result.notes.push('❌ 기본 파라미터 실패');
  }

  // 각 파라미터 변형 테스트
  for (const variation of variations) {
    console.log(`\n테스트: ${variation.param} - ${variation.description}`);

    for (const value of variation.values) {
      const testParams = { ...baseParams, [variation.param]: value };

      try {
        const testResult = await testApiCall(apiBase + apiUrl, 'POST', testParams);

        if (testResult.success) {
          console.log(`  ✅ ${variation.param}=${value} → 성공 (${testResult.fields.length} fields)`);
          result.workingParams.push({
            ...testParams,
            _note: `${variation.param}=${value} 동작`
          });

          // 새로운 필드 발견 시 추가
          testResult.fields.forEach(field => {
            if (!result.discoveredFields.includes(field)) {
              result.discoveredFields.push(field);
              result.notes.push(`🆕 새 필드 발견: ${field} (${variation.param}=${value})`);
            }
          });
        } else {
          console.log(`  ❌ ${variation.param}=${value} → 실패`);
          result.failedParams.push({ ...testParams, _error: testResult.error });
        }
      } catch (e) {
        console.log(`  ⚠️ ${variation.param}=${value} → 예외`);
      }

      // 과부하 방지
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.groupEnd();
  return result;
};

// 단일 API 호출 테스트
const testApiCall = async (
  url: string,
  method: string,
  params: Record<string, any>
): Promise<{ success: boolean; fields: string[]; error?: string }> => {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      credentials: 'include'
    });

    if (!response.ok) {
      return { success: false, fields: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // 응답 구조 분석
    let fields: string[] = [];
    if (Array.isArray(data) && data.length > 0) {
      fields = Object.keys(data[0]);
    } else if (typeof data === 'object' && data !== null) {
      fields = Object.keys(data);
    }

    // 에러 응답 체크
    if (data.code === 'ERROR' || data.error || data.RESULT === 'FAIL') {
      return { success: false, fields, error: data.message || data.error };
    }

    return { success: true, fields };
  } catch (e: any) {
    return { success: false, fields: [], error: e.message };
  }
};

// ============ 원클릭 전체 API 상태 체크 ============

export interface FullApiCheckResult {
  timestamp: string;
  totalApis: number;
  successCount: number;
  failCount: number;
  timeoutCount: number;
  results: {
    name: string;
    api: string;
    status: 'success' | 'error' | 'timeout';
    duration: number;
    responseFields?: string[];
    error?: string;
  }[];
  summary: string;
}

export const runFullApiCheck = async (
  apiBase: string,
  testCases: ApiTestCase[] = EQUIPMENT_TEST_CASES,
  timeout: number = 10000
): Promise<FullApiCheckResult> => {
  const startTime = Date.now();

  console.clear();
  console.log('%c🚀 D\'Live 장비관리 API 전체 점검 시작', 'font-size: 20px; font-weight: bold; color: #3B82F6');
  console.log(`시작 시간: ${new Date().toLocaleString()}`);
  console.log(`API Base: ${apiBase}`);
  console.log(`테스트 케이스: ${testCases.length}개`);
  console.log('─'.repeat(60));

  const results: FullApiCheckResult['results'] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const progress = `[${i + 1}/${testCases.length}]`;

    console.log(`\n${progress} 테스트: ${tc.name}`);
    console.log(`  API: ${tc.api}`);
    console.log(`  Params:`, tc.params);

    const callStart = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(apiBase + tc.api, {
        method: tc.method,
        headers: { 'Content-Type': 'application/json' },
        body: tc.method === 'POST' ? JSON.stringify(tc.params) : undefined,
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - callStart;

      if (!response.ok) {
        console.log(`  ❌ HTTP Error: ${response.status}`);
        results.push({
          name: tc.name,
          api: tc.api,
          status: 'error',
          duration,
          error: `HTTP ${response.status}`
        });
        continue;
      }

      const data = await response.json();

      // 응답 필드 추출
      let responseFields: string[] = [];
      if (Array.isArray(data) && data.length > 0) {
        responseFields = Object.keys(data[0]);
        console.log(`  ✅ 성공 (${duration}ms) - Array[${data.length}]`);
        console.log(`  📋 필드: ${responseFields.join(', ')}`);
      } else if (data.output1 || data.output2) {
        responseFields = Object.keys(data);
        console.log(`  ✅ 성공 (${duration}ms) - Multi-output`);
        Object.keys(data).forEach(key => {
          if (Array.isArray(data[key])) {
            console.log(`    ${key}: Array[${data[key].length}]`);
          }
        });
      } else if (typeof data === 'object') {
        responseFields = Object.keys(data);
        console.log(`  ✅ 성공 (${duration}ms)`);
        console.log(`  📋 필드: ${responseFields.join(', ')}`);
      }

      // 예상 필드 확인
      if (tc.expectedFields) {
        const missing = tc.expectedFields.filter(f => !responseFields.includes(f));
        if (missing.length > 0) {
          console.log(`  ⚠️ 예상 필드 누락: ${missing.join(', ')}`);
        }
      }

      results.push({
        name: tc.name,
        api: tc.api,
        status: 'success',
        duration,
        responseFields
      });

    } catch (e: any) {
      const duration = Date.now() - callStart;

      if (e.name === 'AbortError') {
        console.log(`  ⏱️ 타임아웃 (${timeout}ms)`);
        results.push({
          name: tc.name,
          api: tc.api,
          status: 'timeout',
          duration,
          error: 'Timeout'
        });
      } else {
        console.log(`  ❌ 에러: ${e.message}`);
        results.push({
          name: tc.name,
          api: tc.api,
          status: 'error',
          duration,
          error: e.message
        });
      }
    }

    // 과부하 방지
    await new Promise(r => setTimeout(r, 200));
  }

  // 최종 결과 집계
  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'error').length;
  const timeoutCount = results.filter(r => r.status === 'timeout').length;
  const totalDuration = Date.now() - startTime;

  // 요약 출력
  console.log('\n' + '═'.repeat(60));
  console.log('%c📊 전체 점검 결과', 'font-size: 16px; font-weight: bold');
  console.log('─'.repeat(60));
  console.log(`총 API: ${testCases.length}개`);
  console.log(`%c✅ 성공: ${successCount}개`, 'color: #10B981');
  console.log(`%c❌ 실패: ${failCount}개`, 'color: #EF4444');
  console.log(`%c⏱️ 타임아웃: ${timeoutCount}개`, 'color: #F59E0B');
  console.log(`총 소요시간: ${(totalDuration / 1000).toFixed(1)}초`);
  console.log('═'.repeat(60));

  // 실패 API 목록
  if (failCount > 0 || timeoutCount > 0) {
    console.log('\n%c⚠️ 문제 있는 API:', 'font-weight: bold; color: #F59E0B');
    results.filter(r => r.status !== 'success').forEach(r => {
      console.log(`  - ${r.name}: ${r.error || r.status}`);
    });
  }

  // 성공 API의 발견된 필드 요약
  console.log('\n%c📋 발견된 응답 필드:', 'font-weight: bold; color: #3B82F6');
  results.filter(r => r.status === 'success' && r.responseFields).forEach(r => {
    console.log(`  ${r.name}: ${r.responseFields?.join(', ')}`);
  });

  const fullResult: FullApiCheckResult = {
    timestamp: new Date().toISOString(),
    totalApis: testCases.length,
    successCount,
    failCount,
    timeoutCount,
    results,
    summary: `${successCount}/${testCases.length} APIs working (${failCount} failed, ${timeoutCount} timeout)`
  };

  // 글로벌 저장 (디버그용)
  if (typeof window !== 'undefined') {
    (window as any).__lastApiCheck = fullResult;
    console.log('\n💡 결과 접근: window.__lastApiCheck');
  }

  return fullResult;
};

// ============ 유틸리티 함수 ============

// API 호출 래퍼 (자동 로깅 포함)
export const apiCallWithLogging = async <T>(
  api: string,
  method: 'GET' | 'POST',
  params: Record<string, any>,
  apiBase: string
): Promise<T> => {
  const startTime = Date.now();

  try {
    const response = await fetch(apiBase + api, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(params) : undefined,
      credentials: 'include'
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    addApiLog({
      api,
      method,
      request: params,
      response: data,
      status: response.ok ? 'success' : 'error',
      duration,
      error: response.ok ? undefined : `HTTP ${response.status}`
    });

    return data;
  } catch (e: any) {
    const duration = Date.now() - startTime;

    addApiLog({
      api,
      method,
      request: params,
      response: null,
      status: 'error',
      duration,
      error: e.message
    });

    throw e;
  }
};

// 결과 다운로드
export const downloadApiCheckResult = (result: FullApiCheckResult) => {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-check-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// 콘솔 명령어 등록
if (typeof window !== 'undefined') {
  (window as any).dliveDebug = {
    runFullCheck: (apiBase?: string) => runFullApiCheck(apiBase || '/api'),
    getLogs: getApiLogs,
    clearLogs: clearApiLogs,
    setDebugMode,
    testCases: EQUIPMENT_TEST_CASES,
    paramVariations: PARAMETER_VARIATIONS,
    discoverParams: discoverApiParameters,
    downloadResult: downloadApiCheckResult
  };

  // apiService.ts에서 발생하는 API 호출 이벤트 수신
  window.addEventListener('api-call-complete', ((event: CustomEvent) => {
    const log = event.detail;
    if (log && log.api) {
      addApiLog(log);
    }
  }) as EventListener);

  console.log('%c🔧 D\'Live API 디버거 로드됨', 'font-weight: bold; color: #8B5CF6');
  console.log('─'.repeat(50));
  console.log('%c사용 가능한 명령어:', 'font-weight: bold');
  console.log('  dliveDebug.runFullCheck()     - 🚀 원클릭 전체 API 점검');
  console.log('  dliveDebug.getLogs()          - 📋 API 로그 조회');
  console.log('  dliveDebug.clearLogs()        - 🗑️ 로그 초기화');
  console.log('  dliveDebug.setDebugMode(true) - 🔍 디버그 모드 ON/OFF');
  console.log('─'.repeat(50));
  console.log('%c💡 팁: 장비관리 > API 디버거 탭에서 UI로도 사용 가능', 'color: #6366F1');
}

export default {
  addApiLog,
  getApiLogs,
  clearApiLogs,
  setDebugMode,
  runFullApiCheck,
  discoverApiParameters,
  apiCallWithLogging,
  downloadApiCheckResult,
  EQUIPMENT_TEST_CASES,
  PARAMETER_VARIATIONS
};
