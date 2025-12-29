import React, { useState } from 'react';
import { Search, Phone, User, FileText, Cpu, X, Loader2 } from 'lucide-react';
import { searchCustomer, CustomerInfo, formatPhoneNumber } from '../../services/customerApi';

interface CustomerSearchProps {
  onCustomerSelect: (customer: CustomerInfo) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type SearchType = 'PHONE_NAME' | 'CUSTOMER_ID' | 'CONTRACT_ID' | 'EQUIPMENT_NO';

/**
 * 고객 검색 컴포넌트
 *
 * 검색 조건 (3가지 고정 - 회의록 기준):
 * 1. 전화번호 & 이름
 * 2. 고객ID or 계약ID
 * 3. 장비번호 (S/N, MAC)
 */
const CustomerSearch: React.FC<CustomerSearchProps> = ({ onCustomerSelect, showToast }) => {
  // 검색 유형
  const [searchType, setSearchType] = useState<SearchType>('PHONE_NAME');

  // 검색 입력값
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [contractId, setContractId] = useState('');
  const [equipmentNo, setEquipmentNo] = useState('');

  // 상태
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // 검색 유형 변경 핸들러
  const handleSearchTypeChange = (type: SearchType) => {
    setSearchType(type);
    // 입력값 초기화
    setPhoneNumber('');
    setCustomerName('');
    setCustomerId('');
    setContractId('');
    setEquipmentNo('');
    setSearchResults([]);
    setHasSearched(false);
  };

  // 검색 실행
  const handleSearch = async () => {
    // 유효성 검사
    let isValid = false;
    switch (searchType) {
      case 'PHONE_NAME':
        isValid = phoneNumber.length >= 4 || customerName.length >= 2;
        if (!isValid) {
          showToast?.('전화번호(4자리 이상) 또는 이름(2자 이상)을 입력해주세요.', 'warning');
          return;
        }
        break;
      case 'CUSTOMER_ID':
        isValid = customerId.length >= 4;
        if (!isValid) {
          showToast?.('고객ID를 4자리 이상 입력해주세요.', 'warning');
          return;
        }
        break;
      case 'CONTRACT_ID':
        isValid = contractId.length >= 4;
        if (!isValid) {
          showToast?.('계약ID를 4자리 이상 입력해주세요.', 'warning');
          return;
        }
        break;
      case 'EQUIPMENT_NO':
        isValid = equipmentNo.length >= 4;
        if (!isValid) {
          showToast?.('장비번호(S/N 또는 MAC)를 4자리 이상 입력해주세요.', 'warning');
          return;
        }
        break;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await searchCustomer({
        searchType,
        phoneNumber: searchType === 'PHONE_NAME' ? phoneNumber : undefined,
        customerName: searchType === 'PHONE_NAME' ? customerName : undefined,
        customerId: searchType === 'CUSTOMER_ID' ? customerId : undefined,
        contractId: searchType === 'CONTRACT_ID' ? contractId : undefined,
        equipmentNo: searchType === 'EQUIPMENT_NO' ? equipmentNo : undefined,
      });

      if (response.success && response.data) {
        setSearchResults(response.data);
        if (response.data.length === 0) {
          showToast?.('검색 결과가 없습니다.', 'info');
        } else if (response.data.length === 1) {
          // 결과가 1건이면 자동 선택
          onCustomerSelect(response.data[0]);
          showToast?.('고객이 선택되었습니다.', 'success');
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

  // 검색 결과 초기화
  const handleClear = () => {
    setPhoneNumber('');
    setCustomerName('');
    setCustomerId('');
    setContractId('');
    setEquipmentNo('');
    setSearchResults([]);
    setHasSearched(false);
  };

  // 고객 선택
  const handleSelectCustomer = (customer: CustomerInfo) => {
    onCustomerSelect(customer);
    showToast?.(`${customer.CUST_NM} 고객이 선택되었습니다.`, 'success');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* 검색 유형 선택 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-700">고객 검색</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSearchTypeChange('PHONE_NAME')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              searchType === 'PHONE_NAME'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Phone className="w-4 h-4" />
            전화번호 & 이름
          </button>
          <button
            onClick={() => handleSearchTypeChange('CUSTOMER_ID')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              searchType === 'CUSTOMER_ID'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <User className="w-4 h-4" />
            고객ID
          </button>
          <button
            onClick={() => handleSearchTypeChange('CONTRACT_ID')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              searchType === 'CONTRACT_ID'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            계약ID
          </button>
          <button
            onClick={() => handleSearchTypeChange('EQUIPMENT_NO')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              searchType === 'EQUIPMENT_NO'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            장비번호
          </button>
        </div>
      </div>

      {/* 검색 입력 필드 */}
      <div className="p-4 border-b border-gray-200">
        {searchType === 'PHONE_NAME' && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">전화번호</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyPress={handleKeyPress}
                placeholder="010-0000-0000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">고객명</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="홍길동"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {searchType === 'CUSTOMER_ID' && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">고객ID</label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="고객ID 입력"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {searchType === 'CONTRACT_ID' && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">계약ID</label>
            <input
              type="text"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="계약ID 입력"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {searchType === 'EQUIPMENT_NO' && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">장비번호 (S/N 또는 MAC)</label>
            <input
              type="text"
              value={equipmentNo}
              onChange={(e) => setEquipmentNo(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="S/N 또는 MAC 주소 입력"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {/* 검색 버튼 */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                검색 중...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                검색
              </>
            )}
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 검색 결과 */}
      {hasSearched && (
        <div className="p-4">
          {searchResults.length > 0 ? (
            <div>
              <div className="text-sm text-gray-600 mb-3">
                검색 결과: {searchResults.length}건
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((customer, index) => (
                  <button
                    key={customer.CUST_ID || index}
                    onClick={() => handleSelectCustomer(customer)}
                    className="w-full p-3 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-800">
                          {customer.CUST_NM}
                          <span className="ml-2 text-sm text-gray-500">
                            ({customer.CUST_ID})
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {formatPhoneNumber(customer.TEL_NO || customer.HP_NO)}
                        </div>
                        {customer.INST_ADDR && (
                          <div className="text-sm text-gray-500 mt-1 truncate">
                            {customer.INST_ADDR}
                          </div>
                        )}
                      </div>
                      {customer.UNPAY_AMT > 0 && (
                        <div className="text-right">
                          <span className="text-red-500 text-sm font-medium">
                            미납 {customer.UNPAY_AMT.toLocaleString()}원
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>검색 결과가 없습니다.</p>
              <p className="text-sm mt-1">검색 조건을 변경하여 다시 시도해주세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
