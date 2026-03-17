import React, { useState } from 'react';
import { FaRegIdBadge } from 'react-icons/fa6';
import { LockClosedIcon } from '../icons/LockClosedIcon';
import { GoShieldLock } from 'react-icons/go';
import { IoIosLogIn } from 'react-icons/io';
import { EyeIcon } from '../icons/EyeIcon';
import { EyeSlashIcon } from '../icons/EyeSlashIcon';
import { loginWithOtp } from '../../services/apiService';
import { logLogin } from '../../services/logService';

const OTP_ENABLED = false;

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
    if (OTP_ENABLED && !skipOtp && (!otpCode || otpCode.length < 6)) {
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

  const inputBaseClasses = "w-full py-3.5 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white transition-all duration-200";

  const networkSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect fill='none' width='300' height='300'/%3E%3Cline x1='30' y1='20' x2='110' y2='60' stroke='%23ffffff' stroke-opacity='0.1' stroke-width='0.7'/%3E%3Cline x1='110' y1='60' x2='200' y2='35' stroke='%23ffffff' stroke-opacity='0.1' stroke-width='0.7'/%3E%3Cline x1='200' y1='35' x2='275' y2='90' stroke='%23ffffff' stroke-opacity='0.08' stroke-width='0.7'/%3E%3Cline x1='15' y1='130' x2='90' y2='110' stroke='%23ffffff' stroke-opacity='0.09' stroke-width='0.7'/%3E%3Cline x1='90' y1='110' x2='150' y2='160' stroke='%23ffffff' stroke-opacity='0.1' stroke-width='0.7'/%3E%3Cline x1='150' y1='160' x2='260' y2='140' stroke='%23ffffff' stroke-opacity='0.08' stroke-width='0.7'/%3E%3Cline x1='45' y1='220' x2='130' y2='205' stroke='%23ffffff' stroke-opacity='0.09' stroke-width='0.7'/%3E%3Cline x1='130' y1='205' x2='220' y2='245' stroke='%23ffffff' stroke-opacity='0.1' stroke-width='0.7'/%3E%3Cline x1='220' y1='245' x2='285' y2='215' stroke='%23ffffff' stroke-opacity='0.08' stroke-width='0.7'/%3E%3Cline x1='110' y1='60' x2='90' y2='110' stroke='%23ffffff' stroke-opacity='0.07' stroke-width='0.7'/%3E%3Cline x1='150' y1='160' x2='130' y2='205' stroke='%23ffffff' stroke-opacity='0.07' stroke-width='0.7'/%3E%3Cline x1='260' y1='140' x2='285' y2='215' stroke='%23ffffff' stroke-opacity='0.07' stroke-width='0.7'/%3E%3Cline x1='200' y1='35' x2='260' y2='140' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.7'/%3E%3Cline x1='90' y1='110' x2='45' y2='220' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.7'/%3E%3Cline x1='30' y1='20' x2='15' y2='130' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.7'/%3E%3Cline x1='275' y1='90' x2='260' y2='140' stroke='%23ffffff' stroke-opacity='0.08' stroke-width='0.7'/%3E%3Cline x1='150' y1='160' x2='220' y2='245' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.7'/%3E%3Cline x1='15' y1='130' x2='45' y2='220' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.7'/%3E%3Cline x1='110' y1='60' x2='150' y2='160' stroke='%23ffffff' stroke-opacity='0.05' stroke-width='0.7'/%3E%3Cline x1='200' y1='35' x2='150' y2='160' stroke='%23ffffff' stroke-opacity='0.05' stroke-width='0.7'/%3E%3Cline x1='60' y1='280' x2='130' y2='205' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.7'/%3E%3Cline x1='170' y1='290' x2='220' y2='245' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.7'/%3E%3Ccircle cx='30' cy='20' r='2.5' fill='%23ffffff' fill-opacity='0.25'/%3E%3Ccircle cx='110' cy='60' r='3' fill='%23ffffff' fill-opacity='0.3'/%3E%3Ccircle cx='200' cy='35' r='2.5' fill='%23ffffff' fill-opacity='0.25'/%3E%3Ccircle cx='275' cy='90' r='2' fill='%23ffffff' fill-opacity='0.2'/%3E%3Ccircle cx='15' cy='130' r='2' fill='%23ffffff' fill-opacity='0.2'/%3E%3Ccircle cx='90' cy='110' r='3' fill='%23ffffff' fill-opacity='0.3'/%3E%3Ccircle cx='150' cy='160' r='3.5' fill='%23ffffff' fill-opacity='0.35'/%3E%3Ccircle cx='260' cy='140' r='2.5' fill='%23ffffff' fill-opacity='0.25'/%3E%3Ccircle cx='45' cy='220' r='2.5' fill='%23ffffff' fill-opacity='0.22'/%3E%3Ccircle cx='130' cy='205' r='2.5' fill='%23ffffff' fill-opacity='0.25'/%3E%3Ccircle cx='220' cy='245' r='3' fill='%23ffffff' fill-opacity='0.3'/%3E%3Ccircle cx='285' cy='215' r='2' fill='%23ffffff' fill-opacity='0.2'/%3E%3Ccircle cx='60' cy='280' r='2' fill='%23ffffff' fill-opacity='0.18'/%3E%3Ccircle cx='170' cy='290' r='2' fill='%23ffffff' fill-opacity='0.2'/%3E%3Ccircle cx='240' cy='10' r='1.5' fill='%23ffffff' fill-opacity='0.15'/%3E%3Ccircle cx='70' cy='70' r='1.5' fill='%23ffffff' fill-opacity='0.15'/%3E%3Ccircle cx='190' cy='110' r='1.5' fill='%23ffffff' fill-opacity='0.12'/%3E%3Ccircle cx='50' cy='160' r='1.5' fill='%23ffffff' fill-opacity='0.12'/%3E%3Ccircle cx='290' cy='170' r='1.5' fill='%23ffffff' fill-opacity='0.12'/%3E%3Ccircle cx='180' cy='80' r='1' fill='%23ffffff' fill-opacity='0.1'/%3E%3Ccircle cx='10' cy='270' r='1' fill='%23ffffff' fill-opacity='0.1'/%3E%3Ccircle cx='250' cy='270' r='1.5' fill='%23ffffff' fill-opacity='0.12'/%3E%3C/svg%3E")`;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1e4976, #1a3a5c, #15304e)' }}
    >
      {/* 움직이는 네트워크 패턴 배경 */}
      <style>{`
        @keyframes networkDrift {
          0% { background-position: 0px 0px; }
          100% { background-position: 300px 300px; }
        }
      `}</style>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: networkSvg,
          backgroundSize: '300px 300px',
          animation: 'networkDrift 60s linear infinite',
        }}
      />
      <div className="w-full max-w-sm mx-auto relative z-10">
        <div className="bg-white rounded-3xl shadow-lg px-10 pt-5 pb-5 space-y-3">

        {/* Logo */}
        <div className="flex justify-center">
          <img src="/recona/dlive-cona-logo.png" alt="D'LIVE CONA" className="w-72 -my-6" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <FaRegIdBadge className="h-5 w-5 text-gray-500" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                required
                className={`${inputBaseClasses} pl-10 pr-3`}
                placeholder="사원번호"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="relative">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <LockClosedIcon className="h-5 w-5 text-gray-500" />
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
                  className="text-gray-400 hover:text-primary-500 focus:outline-none transition-colors"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className={`relative ${OTP_ENABLED ? '' : 'opacity-50'}`}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <GoShieldLock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="otpCode"
                name="otpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={100}
                autoComplete="one-time-code"
                disabled={!OTP_ENABLED}
                className={`${inputBaseClasses} pl-10 text-center text-xl tracking-[0.4em] font-mono disabled:bg-gray-100 disabled:border-gray-200 disabled:cursor-not-allowed`}
                placeholder="OTP"
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setOtpCode(val);
                }}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative overflow-hidden flex items-center py-3.5 px-0 border-0 text-base font-bold rounded-xl active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(to bottom, #33C7DF, #00B0C8, #007A8A)',
                boxShadow: '0 6px 20px rgba(0,176,200,0.4), 0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {/* 사선 흰색 영역 (자물쇠 아이콘 배경) */}
              <span className="absolute top-0 left-0 bottom-0 w-14 pointer-events-none z-0" style={{
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(220,240,245,0.85))',
                clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0 100%)',
              }} />
              {/* 글로시 상단 하이라이트 */}
              <span className="absolute top-0 left-0 right-0 h-[45%] rounded-t-xl pointer-events-none z-10" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)' }} />
              <IoIosLogIn className="w-5 h-5 ml-3.5 relative z-20 text-primary-700 drop-shadow-sm" />
              <span className="relative z-20 text-white tracking-widest drop-shadow-sm flex-1 text-center pr-6">{isLoading ? '로 그 인 중...' : '로 그 인'}</span>
            </button>
          </div>
        </form>

        <div className="text-center space-y-0.5 pt-1">
          <p className="text-xs font-bold text-gray-700">Smart Life Coordinator</p>
          <p className="text-[11px] text-gray-400">COPYRIGHT 2025. D'LIVE CO. LTD</p>
          <p className="text-[10px] text-gray-300">v{(typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '')}</p>
        </div>

      </div>{/* card end */}
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