/**
 * Activity Logger Service
 * - Sends insertActivityLog on page navigation (MENU_CLICK)
 * - Sends insertDebugLog on API errors
 * - Stores LOGIN_TRX_ID and NW_TYPE from login session
 */

import { API_BASE } from './apiService';

// Session-level tracking data (set after login)
let _loginTrxId = '';
let _nwType = '';
let _userId = '';
let _userNm = '';
let _soId = '';
let _crrId = '';
let _prevView = '';

// Detect NW_TYPE (same logic as apiService login)
function detectNwType(): string {
  if (typeof navigator === 'undefined') return 'pc';
  const ua = navigator.userAgent || '';
  const conn = (navigator as any).connection;
  if (conn) {
    const connType = conn.type || conn.effectiveType || '';
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) {
      const isTablet = !/Mobile/i.test(ua);
      const nw = connType === 'cellular' ? 'cellular' : 'wifi';
      return isTablet ? `tablet_${nw}` : `mobile_${nw}`;
    }
    return 'pc';
  }
  if (/iPhone/i.test(ua)) return 'mobile_ios';
  if (/iPad/i.test(ua)) return 'tablet_ios';
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 0) return 'tablet_ios';
  return 'pc';
}

/** Initialize after login - call this from handleLogin */
export function initActivityLogger(params: {
  loginTrxId: string;
  userId: string;
  userNm: string;
  soId: string;
  crrId: string;
}) {
  _loginTrxId = params.loginTrxId || '';
  _userId = params.userId || '';
  _userNm = params.userNm || '';
  _soId = params.soId || '';
  _crrId = params.crrId || '';
  _nwType = detectNwType();
  _prevView = 'login';
  console.log('[ActivityLogger] Initialized:', { loginTrxId: _loginTrxId, nwType: _nwType, userId: _userId });
}

/** Clear on logout */
export function clearActivityLogger() {
  _loginTrxId = '';
  _nwType = '';
  _userId = '';
  _userNm = '';
  _soId = '';
  _crrId = '';
  _prevView = '';
}

/** Format current datetime as YYYYMMDDHHMMSS */
function nowDttm(): string {
  const d = new Date();
  return d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0');
}

/** Send activity log (fire-and-forget) */
export function logActivity(toView: string, menuNm?: string, orderId?: string) {
  if (!_userId) return; // not logged in yet

  const fromView = _prevView;
  _prevView = toView;

  // Skip if same view
  if (fromView === toView) return;

  const payload = {
    LOG_TYPE: 'MENU_CLICK',
    USR_ID: _userId,
    USR_NM: _userNm,
    SO_ID: _soId,
    CRR_ID: _crrId,
    ACCESS_TYPE: 'APP',
    FROM_VIEW: fromView,
    TO_VIEW: toView,
    MENU_NM: menuNm || '',
    ORDER_ID: orderId || '',
    IP_ADDR: '',
    USER_AGENT: navigator.userAgent.substring(0, 200),
    CRT_DTTM: nowDttm(),
    LOGIN_TRX_ID: _loginTrxId,
    NW_TYPE: _nwType
  };

  // Fire and forget - don't block navigation
  fetch(`${API_BASE}/system/pm/insertActivityLog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  }).catch(() => {
    // Silently ignore - activity log failure should not affect UX
  });
}

/** Send debug log for API errors (fire-and-forget) */
export function logDebug(params: {
  apiPath: string;
  apiMethod: string;
  apiStatus: string;
  apiDuration?: string;
  errorMsg?: string;
  reqBody?: string;
  resBody?: string;
  pageView?: string;
}) {
  if (!_userId) return;

  const payload = {
    LOG_LEVEL: 'ERROR',
    USR_ID: _userId,
    SO_ID: _soId,
    API_PATH: params.apiPath || '',
    API_METHOD: params.apiMethod || '',
    API_STATUS: params.apiStatus || '',
    API_DURATION: params.apiDuration || '',
    ERROR_MSG: (params.errorMsg || '').substring(0, 500),
    REQ_BODY: (params.reqBody || '').substring(0, 1000),
    RES_BODY: (params.resBody || '').substring(0, 1000),
    STACK_TRACE: '',
    PAGE_VIEW: params.pageView || _prevView,
    CRT_DTTM: nowDttm(),
    LOGIN_TRX_ID: _loginTrxId,
    NW_TYPE: _nwType
  };

  fetch(`${API_BASE}/system/pm/insertDebugLog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  }).catch(() => {});
}
