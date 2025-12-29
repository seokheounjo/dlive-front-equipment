import React, { useState, useEffect } from 'react';
import {
  UserPlus, Save, AlertCircle, Loader2,
  User, Phone, MapPin, CreditCard, Check, X
} from 'lucide-react';
import {
  createCustomer,
  getCustomerTypeCodes,
  CustomerCreateRequest,
  formatPhoneNumber
} from '../../services/customerApi';

interface CustomerCreateProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface CustomerTypeCode {
  CODE: string;
  CODE_NM: string;
}

/**
 * 잠재고객 생성 화면
 *
 * 회의록 기준:
 * - 필수 입력값: 고객명, 주민등록번호, 고객유형(개인, 사업자, 외국인, 단체)
 * - 단체고객 제외 실명인증 필요
 * - 기존 CONA 등록이 안된 경우만 외부 API 호출
 */
const CustomerCreate: React.FC<CustomerCreateProps> = ({
  onBack,
  showToast
}) => {
  // 폼 데이터
  const [formData, setFormData] = useState({
    custNm: '',
    juminNo1: '',  // 주민번호 앞자리
    juminNo2: '',  // 주민번호 뒷자리
    custTpCd: '01',  // 기본값: 개인
    telNo: '',
    hpNo: '',
    addr: ''
  });

  // 고객유형 코드
  const [customerTypeCodes, setCustomerTypeCodes] = useState<CustomerTypeCode[]>([]);

  // 상태
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // 유효성 검사 에러
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 코드 로드
  useEffect(() => {
    loadCustomerTypeCodes();
  }, []);

  const loadCustomerTypeCodes = async () => {
    setIsLoadingCodes(true);
    try {
      const response = await getCustomerTypeCodes();
      if (response.success && response.data) {
        setCustomerTypeCodes(response.data);
      }
    } catch (error) {
      console.error('Load customer type codes error:', error);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  // 입력값 변경
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // 에러 클리어
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
    // 주민번호 변경 시 인증 상태 초기화
    if (field === 'juminNo1' || field === 'juminNo2') {
      setIsVerified(false);
    }
  };

  // 유효성 검사
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 고객명
    if (!formData.custNm.trim()) {
      newErrors.custNm = '고객명을 입력해주세요.';
    } else if (formData.custNm.length < 2) {
      newErrors.custNm = '고객명은 2자 이상 입력해주세요.';
    }

    // 주민등록번호 (단체 제외)
    if (formData.custTpCd !== '04') {
      if (!formData.juminNo1 || formData.juminNo1.length !== 6) {
        newErrors.juminNo1 = '주민번호 앞자리 6자리를 입력해주세요.';
      }
      if (!formData.juminNo2 || formData.juminNo2.length !== 7) {
        newErrors.juminNo2 = '주민번호 뒷자리 7자리를 입력해주세요.';
      }
    }

    // 전화번호 (선택이지만 입력 시 유효성 검사)
    if (formData.hpNo && formData.hpNo.length < 10) {
      newErrors.hpNo = '올바른 휴대폰 번호를 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 실명인증
  const handleVerify = async () => {
    if (formData.custTpCd === '04') {
      // 단체는 실명인증 불필요
      setIsVerified(true);
      showToast?.('단체 고객은 실명인증이 필요하지 않습니다.', 'info');
      return;
    }

    if (!formData.custNm || !formData.juminNo1 || !formData.juminNo2) {
      showToast?.('고객명과 주민등록번호를 입력해주세요.', 'warning');
      return;
    }

    setIsVerifying(true);
    try {
      // TODO: 실명인증 API 연동 (나이스정보통신)
      // 현재는 임시로 성공 처리
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsVerified(true);
      showToast?.('실명인증이 완료되었습니다.', 'success');
    } catch (error) {
      console.error('Verify error:', error);
      showToast?.('실명인증에 실패했습니다.', 'error');
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  // 저장
  const handleSave = async () => {
    if (!validateForm()) {
      showToast?.('입력 정보를 확인해주세요.', 'warning');
      return;
    }

    // 단체 제외 실명인증 필요
    if (formData.custTpCd !== '04' && !isVerified) {
      showToast?.('먼저 실명인증을 완료해주세요.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const params: CustomerCreateRequest = {
        CUST_NM: formData.custNm,
        JUMIN_NO: formData.juminNo1 + formData.juminNo2,
        CUST_TP_CD: formData.custTpCd,
        TEL_NO: formData.telNo || undefined,
        HP_NO: formData.hpNo || undefined,
        ADDR: formData.addr || undefined
      };

      const response = await createCustomer(params);

      if (response.success) {
        showToast?.('고객이 등록되었습니다.', 'success');
        // 폼 초기화
        setFormData({
          custNm: '',
          juminNo1: '',
          juminNo2: '',
          custTpCd: '01',
          telNo: '',
          hpNo: '',
          addr: ''
        });
        setIsVerified(false);
      } else {
        showToast?.(response.message || '고객 등록에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Create customer error:', error);
      showToast?.('고객 등록 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 폼 초기화
  const handleReset = () => {
    setFormData({
      custNm: '',
      juminNo1: '',
      juminNo2: '',
      custTpCd: '01',
      telNo: '',
      hpNo: '',
      addr: ''
    });
    setErrors({});
    setIsVerified(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-teal-500" />
            <h2 className="text-lg font-medium text-gray-800">잠재고객 생성</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            신규 잠재고객을 등록합니다. 단체 고객을 제외하고 실명인증이 필요합니다.
          </p>
        </div>

        {/* 입력 폼 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
          {/* 고객유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              고객유형 *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(customerTypeCodes.length > 0 ? customerTypeCodes : [
                { CODE: '01', CODE_NM: '개인' },
                { CODE: '02', CODE_NM: '사업자' },
                { CODE: '03', CODE_NM: '외국인' },
                { CODE: '04', CODE_NM: '단체' }
              ]).map(code => (
                <button
                  key={code.CODE}
                  onClick={() => {
                    handleChange('custTpCd', code.CODE);
                    setIsVerified(false);
                  }}
                  className={`py-2 px-3 text-sm rounded-lg border transition-colors ${
                    formData.custTpCd === code.CODE
                      ? 'bg-teal-500 text-white border-teal-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {code.CODE_NM}
                </button>
              ))}
            </div>
          </div>

          {/* 고객명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              고객명 *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.custNm}
                onChange={(e) => handleChange('custNm', e.target.value)}
                placeholder="고객명 입력"
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                  errors.custNm ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.custNm && (
              <p className="text-sm text-red-500 mt-1">{errors.custNm}</p>
            )}
          </div>

          {/* 주민등록번호 (단체 제외) */}
          {formData.custTpCd !== '04' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주민등록번호 *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.juminNo1}
                  onChange={(e) => handleChange('juminNo1', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="앞 6자리"
                  maxLength={6}
                  className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                    errors.juminNo1 ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                <span className="text-gray-400">-</span>
                <input
                  type="password"
                  value={formData.juminNo2}
                  onChange={(e) => handleChange('juminNo2', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="뒤 7자리"
                  maxLength={7}
                  className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                    errors.juminNo2 ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                <button
                  onClick={handleVerify}
                  disabled={isVerifying || isVerified}
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    isVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-teal-500 text-white hover:bg-teal-600 disabled:bg-gray-400'
                  }`}
                >
                  {isVerifying ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isVerified ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      인증완료
                    </span>
                  ) : (
                    '실명인증'
                  )}
                </button>
              </div>
              {(errors.juminNo1 || errors.juminNo2) && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.juminNo1 || errors.juminNo2}
                </p>
              )}
            </div>
          )}

          {/* 휴대폰번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              휴대폰번호
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={formData.hpNo}
                onChange={(e) => handleChange('hpNo', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="01012345678"
                maxLength={11}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                  errors.hpNo ? 'border-red-300' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.hpNo && (
              <p className="text-sm text-red-500 mt-1">{errors.hpNo}</p>
            )}
          </div>

          {/* 일반전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              일반전화번호
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={formData.telNo}
                onChange={(e) => handleChange('telNo', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0212345678"
                maxLength={11}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주소
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <textarea
                value={formData.addr}
                onChange={(e) => handleChange('addr', e.target.value)}
                placeholder="주소 입력"
                rows={2}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
            </div>
          </div>

          {/* 안내 */}
          {formData.custTpCd !== '04' && !isVerified && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-700">
                  고객 등록 전 실명인증이 필요합니다.
                  <br />
                  <span className="text-xs">나이스정보통신 실명인증 서비스를 사용합니다.</span>
                </div>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleReset}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
              초기화
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (formData.custTpCd !== '04' && !isVerified)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:bg-gray-400 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  등록 중...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  고객 등록
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCreate;
