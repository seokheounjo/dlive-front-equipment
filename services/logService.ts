/**
 * logService.ts - Activity / Debug Log Service
 *
 * DB tables:
 *   TSYMO_APP_ACTIVITY_LOG@CONATOMOBILE - user activity (login, navigation, menu click)
 *   TSYMO_APP_DEBUG_LOG@CONATOMOBILE    - API debug (errors, slow APIs, runtime errors)
 *
 * Features:
 *   - Batch queue with periodic flush (10s)
 *   - sendBeacon on page unload (guaranteed delivery)
 *   - Silent failure (never breaks the app)
 */
import { API_BASE } from './apiService';

// ============ Types ============

export interface ActivityLogEntry {
  LOG_TYPE: string;      // LOGIN, LOGOUT, MENU_CLICK, PAGE_VIEW, WORK_COMPLETE, etc.
  FROM_VIEW?: string;    // previous page/view
  TO_VIEW?: string;      // current page/view
  MENU_NM?: string;      // menu name
  ORDER_ID?: string;     // work order ID if relevant
}

export interface DebugLogEntry {
  LOG_LEVEL: string;     // ERROR, WARN, INFO
  API_PATH?: string;     // /work/complete etc.
  API_METHOD?: string;   // POST, GET
  API_STATUS?: string;   // 200, 500 etc.
  API_DURATION?: string; // milliseconds
  ERROR_MSG?: string;    // error message (max 4000 chars)
  REQ_BODY?: string;     // request body (CLOB)
  RES_BODY?: string;     // response body (CLOB)
  STACK_TRACE?: string;  // stack trace (max 4000 chars)
  PAGE_VIEW?: string;    // current page
}

// ============ Internal Queue ============

const activityQueue: Record<string, string>[] = [];
const debugQueue: Record<string, string>[] = [];

let flushTimer: ReturnType<typeof setInterval> | null = null;
const FLUSH_INTERVAL = 10000; // 10 seconds
const MAX_QUEUE_SIZE = 50;

// ============ Login Transaction ID ============

/**
 * Generate and store a login transaction ID.
 * Call this once on successful login.
 * Format: YYYYMMDDHHMMSS_USERID_RANDOM (matches legacy P_LOGIN_TRX_ID)
 */
export function generateLoginTrxId(userId: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const trxId = `${ts}_${userId}_${rand}`;
  try {
    localStorage.setItem('loginTrxId', trxId);
  } catch { /* silent */ }
  return trxId;
}

/** Clear login transaction ID on logout */
export function clearLoginTrxId() {
  try {
    localStorage.removeItem('loginTrxId');
  } catch { /* silent */ }
}

function getLoginTrxId(): string {
  try {
    return localStorage.getItem('loginTrxId') || '';
  } catch {
    return '';
  }
}

// ============ Network Type Detection ============

function getDeviceType(): string {
  try {
    const ua = navigator.userAgent || '';
    if (/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'IPAD';
    if (/iPhone/i.test(ua)) return 'IPHONE';
    if (/Android/i.test(ua)) return 'ANDROID';
    return 'PC';
  } catch {
    return 'PC';
  }
}

function getConnectionType(): string {
  try {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!conn) return '';
    if (conn.type) {
      const t = conn.type.toUpperCase();
      if (t === 'CELLULAR') return 'LTE';
      return t; // WIFI, ETHERNET, BLUETOOTH, NONE
    }
    if (conn.effectiveType) {
      const e = conn.effectiveType.toUpperCase();
      if (e === '4G') return 'LTE';
      return e; // 3G, 2G, SLOW-2G
    }
    return '';
  } catch {
    return '';
  }
}

function getNetworkType(): string {
  const device = getDeviceType();
  const conn = getConnectionType();
  if (conn) return device + '_' + conn;
  return device;
}

// ============ User Info Helper ============

function getUserInfo(): { USR_ID: string; USR_NM: string; SO_ID: string; CRR_ID: string } {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('userInfo') : null;
    if (!raw) return { USR_ID: '', USR_NM: '', SO_ID: '', CRR_ID: '' };
    const user = JSON.parse(raw);
    return {
      USR_ID: user.userId || '',
      USR_NM: user.userName || '',
      SO_ID: user.soId || '',
      CRR_ID: user.crrId || '',
    };
  } catch {
    return { USR_ID: '', USR_NM: '', SO_ID: '', CRR_ID: '' };
  }
}

function nowStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ============ Public API ============

/**
 * Log a user activity event.
 * Silently queued and sent in batch.
 */
export function logActivity(entry: ActivityLogEntry) {
  try {
    const user = getUserInfo();
    const record: Record<string, string> = {
      LOG_TYPE: entry.LOG_TYPE || 'APP',
      USR_ID: user.USR_ID,
      USR_NM: user.USR_NM,
      SO_ID: user.SO_ID,
      CRR_ID: user.CRR_ID,
      ACCESS_TYPE: 'APP',
      FROM_VIEW: entry.FROM_VIEW || '',
      TO_VIEW: entry.TO_VIEW || '',
      MENU_NM: entry.MENU_NM || '',
      ORDER_ID: entry.ORDER_ID || '',
      IP_ADDR: '',
      USER_AGENT: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      CRT_DTTM: nowStr(),
      LOGIN_TRX_ID: getLoginTrxId(),
      NW_TYPE: getNetworkType(),
    };

    activityQueue.push(record);
    if (activityQueue.length >= MAX_QUEUE_SIZE) {
      flushActivityLogs();
    }
    ensureFlushTimer();
  } catch {
    // silent
  }
}

/**
 * Log an API debug event (error, slow response, etc.)
 * Silently queued and sent in batch.
 */
export function logDebug(entry: DebugLogEntry) {
  try {
    const user = getUserInfo();
    const record: Record<string, string> = {
      LOG_LEVEL: entry.LOG_LEVEL || 'INFO',
      USR_ID: user.USR_ID,
      SO_ID: user.SO_ID,
      API_PATH: entry.API_PATH || '',
      API_METHOD: entry.API_METHOD || '',
      API_STATUS: entry.API_STATUS || '',
      API_DURATION: entry.API_DURATION || '',
      ERROR_MSG: (entry.ERROR_MSG || '').substring(0, 4000),
      REQ_BODY: entry.REQ_BODY || '',
      RES_BODY: entry.RES_BODY || '',
      STACK_TRACE: (entry.STACK_TRACE || '').substring(0, 4000),
      PAGE_VIEW: entry.PAGE_VIEW || (typeof window !== 'undefined' ? window.location.pathname : ''),
      CRT_DTTM: nowStr(),
      LOGIN_TRX_ID: getLoginTrxId(),
      NW_TYPE: getNetworkType(),
    };

    debugQueue.push(record);
    if (debugQueue.length >= MAX_QUEUE_SIZE) {
      flushDebugLogs();
    }
    ensureFlushTimer();
  } catch {
    // silent
  }
}

// ============ Convenience Helpers ============

/** Log user login */
export function logLogin() {
  logActivity({ LOG_TYPE: 'LOGIN', TO_VIEW: 'LoginPage' });
}

/** Log user logout */
export function logLogout() {
  logActivity({ LOG_TYPE: 'LOGOUT', FROM_VIEW: typeof window !== 'undefined' ? window.location.pathname : '' });
}

/** Log page/menu navigation */
export function logNavigation(fromView: string, toView: string, menuNm?: string) {
  logActivity({ LOG_TYPE: 'MENU_CLICK', FROM_VIEW: fromView, TO_VIEW: toView, MENU_NM: menuNm });
}

/** Log work completion */
export function logWorkComplete(orderId: string) {
  logActivity({ LOG_TYPE: 'WORK_COMPLETE', TO_VIEW: 'WorkComplete', ORDER_ID: orderId });
}

/** Log an API error */
export function logApiError(path: string, method: string, status: number | string, errorMsg: string, duration?: number) {
  logDebug({
    LOG_LEVEL: 'ERROR',
    API_PATH: path,
    API_METHOD: method,
    API_STATUS: String(status),
    API_DURATION: duration != null ? String(duration) : '',
    ERROR_MSG: errorMsg,
  });
}

/** Log a slow API response (> threshold ms) */
export function logSlowApi(path: string, method: string, status: number | string, duration: number) {
  logDebug({
    LOG_LEVEL: 'WARN',
    API_PATH: path,
    API_METHOD: method,
    API_STATUS: String(status),
    API_DURATION: String(duration),
    ERROR_MSG: `Slow API: ${duration}ms`,
  });
}

