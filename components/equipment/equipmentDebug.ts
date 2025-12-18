// Equipment Management API Debug Utility
// TEMPORARY DEBUG - Remove after testing

const DEBUG_ENABLED = true;
const DEBUG_PREFIX = '[EQUIPMENT-MGT-DEBUG]';

export interface DebugLogEntry {
  timestamp: string;
  component: string;
  action: string;
  api?: string;
  params?: any;
  response?: any;
  error?: any;
  duration?: number;
}

// Global log storage
const debugLogs: DebugLogEntry[] = [];

// Generate timestamp
const getTimestamp = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('ko-KR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
};

// Debug log output
export const debugLog = (
  component: string,
  action: string,
  data?: {
    api?: string;
    params?: any;
    response?: any;
    error?: any;
    duration?: number;
  }
) => {
  if (!DEBUG_ENABLED) return;

  const entry: DebugLogEntry = {
    timestamp: getTimestamp(),
    component,
    action,
    ...data
  };

  debugLogs.push(entry);

  // Console output with styling
  const style = data?.error
    ? 'color: #ff4444; font-weight: bold;'
    : data?.response
      ? 'color: #44aa44; font-weight: bold;'
      : 'color: #4488ff; font-weight: bold;';

  console.log(
    `%c${DEBUG_PREFIX} [${entry.timestamp}] ${component} - ${action}`,
    style
  );

  if (data?.api) {
    console.log(`  API: ${data.api}`);
  }
  if (data?.params) {
    console.log('  Params:', data.params);
  }
  if (data?.response !== undefined) {
    const responsePreview = JSON.stringify(data.response);
    if (responsePreview.length > 500) {
      console.log('  Response (preview):', responsePreview.slice(0, 500) + '...');
      console.log('  Response (full):', data.response);
    } else {
      console.log('  Response:', data.response);
    }

    // Check for empty array
    if (Array.isArray(data.response) && data.response.length === 0) {
      console.warn(`  WARNING: Empty array returned!`);
    }
    if (data.response?.data && Array.isArray(data.response.data) && data.response.data.length === 0) {
      console.warn(`  WARNING: response.data is empty array!`);
    }
  }
  if (data?.error) {
    console.error('  Error:', data.error);
  }
  if (data?.duration) {
    console.log(`  Duration: ${data.duration}ms`);
  }
};

// API call wrapper (auto-adds debug logging)
export const debugApiCall = async <T>(
  component: string,
  apiName: string,
  apiCall: () => Promise<T>,
  params?: any
): Promise<T> => {
  const startTime = Date.now();

  debugLog(component, `API_CALL_START: ${apiName}`, { api: apiName, params });

  try {
    const response = await apiCall();
    const duration = Date.now() - startTime;

    debugLog(component, `API_CALL_SUCCESS: ${apiName}`, {
      api: apiName,
      response,
      duration
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    debugLog(component, `API_CALL_FAILED: ${apiName}`, {
      api: apiName,
      error,
      duration
    });

    throw error;
  }
};

// Get all logs
export const getAllDebugLogs = (): DebugLogEntry[] => {
  return [...debugLogs];
};

// Clear logs
export const clearDebugLogs = () => {
  debugLogs.length = 0;
  console.log(`${DEBUG_PREFIX} Logs cleared`);
};

// Print summary
export const printDebugSummary = () => {
  console.log('\n' + '='.repeat(70));
  console.log(`${DEBUG_PREFIX} API CALL SUMMARY`);
  console.log('='.repeat(70));

  const apiCalls = debugLogs.filter(log => log.api);
  const successCalls = apiCalls.filter(log => log.response && !log.error);
  const errorCalls = apiCalls.filter(log => log.error);
  const emptyResponses = apiCalls.filter(log => {
    if (Array.isArray(log.response) && log.response.length === 0) return true;
    if (log.response?.data && Array.isArray(log.response.data) && log.response.data.length === 0) return true;
    return false;
  });

  console.log(`Total API calls: ${apiCalls.length}`);
  console.log(`Success: ${successCalls.length}`);
  console.log(`Failed: ${errorCalls.length}`);
  console.log(`Empty responses: ${emptyResponses.length}`);

  if (emptyResponses.length > 0) {
    console.log('\nAPIs returning empty:');
    emptyResponses.forEach(log => {
      console.log(`  - ${log.api} (${log.component})`);
    });
  }

  if (errorCalls.length > 0) {
    console.log('\nFailed APIs:');
    errorCalls.forEach(log => {
      console.log(`  - ${log.api}: ${log.error?.message || log.error}`);
    });
  }

  console.log('='.repeat(70) + '\n');
};

// Make accessible globally
if (typeof window !== 'undefined') {
  (window as any).eqtDebug = {
    getLogs: getAllDebugLogs,
    clear: clearDebugLogs,
    summary: printDebugSummary,
    enabled: DEBUG_ENABLED
  };
  console.log(`${DEBUG_PREFIX} Debug utility loaded. Use window.eqtDebug.summary() to see summary.`);
}

export default {
  log: debugLog,
  apiCall: debugApiCall,
  getLogs: getAllDebugLogs,
  clear: clearDebugLogs,
  summary: printDebugSummary
};
