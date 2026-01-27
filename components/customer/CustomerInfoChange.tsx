import React, { useState, useEffect } from 'react';
import {
  Phone, MapPin, Edit2, Save, X, Loader2,
  ChevronDown, ChevronUp, AlertCircle, Check, Search
} from 'lucide-react';
import {
  updatePhoneNumber,
  updateAddress,
  getTelecomCodes,
  formatPhoneNumber,
  PhoneChangeRequest,
  AddressChangeRequest
} from '../../services/customerApi';

// Daum Postcode API type declaration
declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose?: () => void;
        width?: string | number;
        height?: string | number;
      }) => { open: () => void };
    };
  }
}

interface DaumPostcodeData {
  zonecode: string;      // 우편번호
  address: string;       // 기본주소
  addressEnglish: string;
  addressType: string;
  userSelectedType: string;
  roadAddress: string;   // 도로명주소
  jibunAddress: string;  // 지번주소
  buildingName: string;  // 건물명
  apartment: string;
  bcode: string;
  bname: string;
  bname1: string;
  bname2: string;
  sido: string;
  sigungu: string;
  sigunguCode: string;
  query: string;
}

interface CustomerInfoChangeProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer: {
    custId: string;
    custNm: string;
    telNo: string;
  } | null;
}

interface TelecomCode {
  CODE: string;
  CODE_NM: string;
}

/**
 * 정보변경 화면
 *
 * 회의록 기준:
 * - 전화번호 변경
 * - 설치주소 변경
 * - 고객주소 변경
 * - 청구지주소 변경
 * - 휴대폰결제(선결제) 현황 변경
 */