/** Log a runtime error (unhandled exception, etc.) */
export function logRuntimeError(errorMsg: string, stackTrace?: string) {
  logDebug({
    LOG_LEVEL: 'ERROR',
    ERROR_MSG: errorMsg,
    STACK_TRACE: stackTrace,
  });
}

// ============ Login Audit Log (pmobileLoginApi) ============

/**
 * Send login audit log directly (not queued).
 * Matches legacy PMOBILE_LOGIN_API_1/2/3 procedures.
 */
function sendLoginAudit(apiName: string, params: Record<string, string>) {
  const url = `${API_BASE}/system/pm/${apiName}`;
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
      keepalive: true,
    }).catch(() => { /* silent */ });
  } catch { /* silent */ }
}

/** Step 1: Login/OTP start */
export function loginApi1(params: {
  P_LOGIN_TRX_ID: string;
  P_USER_ID: string;
  P_API_TYPE: string; // 'LOGIN' or 'OTP'
  P_REQUEST_DATA?: string;
}) {
  sendLoginAudit('pmobileLoginApi_1', {
    P_LOGIN_TRX_ID: params.P_LOGIN_TRX_ID,
    P_USER_ID: params.P_USER_ID,
    P_NW_TYPE: getNetworkType(),
    P_CLIENT_IP: '',
    P_USER_AGENT: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    P_SERVER: typeof window !== 'undefined' ? window.location.hostname : '',
    P_API_TYPE: params.P_API_TYPE,
    P_REQUEST_DATA: params.P_REQUEST_DATA || '',
  });
}

/** Step 2: Login/OTP result */
export function loginApi2(params: {
  P_LOGIN_TRX_ID: string;
  P_API_TYPE: string; // 'LOGIN' or 'OTP'
  P_RESULT_CD: string;
  P_RESULT_MSG?: string;
  P_RESPONSE_DATA?: string;
}) {
  sendLoginAudit('pmobileLoginApi_2', {
    P_LOGIN_TRX_ID: params.P_LOGIN_TRX_ID,
    P_API_TYPE: params.P_API_TYPE,
    P_RESPONSE_DATA: params.P_RESPONSE_DATA || '',
    P_RESULT_CD: params.P_RESULT_CD,
    P_RESULT_MSG: params.P_RESULT_MSG || '',
  });
}

/** Step 3: Final result */
export function loginApi3(params: {
  P_LOGIN_TRX_ID: string;
  P_FINAL_RESULT_CD: string;
  P_FINAL_RESULT_MSG?: string;
}) {
  sendLoginAudit('pmobileLoginApi_3', {
    P_LOGIN_TRX_ID: params.P_LOGIN_TRX_ID,
    P_FINAL_RESULT_CD: params.P_FINAL_RESULT_CD,
    P_FINAL_RESULT_MSG: params.P_FINAL_RESULT_MSG || '',
  });
}

// ============ Flush Logic ============

function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushAll();
  }, FLUSH_INTERVAL);
}

/** Flush all queued logs (activity + debug) */
export function flushAll() {
  flushActivityLogs();
  flushDebugLogs();
}

function flushActivityLogs() {
  if (activityQueue.length === 0) return;
  const logs = activityQueue.splice(0, activityQueue.length);
  sendLogs('/system/pm/insertActivityLog', logs);
}

function flushDebugLogs() {
  if (debugQueue.length === 0) return;
  const logs = debugQueue.splice(0, debugQueue.length);
  sendLogs('/system/pm/insertDebugLog', logs);
}

function sendLogs(path: string, logs: Record<string, string>[]) {
  const url = `${API_BASE}${path}`;

  // CONA handleInsertLog expects individual JSON fields per request (not array batch)
  // Send each log entry as a separate request
  for (const log of logs) {
    const body = JSON.stringify(log);
    try {
      // Use sendBeacon if available (for page unload scenarios)
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        const sent = navigator.sendBeacon(url, blob);
        if (sent) continue;
      }

      // Fallback: fire-and-forget fetch
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
        keepalive: true,
      }).catch(() => {
        // silent - log sending should never block the app
      });
    } catch {
      // silent
    }
  }
}

// ============ Page Unload Handler ============

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushAll();
    }
  });

  window.addEventListener('pagehide', () => {
    flushAll();
  });
}

// ============ Cleanup ============

export function stopLogService() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushAll();
}
