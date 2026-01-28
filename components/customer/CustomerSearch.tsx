import React, { useState } from 'react';
import { Search, Loader2, X, User } from 'lucide-react';
import { searchCustomer, CustomerInfo, formatPhoneNumber } from '../../services/customerApi';
import BarcodeScanner from '../equipment/BarcodeScanner';

interface CustomerSearchProps {
  onCustomerSelect: (customer: CustomerInfo) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer?: CustomerInfo | null;
}

type SearchTab = 'PHONE_NAME' | 'CUSTOMER_ID' | 'CONTRACT_ID' | 'EQUIPMENT_NO';

/**
 * 고객 검색 컴포넌트
 * - 메인: readonly 입력창 (클릭하면 팝업)
 * - 팝업: 탭 형태 검색 UI
 */
const CustomerSearch: React.FC<CustomerSearchProps> = ({ onCustomerSelect, showToast, selectedCustomer }) => {
  // 팝업 표시 상태
  const [showModal, setShowModal] = useState(false);

  // 검색 탭
  const [activeTab, setActiveTab] = useState<SearchTab>('PHONE_NAME');

  // 검색 입력값 - 테스트용 기본값
  const [phoneNumber, setPhoneNumber] = useState('01051346878');
  const [customerName, setCustomerName] = useState('푸꾸옥');
  const [customerId, setCustomerId] = useState('1001857577');
  const [contractId, setContractId] = useState('1003687719');
  const [equipmentNo, setEquipmentNo] = useState('S123456789');

  // 상태
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // 탭 목록
  const tabs: { id: SearchTab; label: string }[] = [
    { id: 'PHONE_NAME', label: '전화/이름' },
    { id: 'CUSTOMER_ID', label: '고객ID' },
    { id: 'CONTRACT_ID', label: '계약ID' },
    { id: 'EQUIPMENT_NO', label: '장비' }
  ];

  // 팝업 열기
  const openModal = () => {
    setShowModal(true);
    setSearchResults([]);
    setHasSearched(false);
  };

  // 팝업 닫기
  const closeModal = () => {
    setShowModal(false);
    // 폼 초기화
    setPhoneNumber('');
    setCustomerName('');
    setCustomerId('');
    setContractId('');
    setEquipmentNo('');
    setSearchResults([]);
    setHasSearched(false);
  };

  // 탭 변경
  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    setSearchResults([]);
    setHasSearched(false);
  };

  // 검색 실행
  const handleSearch = async () => {
    // 입력값 검증
    let hasInput = false;
    switch (activeTab) {
      case 'PHONE_NAME':
        hasInput = phoneNumber.length >= 4 || customerName.length >= 2;
        if (!hasInput) {
          showToast?.('전화번호(4자리 이상) 또는 이름(2자 이상)을 입력해주세요.', 'warning');
          return;
        }
        break;
      case 'CUSTOMER_ID':
        hasInput = customerId.length >= 4;
        if (!hasInput) {
          showToast?.('고객ID를 4자리 이상 입력해주세요.', 'warning');
          return;
        }
        break;
      case 'CONTRACT_ID':
        hasInput = contractId.length >= 4;
        if (!hasInput) {
          showToast?.('계약ID를 4자리 이상 입력해주세요.', 'warning');
          return;
        }
        break;
      case 'EQUIPMENT_NO':
        hasInput = equipmentNo.length >= 4;
        if (!hasInput) {
          showToast?.('장비번호를 4자리 이상 입력해주세요.', 'warning');
          return;
        }
        break;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await searchCustomer({
        searchType: activeTab,
        phoneNumber: activeTab === 'PHONE_NAME' ? phoneNumber : undefined,
        customerName: activeTab === 'PHONE_NAME' ? customerName : undefined,
        customerId: activeTab === 'CUSTOMER_ID' ? customerId : undefined,
        contractId: activeTab === 'CONTRACT_ID' ? contractId : undefined,
        equipmentNo: activeTab === 'EQUIPMENT_NO' ? equipmentNo : undefined,
      });

      if (response.success && response.data) {
        setSearchResults(response.data);
        if (response.data.length === 0) {
          showToast?.('검색 결과가 없습니다.', 'info');
        }
      } else {
        showToast?.(response.message || '검색에 실패했습니다.', 'error');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Customer search error:', error);
      showToast?.('검색 중 오류가 발생했습니다.', 'error');
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

  // 검색 입력 필드 렌더링
  const renderSearchInput = () => {
    switch (activeTab) {
      case 'PHONE_NAME':
        return (
          <div className="space-y-2">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyPress={handleKeyPress}
              placeholder="전화번호 입력"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="고객명 입력"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        );
      case 'CUSTOMER_ID':
        return (
          <input
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="고객ID 입력"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
      case 'CONTRACT_ID':
        return (
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="계약ID 입력"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
      case 'EQUIPMENT_NO':
        return (
          <div className="flex gap-2">
            <input
              type="text"
              value={equipmentNo}
              onChange={(e) => setEquipmentNo(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="S/N 또는 MAC 주소 입력"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono"
            />
            <button
              onClick={() => setShowScanner(true)}
              className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              스캔
            </button>
          </div>
        );
    }
  };

  return (
    <>
      {/* 메인 화면 - readonly 입력창 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="space-y-3">
          {/* 고객검색 - 클릭하면 팝업 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 w-14 flex-shrink-0">고객검색</label>
            <div
              className="flex-1 flex gap-2 cursor-pointer min-w-0 overflow-hidden"
              onClick={openModal}
            >
              <input
                readOnly
                className="flex-1 min-w-0 px-2 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer truncate"
                placeholder="고객명"
                type="text"
                value={selectedCustomer?.CUST_NM || ''}
              />
              <input
                readOnly
                className="flex-1 min-w-0 px-2 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 cursor-pointer"
                placeholder="고객ID"
                type="text"
                value={selectedCustomer?.CUST_ID || ''}
              />
            </div>
          </div>

          {/* 조회 버튼 */}
          <button
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98]"
            onClick={openModal}
          >
            조회
          </button>
        </div>
      </div>

      {/* 검색 팝업 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col">
            {/* 헤더 */}
            <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-blue-600 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4" />
                  고객 검색
                </h3>
                <button onClick={closeModal} className="text-white/80 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 탭 메뉴 */}
            <div className="p-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex gap-1.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 검색 입력 */}
            <div className="p-3 border-b border-gray-200 flex-shrink-0">
              {renderSearchInput()}

              {/* 검색/초기화 버튼 */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      검색 중...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      검색
                    </>
                  )}
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 검색 결과 */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {hasSearched && (
                <>
                  {searchResults.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 mb-2">검색 결과: {searchResults.length}건</div>
                      {searchResults.map((customer, idx) => (
                        <button
                          key={customer.CUST_ID || idx}
                          onClick={() => handleSelectCustomer(customer)}
                          className="w-full p-3 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 text-left transition-colors"
                        >
                          {/* 1줄: 고객ID + 고객명 */}
                          <div className="flex items-center gap-3">
                            <span className="text-blue-600 font-mono text-sm">{customer.CUST_ID}</span>
                            <span className="font-semibold text-gray-900">{customer.CUST_NM}</span>
                          </div>
                          {/* 2줄: 전화번호 + 주소 */}
                          <div className="mt-1 text-xs text-gray-500">
                            {formatPhoneNumber(customer.TEL_NO || customer.HP_NO)}
                            {customer.CUST_ADDR && ` | ${customer.CUST_ADDR}`}
                          </div>
                          {/* 미납금액 */}
                          {customer.UNPAY_AMT > 0 && (
                            <div className="mt-1 text-xs text-red-500 font-medium">
                              미납: {customer.UNPAY_AMT.toLocaleString()}원
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </>
              )}
              {!hasSearched && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  검색 조건을 입력하고 검색 버튼을 눌러주세요.
                </div>
              )}
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
    </>
  );
};

export default CustomerSearch;