const CustomerInfoChange: React.FC<CustomerInfoChangeProps> = ({
  onBack,
  showToast,
  selectedCustomer
}) => {
  // 섹션 펼침 상태
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    phone: true,
    address: false
  });

  // 전화번호 변경 폼
  const [phoneForm, setPhoneForm] = useState({
    telNo: '',
    telTpCd: '',  // 통신사
    disconnYn: 'N'  // 결번여부
  });
  const [telecomCodes, setTelecomCodes] = useState<TelecomCode[]>([]);

  // 주소 변경 폼
  const [addressForm, setAddressForm] = useState({
    zipCd: '',
    addr1: '',
    addr2: '',
    changeInstAddr: true,
    changeCustAddr: false,
    changeBillAddr: false
  });

  // 로딩/저장 상태
  const [isLoadingCodes, setIsLoadingCodes] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // 통신사 코드 로드
  useEffect(() => {
    loadTelecomCodes();
  }, []);

  const loadTelecomCodes = async () => {
    setIsLoadingCodes(true);
    try {
      const response = await getTelecomCodes();
      if (response.success && response.data) {
        setTelecomCodes(response.data);
      }
    } catch (error) {
      console.error('Load telecom codes error:', error);
    } finally {
      setIsLoadingCodes(false);
    }
  };

  // 섹션 토글
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 전화번호 변경 저장
  const handleSavePhone = async () => {
    if (!selectedCustomer) {
      showToast?.('먼저 고객을 선택해주세요.', 'warning');
      return;
    }

    if (!phoneForm.telNo || phoneForm.telNo.length < 10) {
      showToast?.('올바른 전화번호를 입력해주세요.', 'warning');
      return;
    }

    setIsSavingPhone(true);
    try {
      const params: PhoneChangeRequest = {
        CUST_ID: selectedCustomer.custId,
        TEL_NO: phoneForm.telNo,
        TEL_TP_CD: phoneForm.telTpCd,
        DISCONN_YN: phoneForm.disconnYn
      };

      const response = await updatePhoneNumber(params);

      if (response.success) {
        showToast?.('전화번호가 변경되었습니다.', 'success');
        // 폼 초기화
        setPhoneForm({ telNo: '', telTpCd: '', disconnYn: 'N' });
      } else {
        showToast?.(response.message || '전화번호 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Update phone error:', error);
      showToast?.('전화번호 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingPhone(false);
    }
  };

  // 주소 변경 저장
  const handleSaveAddress = async () => {
    if (!selectedCustomer) {
      showToast?.('먼저 고객을 선택해주세요.', 'warning');
      return;
    }

    if (!addressForm.zipCd || !addressForm.addr1) {
      showToast?.('우편번호와 기본주소를 입력해주세요.', 'warning');
      return;
    }

    if (!addressForm.changeInstAddr && !addressForm.changeCustAddr && !addressForm.changeBillAddr) {
      showToast?.('변경할 주소 유형을 선택해주세요.', 'warning');
      return;
    }

    setIsSavingAddress(true);
    try {
      // 선택된 주소 유형에 따라 변경
      const addrType = addressForm.changeInstAddr ? 'INST' :
                       addressForm.changeCustAddr ? 'CUST' : 'BILL';

      const params: AddressChangeRequest = {
        CUST_ID: selectedCustomer.custId,
        ADDR_TP: addrType,
        ZIP_CD: addressForm.zipCd,
        ADDR1: addressForm.addr1,
        ADDR2: addressForm.addr2,
        CHANGE_CUST_ADDR: addressForm.changeCustAddr,
        CHANGE_BILL_ADDR: addressForm.changeBillAddr
      };

      const response = await updateAddress(params);

      if (response.success) {
        showToast?.('주소가 변경되었습니다.', 'success');
        // 폼 초기화
        setAddressForm({
          zipCd: '',
          addr1: '',
          addr2: '',
          changeInstAddr: true,
          changeCustAddr: false,
          changeBillAddr: false
        });
      } else {
        showToast?.(response.message || '주소 변경에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Update address error:', error);
      showToast?.('주소 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // 우편번호 검색 (다음 우편번호 API)
  const handleSearchZipCode = () => {
    if (!window.daum || !window.daum.Postcode) {
      showToast?.('우편번호 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        // 도로명주소 우선, 없으면 지번주소 사용
        let fullAddress = data.roadAddress || data.jibunAddress;

        // 건물명이 있으면 추가
        if (data.buildingName) {
          fullAddress += ` (${data.buildingName})`;
        }

        setAddressForm(prev => ({
          ...prev,
          zipCd: data.zonecode,
          addr1: fullAddress,
          addr2: ''  // 상세주소는 사용자가 직접 입력
        }));

        showToast?.('주소가 입력되었습니다. 상세주소를 입력해주세요.', 'info');
      }
    }).open();
  };

  // 고객 미선택 시 안내
  if (!selectedCustomer) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">고객을 먼저 선택해주세요</h3>
          <p className="text-gray-500">
            기본조회 탭에서 고객을 검색하고 선택한 후<br />
            정보변경을 진행할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 전화번호 변경 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('phone')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-gray-800">전화번호 변경</span>
            </div>
            {expandedSections.phone ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.phone && (
            <div className="px-4 pb-4 space-y-4">
              {/* 현재 전화번호 */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">현재 전화번호</div>
                <div className="font-medium text-gray-800">
                  {formatPhoneNumber(selectedCustomer.telNo) || '-'}
                </div>
              </div>

              {/* 새 전화번호 입력 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">새 전화번호</label>
                <input
                  type="tel"
                  value={phoneForm.telNo}
                  onChange={(e) => setPhoneForm(prev => ({
                    ...prev,
                    telNo: e.target.value.replace(/[^0-9]/g, '')
                  }))}
                  placeholder="01012345678"
                  maxLength={11}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 통신사 선택 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">통신사</label>
                <select
                  value={phoneForm.telTpCd}
                  onChange={(e) => setPhoneForm(prev => ({
                    ...prev,
                    telTpCd: e.target.value
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">선택</option>
                  {telecomCodes.map(code => (
                    <option key={code.CODE} value={code.CODE}>
                      {code.CODE_NM}
                    </option>
                  ))}
                  {/* 기본 통신사 옵션 (코드 로드 실패 시) */}
                  {telecomCodes.length === 0 && (
                    <>
                      <option value="SKT">SKT</option>
                      <option value="KT">KT</option>
                      <option value="LGU">LG U+</option>
                      <option value="MVNO">알뜰폰</option>
                    </>
                  )}
                </select>
              </div>

              {/* 결번 여부 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="disconnYn"
                  checked={phoneForm.disconnYn === 'Y'}
                  onChange={(e) => setPhoneForm(prev => ({
                    ...prev,
                    disconnYn: e.target.checked ? 'Y' : 'N'
                  }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="disconnYn" className="text-sm text-gray-600">
                  결번 (연락 불가)
                </label>
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSavePhone}
                disabled={isSavingPhone}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
              >
                {isSavingPhone ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    전화번호 변경
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 주소 변경 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <button
            onClick={() => toggleSection('address')}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-500" />
              <span className="font-medium text-gray-800">주소 변경</span>
            </div>
            {expandedSections.address ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.address && (
            <div className="px-4 pb-4 space-y-4">
              {/* 변경할 주소 유형 선택 */}
              <div className="space-y-2">
                <label className="block text-sm text-gray-600 mb-2">변경할 주소 선택</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={addressForm.changeInstAddr}
                      onChange={(e) => setAddressForm(prev => ({
                        ...prev,
                        changeInstAddr: e.target.checked
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">설치주소</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={addressForm.changeCustAddr}
                      onChange={(e) => setAddressForm(prev => ({
                        ...prev,
                        changeCustAddr: e.target.checked
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">고객주소</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={addressForm.changeBillAddr}
                      onChange={(e) => setAddressForm(prev => ({
                        ...prev,
                        changeBillAddr: e.target.checked
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">청구지주소</span>
                  </label>
                </div>
              </div>

              {/* 우편번호 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">우편번호</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressForm.zipCd}
                    onChange={(e) => setAddressForm(prev => ({
                      ...prev,
                      zipCd: e.target.value.replace(/[^0-9]/g, '')
                    }))}
                    placeholder="12345"
                    maxLength={5}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={handleSearchZipCode}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 기본주소 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">기본주소</label>
                <input
                  type="text"
                  value={addressForm.addr1}
                  onChange={(e) => setAddressForm(prev => ({
                    ...prev,
                    addr1: e.target.value
                  }))}
                  placeholder="기본주소 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 상세주소 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">상세주소</label>
                <input
                  type="text"
                  value={addressForm.addr2}
                  onChange={(e) => setAddressForm(prev => ({
                    ...prev,
                    addr2: e.target.value
                  }))}
                  placeholder="상세주소 입력"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* 안내 메시지 */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p>설치 위치 변경은 작업관리에서 처리됩니다.</p>
                    <p className="text-xs mt-1">이 화면에서는 주소 정보만 수정됩니다.</p>
                  </div>
                </div>
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSaveAddress}
                disabled={isSavingAddress}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors"
              >
                {isSavingAddress ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    주소 변경
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerInfoChange;
