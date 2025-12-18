import React, { useState } from 'react';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockClosedIcon } from '../icons/LockClosedIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { EyeSlashIcon } from '../icons/EyeSlashIcon';
import { TestTube } from 'lucide-react';
import { login, getUserExtendedInfo } from '../../services/apiService';

interface LoginProps {
  onLogin: (userId?: string, userName?: string, userRole?: string, crrId?: string, soId?: string, mstSoId?: string, crrNm?: string, soNm?: string, authSoList?: Array<{ SO_ID: string; SO_NM: string }>, corpNm?: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('A20117965');
  const [password, setPassword] = useState('dlive12!@#');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await login(username, password);
      if (result.ok) {
        // 실제 로그인 시 더미 모드 해제
        localStorage.removeItem('demoMode');

        // 로그인 응답에 AUTH_SO_List가 없으면 추가 API로 조회
        let authSoList = result.AUTH_SO_List;
        let soNm = result.soNm;
        let crrNm = result.crrNm;

        if (!authSoList || authSoList.length === 0) {
          try {
            console.log('[Login] AUTH_SO_List 없음, getUserExtendedInfo 호출...');
            const extendedInfo = await getUserExtendedInfo(result.userId || username);
            if (extendedInfo.ok) {
              authSoList = extendedInfo.AUTH_SO_List;
              soNm = extendedInfo.soNm || soNm;
              crrNm = extendedInfo.crrNm || crrNm;
              console.log('[Login] getUserExtendedInfo 성공:', extendedInfo);
            }
          } catch (extErr) {
            console.warn('[Login] getUserExtendedInfo 실패 (무시):', extErr);
          }
        }

        onLogin(result.userId, result.userName, result.userRole, result.crrId, result.soId, result.mstSoId, crrNm, soNm, authSoList, result.corpNm);
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
                onLogin('demo', 'demo');
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors shadow-sm"
            >
              <TestTube className="w-4 h-4" />
              UI 테스트 계정
            </button>
          </div>
        </form>
        
        <div className="mt-8 text-center">
          <div className="w-full h-20 bg-gray-200 rounded-lg mb-4 overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1558002038-1055907df827?w=400&auto=format&fit=crop" 
              alt="Server room background" 
              className="w-full h-full object-cover opacity-70"
            />
          </div>
          
          {/* 슬로건 - 카피라이트 위에 */}
          <div className="mb-3">
            <p className="text-sm font-medium tracking-wide text-blue-600">
              Smart Life Coordinator
            </p>
          </div>

          <p className="text-xs font-semibold text-blue-600">COPYRIGHT 2025. D'LIVE CO. LTD</p>
        </div>

      </div>
    </div>
  );
};

export default Login;