import React, { useState, useEffect } from 'react';
import { WifiOff, CheckCircle, AlertCircle } from 'lucide-react';
import { requestLGUNetworkFault } from '../../services/apiService';
import { saveSession, loadSession, clearSession, SESSION_KEYS } from '../../utils/sessionStorage';

interface LGUNetworkFaultProps {
  onBack: () => void;
  userInfo?: {
    userId: string;
    userName: string;
    userRole: string;
  } | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const LGUNetworkFault: React.FC<LGUNetworkFaultProps> = ({ onBack, userInfo, showToast }) => {
  // 세션에서 이전 입력값 복원
  const loadedFormData = loadSession<any>(SESSION_KEYS.LGU_NETWORK_FAULT_FORM);
  const [formData, setFormData] = useState({
    CTRT_ID: loadedFormData?.CTRT_ID || '',
    CUST_ID: loadedFormData?.CUST_ID || '',
    WRK_ID: loadedFormData?.WRK_ID || '',
    CANCEL_TYPE: loadedFormData?.CANCEL_TYPE || '',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);

  // 입력값 변경 시 세션에 저장
  useEffect(() => {
    saveSession(SESSION_KEYS.LGU_NETWORK_FAULT_FORM, formData);
  }, [formData]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.CTRT_ID || !formData.CUST_ID || !formData.WRK_ID) {
      if (showToast) showToast('필수 항목을 모두 입력해주세요.', 'warning');
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const requestData = {
        ...formData,
        CRR_ID: userInfo?.crrId || '01',
        SO_ID: userInfo?.soId || '',
        REG_UID: userInfo?.userId || 'mobile_user'
      };
      
      const response = await requestLGUNetworkFault(requestData);
      console.log('✅ LGU 망장애 처리 성공:', response);
      
      setResult({ success: true, data: response });
      if (showToast) showToast('LGU 망장애 처리가 완료되었습니다.', 'success');
      
      // 폼 초기화
      setFormData({
        CTRT_ID: '',
        CUST_ID: '',
        WRK_ID: '',
        CANCEL_TYPE: '',
      });
      clearSession(SESSION_KEYS.LGU_NETWORK_FAULT_FORM);
    } catch (error: any) {
      console.error('❌ LGU 망장애 처리 실패:', error);
      setResult({ success: false, error: error.message });
      if (showToast) showToast(`LGU 망장애 처리 실패: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-2 sm:mb-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900">(LGU) 망장애이관리스트</h2>
      </div>

      {/* 폼 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              계약 ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.CTRT_ID}
              onChange={(e) => handleInputChange('CTRT_ID', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              placeholder="계약 ID 입력"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              고객 ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.CUST_ID}
              onChange={(e) => handleInputChange('CUST_ID', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              placeholder="고객 ID 입력"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              작업 ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.WRK_ID}
              onChange={(e) => handleInputChange('WRK_ID', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              placeholder="작업 ID 입력"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">취소 유형</label>
            <input
              type="text"
              value={formData.CANCEL_TYPE}
              onChange={(e) => handleInputChange('CANCEL_TYPE', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              placeholder="취소 유형 (선택)"
            />
          </div>

          {/* 버튼 */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mt-3 sm:mt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '처리 중...' : '망장애 처리'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData({ CTRT_ID: '', CUST_ID: '', WRK_ID: '', CANCEL_TYPE: '' });
                setResult(null);
                clearSession(SESSION_KEYS.LGU_NETWORK_FAULT_FORM);
              }}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium text-xs sm:text-sm shadow-md transition-all"
            >
              초기화
            </button>
          </div>
        </form>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div className="mt-2 sm:mt-3 bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 sm:p-3">
          <div className="mb-1.5 sm:mb-2">
            <span className={`text-xs sm:text-sm font-semibold flex items-center gap-1 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
              {result.success ? <><CheckCircle size={14} className="sm:w-4 sm:h-4" /> 처리 완료</> : <><AlertCircle size={14} className="sm:w-4 sm:h-4" /> 처리 실패</>}
            </span>
          </div>
          <div className="bg-gray-50 rounded p-1.5 sm:p-2">
            <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(result.success ? result.data : result.error, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default LGUNetworkFault;

