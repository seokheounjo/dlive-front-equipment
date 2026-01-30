import React, { useState } from 'react';
import { Loader2, X, User, AlertCircle } from 'lucide-react';
import { searchCustomer, CustomerInfo, maskPhoneNumber } from '../../services/customerApi';
import BarcodeScanner from '../equipment/BarcodeScanner';

interface CustomerSearchProps {
  onCustomerSelect: (customer: CustomerInfo) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer?: CustomerInfo | null;
}

/**
 * 고객 검색 컴포넌트
 * - 메인: readonly 입력창 (클릭하면 팝업)
 * - 팝업: 모든 검색 필드를 한 화면에 표시
 * - API: CUST_ID + SERCH_GB + LOGIN_ID 파라미터 사용
 */
const CustomerSearch: React.FC<CustomerSearchProps> = ({ onCustomerSelect, showToast, selectedCustomer }) => {
  // 팝업 표시 상태
  const [showModal, setShowModal] = useState(false);

  // 검색 입력값 - 테스트용 기본값
  const [customerId, setCustomerId] = useState('1001857577');
  const [contractId, setContractId] = useState('1003687719');
  const [phoneNumber, setPhoneNumber] = useState('01051346878');
  const [customerName, setCustomerName] = useState('푸꾸옥');
  const [equipmentNo, setEquipmentNo] = useState('S123456789');

  // 상태
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // 경고 팝업 상태
  const [warningPopup, setWarningPopup] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({ show: false, title: '', message: '' });

  // 팝업 열기
  const openModal = () => {
    setShowModal(true);
    setSearchResults([]);
    setHasSearched(false);
  };

  // 팝업 닫기
  const closeModal = () => {
    setShowModal(false);
    setSearchResults([]);
    setHasSearched(false);
  };

  // 검색 실행
  // 조건: 고객ID OR 계약ID OR 전화번호 OR 이름 OR 장비S/N
  const handleSearch = async () => {
    // 입력된 필드 확인
    const hasCustomerId = customerId.length >= 4;
    const hasContractId = contractId.length >= 4;
    const hasPhoneNumber = phoneNumber.length >= 4;
    const hasCustomerName = customerName.length >= 2;
    const hasEquipmentNo = equipmentNo.length >= 4;

    // 최소 하나의 조건이 필요
    if (!hasCustomerId && !hasContractId && !hasPhoneNumber && !hasCustomerName && !hasEquipmentNo) {
      setWarningPopup({
        show: true,
        title: '입력 오류',
        message: '검색 조건을 입력해주세요.\n(고객ID/계약ID/장비S/N 4자리, 전화번호 4자리, 이름 2자리)'
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      // 검색 타입 결정 (우선순위: 고객ID > 계약ID > 전화번호 > 이름 > 장비번호)
      let searchType: 'CUSTOMER_ID' | 'CONTRACT_ID' | 'PHONE_NAME' | 'EQUIPMENT_NO';
      if (hasCustomerId) {
        searchType = 'CUSTOMER_ID';
      } else if (hasContractId) {
        searchType = 'CONTRACT_ID';
      } else if (hasPhoneNumber || hasCustomerName) {
        searchType = 'PHONE_NAME';
      } else {
        searchType = 'EQUIPMENT_NO';
      }

      const response = await searchCustomer({
        searchType,
        customerId: hasCustomerId ? customerId : undefined,
        contractId: hasContractId ? contractId : undefined,
        phoneNumber: hasPhoneNumber ? phoneNumber : undefined,
        customerName: hasCustomerName ? customerName : undefined,
        equipmentNo: hasEquipmentNo ? equipmentNo : undefined,
      });

      if (response.success && response.data) {
        let results = response.data;

        // 여러 조건이 입력된 경우 OR 필터링 (전화번호, 이름)
        if (results.length > 0) {
          // 고객ID가 입력되었으면 일치 확인 (AND)
          if (hasCustomerId) {
            results = results.filter(c => c.CUST_ID === customerId);
          }
          // 전화번호 OR 이름 필터링
          if (hasPhoneNumber || hasCustomerName) {
            results = results.filter(c => {
              const matchPhone = hasPhoneNumber && (
                (c.TEL_NO && c.TEL_NO.includes(phoneNumber)) ||
                (c.HP_NO && c.HP_NO.includes(phoneNumber))
              );
              const matchName = hasCustomerName && c.CUST_NM && c.CUST_NM.includes(customerName);
              return matchPhone || matchName;
            });
          }
        }

        setSearchResults(results);
        if (results.length === 0) {
          setWarningPopup({
            show: true,
            title: '조회 실패',
            message: '조회대상이 없습니다.\n값을 정확히 입력해주세요.'
          });
        }
      } else {
        setWarningPopup({
          show: true,
          title: '검색 실패',
          message: response.message || '검색에 실패했습니다.'
        });
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Customer search error:', error);
      setWarningPopup({
        show: true,
        title: '오류',
        message: '검색 중 오류가 발생했습니다.'
      });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 엔터키 검색
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 바코드 스캔 결과 처리
  const handleBarcodeScan = (barcode: string) => {
    setEquipmentNo(barcode.toUpperCase());
    setShowScanner(false);
  };

  // 고객 선택
  const handleSelectCustomer = (customer: CustomerInfo) => {
    onCustomerSelect(customer);
    closeModal();
  };

  return (
    <>
      {/* 메인 화면 - readonly 입력창 (원래 디자인) */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3">
        <div className="space-y-2">
          {/* 고객검색 - 클릭하면 팝업 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객검색</label>
            <div
              className="flex-1 flex gap-2 cursor-pointer min-w-0 overflow-hidden"
              onClick={openModal}
            >
              <input
                readOnly
                className="flex-1 min-w-0 px-2 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer truncate"
                placeholder="고객명"
                type="text"
                value={selectedCustomer?.CUST_NM || ''}
              />
              <input
                readOnly
                className="flex-1 min-w-0 px-2 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer"
                placeholder="고객ID"
                type="text"
                value={selectedCustomer?.CUST_ID || ''}
              />
            </div>
          </div>

          {/* 조회 버튼 */}
          <button
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
            onClick={openModal}
          >
            조회
          </button>
        </div>
      </div>

      {/* 검색 팝업 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-blue-600 flex-shrink-0">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <User className="w-4 h-4" />
                고객 검색
              </h3>
            </div>

            {/* 검색 입력 영역 */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto min-h-0">
              {/* 고객ID */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">고객ID</label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="고객ID"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 계약ID */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">계약ID</label>
                <input
                  type="text"
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="계약ID"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 전화번호 + 이름 */}
              <div className="flex items-center gap-2 overflow-hidden">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">전화번호</label>
                <div className="flex-1 flex gap-2 min-w-0">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyPress={handleKeyPress}
                    placeholder="전화번호"
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="이름"
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* S/N (장비번호) */}
              <div className="flex items-center gap-2 overflow-hidden">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">S/N</label>
                <input
                  type="text"
                  value={equipmentNo}
                  onChange={(e) => setEquipmentNo(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="S/N 또는 MAC 주소 입력"
                  className="flex-1 min-w-0 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase transition-all font-mono"
                />
                <button
                  onClick={() => setShowScanner(true)}
                  className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation flex items-center gap-1.5 flex-shrink-0"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  스캔
                </button>
              </div>

              {/* 검색 결과 */}
              <div className="border-t border-gray-100 pt-3">
                {hasSearched ? (
                  searchResults.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      <div className="text-xs text-gray-500 mb-2">검색 결과: {searchResults.length}건</div>
                      {searchResults.map((customer, idx) => (
                        <button
                          key={customer.CUST_ID || idx}
                          onClick={() => handleSelectCustomer(customer)}
                          className="w-full p-3 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 text-left transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-blue-600 font-mono text-sm">{customer.CUST_ID}</span>
                            <span className="font-semibold text-gray-900">{customer.CUST_NM}</span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 truncate">
                            {maskPhoneNumber(customer.TEL_NO || customer.HP_NO)}
                            {customer.CUST_ADDR && ` | ${customer.CUST_ADDR}`}
                          </div>
                          {customer.UNPAY_AMT > 0 && (
                            <div className="mt-1 text-xs text-red-500 font-medium">
                              미납: {customer.UNPAY_AMT.toLocaleString()}원
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      검색 결과가 없습니다.
                    </div>
                  )
                ) : (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    검색 조건을 입력하고 조회 버튼을 눌러주세요.
                  </div>
                )}
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="flex-1 py-2.5 text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 rounded-lg font-medium flex items-center justify-center"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      검색 중...
                    </>
                  ) : (
                    '조회'
                  )}
                </button>
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />

      {/* 경고/알림 팝업 (PaymentInfo 스타일 통일) */}
      {warningPopup.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-base font-medium text-gray-900">{warningPopup.title}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5 whitespace-pre-line">
              {warningPopup.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setWarningPopup({ show: false, title: '', message: '' })}
                className="flex-1 px-4 py-2 text-sm text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerSearch;
