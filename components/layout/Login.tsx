import React, { useState } from 'react';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockClosedIcon } from '../icons/LockClosedIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { EyeSlashIcon } from '../icons/EyeSlashIcon';
import { loginWithOtp } from '../../services/apiService';
import { logLogin } from '../../services/logService';

const OTP_ENABLED = true;

// OTP 제외 계정 (운영 모바일코나 테스트 계정)
const OTP_SKIP_USERS = ['A20072330', 'A20070013', 'A20119065'];

const LOGIN_ERROR_MESSAGE = '입력정보가 잘못되어 로그인이 불가합니다.';

interface LoginProps {
  onLogin: (userId?: string, userName?: string, userNameEn?: string, userRole?: string, crrId?: string, soId?: string, mstSoId?: string, telNo2?: string, authSoList?: Array<{SO_ID: string; SO_NM: string; MST_SO_ID: string}>, soYn?: string, deptCd?: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDupConfirm, setShowDupConfirm] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);

  const completeLogin = (result: any) => {
    onLogin(result.userId, result.userName, result.userNameEn, result.userRole, result.crrId, result.soId, result.mstSoId, result.telNo2, result.AUTH_SO_List, result.soYn, result.deptCd);
    logLogin();
  };

  // NW_TYPE 가져오기
  const getNetworkType = (): string => {
    try {
      const conn = (navigator as any).connection;
      if (conn) return conn.type || conn.effectiveType || '';
    } catch (e) {}
    return '';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, forceDisconnect: boolean = false) => {
    e.preventDefault();
    if (!username || !password) return;
    const skipOtp = OTP_SKIP_USERS.includes(username.toUpperCase());
    if (OTP_ENABLED && !skipOtp && !otpCode) {
      setError('OTP 인증번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowDupConfirm(false);
    setLockMessage(null);
    setBlockMessage(null);

    try {
      // 항상 login-with-otp 사용 (로그인+OTP+감사로그 서버에서 전부 처리)
      // OTP 꺼져있거나 스킵 계정이면 OTP_CODE 빈값 → 서버에서 OTP 단계 스킵, 로그는 쌓음
      const sendOtpCode = (OTP_ENABLED && !skipOtp) ? otpCode : '';
      const result = await loginWithOtp(username, password, sendOtpCode, forceDisconnect ? 'Y' : 'N', getNetworkType());

      console.log('[Login] API 응답:', result);

      // 서버 TRX_ID를 항상 저장 (성공/실패 무관 — 이후 활동 로그 추적용)
      if (result.trxId) {
        try { localStorage.setItem('loginTrxId', result.trxId); } catch {}
      }

      // 계정 잠금 감지
      if (result.code === 'LOCK') {
        setLockMessage(result.message || '계정이 잠겨있습니다. 관리자에게 문의하세요.');
        setIsLoading(false);
        return;
      }

      // 동시접속 감지
      if (result.LOGIN_DUP_YN === 'Y' || result.code === 'LOGIN_DUP') {
        setShowDupConfirm(true);
        setIsLoading(false);
        return;
      }

      if (result.ok) {
        completeLogin(result);
      } else {
        setError(LOGIN_ERROR_MESSAGE);
        setOtpCode('');
      }
    } catch (err: any) {
      if (err.statusCode === 503) {
        setBlockMessage(err.message || '일시적으로 요청이 차단되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(LOGIN_ERROR_MESSAGE);
      }
      console.error('로그인 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 강제 로그인 (기존 세션 종료)
  const handleForceLogin = async () => {
    setIsLoading(true);
    setShowDupConfirm(false);

    try {
      const skipOtp = OTP_SKIP_USERS.includes(username.toUpperCase());
      const sendOtpCode = (OTP_ENABLED && !skipOtp) ? otpCode : '';
      const result = await loginWithOtp(username, password, sendOtpCode, 'Y', getNetworkType());

      console.log('[Login] 강제 로그인 응답:', result);

      if (result.trxId) {
        try { localStorage.setItem('loginTrxId', result.trxId); } catch {}
      }

      if (result.ok) {
        completeLogin(result);
      } else {
        setError(LOGIN_ERROR_MESSAGE);
        setOtpCode('');
      }
    } catch (err: any) {
      if (err.statusCode === 503) {
        setBlockMessage(err.message || '일시적으로 요청이 차단되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(LOGIN_ERROR_MESSAGE);
      }
      console.error('강제 로그인 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClasses = "w-full py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-gray-100">
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl p-8 space-y-8">
        
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src="/recona/360X120px.png" alt="D'LIVE CONA" className="h-30" />
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="sr-only">사용자 ID</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                required
                className={`${inputBaseClasses} pl-10 pr-3`}
                placeholder="사용자 ID"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="sr-only">비밀번호</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <LockClosedIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                className={`${inputBaseClasses} pl-10 pr-10`}
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
          
          <div className={OTP_ENABLED ? '' : 'opacity-50'}>
            <label htmlFor="otpCode" className="sr-only">OTP 인증번호</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <LockClosedIcon className="h-5 w-5 text-gray-300" />
              </div>
              <input
                id="otpCode"
                name="otpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                disabled={!OTP_ENABLED}
                className={`${inputBaseClasses} pl-10 text-center text-xl tracking-[0.4em] font-mono disabled:bg-gray-100 disabled:cursor-not-allowed`}
                placeholder="인증번호"
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                  setOtpCode(val);
                }}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-base font-bold rounded-lg text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors shadow-md disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
            
          </div>
        </form>
        
        <div className="mt-8 text-center">
          {/* 슬로건 - 카피라이트 위에 */}
          <div className="mb-3">
            <p className="text-sm font-medium tracking-wide text-primary-700">
              Smart Life Coordinator
            </p>
          </div>

          <p className="text-xs font-semibold text-primary-700">COPYRIGHT 2025. D'LIVE CO. LTD</p>
          <p className="text-[10px] text-gray-400 mt-2">v{(typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '')}</p>
        </div>

      </div>

      {/* 동시접속 확인 모달 */}
      {showDupConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">다른 기기에서 접속 중</h3>
              <p className="text-sm text-gray-600">
                현재 다른 기기에서 이미 로그인되어 있습니다.<br />
                강제 로그인 시 기존 접속이 종료됩니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDupConfirm(false)}
                className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleForceLogin}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition disabled:bg-gray-400 disabled:text-white disabled:cursor-not-allowed"
              >
                {isLoading ? '처리 중...' : '강제 로그인'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 계정 잠금 모달 */}
      {lockMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <LockClosedIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">계정 잠금</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {lockMessage}
              </p>
            </div>
            <button
              onClick={() => setLockMessage(null)}
              className="w-full py-2.5 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition"
            >
              확인
            </button>
          </div>
        </div>
      )}
      {/* 요청 차단 모달 (Circuit Breaker) */}
      {blockMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">요청 차단</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {blockMessage}
              </p>
            </div>
            <button
              onClick={() => setBlockMessage(null)}
              className="w-full py-2.5 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;