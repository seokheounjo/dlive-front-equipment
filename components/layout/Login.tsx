import React, { useState } from 'react';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockClosedIcon } from '../icons/LockClosedIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { EyeSlashIcon } from '../icons/EyeSlashIcon';
import { TestTube } from 'lucide-react';
import { login } from '../../services/apiService';

interface LoginProps {
  onLogin: (userId?: string, userName?: string, userNameEn?: string, userRole?: string, crrId?: string, soId?: string, mstSoId?: string, telNo2?: string, authSoList?: Array<{SO_ID: string; SO_NM: string; MST_SO_ID: string}>) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('A20117965');
  const [password, setPassword] = useState('dlive12!@#$');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDupConfirm, setShowDupConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, forceDisconnect: boolean = false) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsLoading(true);
    setError(null);
    setShowDupConfirm(false);

    try {
      const result = await login(username, password, forceDisconnect ? 'Y' : 'N');
      console.log('[Login] API 응답:', result);
      console.log('[Login] telNo2:', result.telNo2);

      // 동시접속 감지
      if (result.LOGIN_DUP_YN === 'Y' || result.code === 'LOGIN_DUP') {
        setShowDupConfirm(true);
        setIsLoading(false);
        return;
      }

      if (result.ok) {
        // 실제 로그인 시 더미 모드 해제
        localStorage.removeItem('demoMode');
        onLogin(result.userId, result.userName, result.userNameEn, result.userRole, result.crrId, result.soId, result.mstSoId, result.telNo2, result.AUTH_SO_List);
      } else {
        setError('로그인에 실패했습니다.');
      }
    } catch (err: any) {
      // API 응답에서 구체적인 오류 메시지 확인
      if (err.message && err.message.includes('401')) {
        setError('아이디 또는 비밀번호가 잘못되었습니다.');
      } else if (err.message && err.message.includes('400')) {
        setError('아이디와 비밀번호를 모두 입력해주세요.');
      } else {
        setError('아이디 또는 비밀번호가 잘못되었습니다.');
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
      const result = await login(username, password, 'Y');
      console.log('[Login] 강제 로그인 응답:', result);
      if (result.ok) {
        localStorage.removeItem('demoMode');
        onLogin(result.userId, result.userName, result.userNameEn, result.userRole, result.crrId, result.soId, result.mstSoId, result.telNo2, result.AUTH_SO_List);
      } else {
        setError('로그인에 실패했습니다.');
      }
    } catch (err: any) {
      setError('로그인 중 오류가 발생했습니다.');
      console.error('강제 로그인 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClasses = "w-full py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-gray-100">
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-xl p-8 space-y-8">
        
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-wider text-blue-600">D'LIVE</h1>
            <h2 className="text-xl font-semibold text-gray-700">CONA</h2>
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
          
          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-base font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
            
            {/* 더미 계정 로그인 버튼 */}
            <button
              type="button"
              onClick={() => {
                // 더미 로그인 (API 호출 없이 바로 성공)
                localStorage.setItem('demoMode', 'true');
                onLogin('demo', 'demo', 'demo');
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors shadow-sm"
            >
              <TestTube className="w-4 h-4" />
              UI 테스트 계정
            </button>
          </div>
        </form>
        
        <div className="mt-8 text-center">
          <div className="mb-3">
            <p className="text-sm font-medium tracking-wide text-blue-600">
              Smart Life Coordinator
            </p>
          </div>
          <p className="text-xs font-semibold text-blue-600">COPYRIGHT 2025. D'LIVE CO. LTD</p>
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
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isLoading ? '처리 중...' : '강제 로그인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;