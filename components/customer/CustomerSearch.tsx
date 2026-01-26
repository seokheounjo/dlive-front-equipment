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
  // 검색 유형 - 기본값: 고객ID 검색
  const [searchType, setSearchType] = useState<SearchType>('CUSTOMER_ID');

  // 검색 입력값 - 테스트용 기본값
  // 테스트용 고객: 푸꾸옥(1001857577), 하노이(1001857578), 가나다(1001846265)
  // 푸꾸옥 전화번호: 010-5134-6878, 장비번호: 000770BCF954
  const DEFAULT_VALUES = {
    phoneNumber: '01051346878',
    customerName: '푸꾸옥',
    customerId: '1001857577',
    contractId: '1003687719',
    equipmentNo: '000770BCF954'
  };

  const [phoneNumber, setPhoneNumber] = useState(DEFAULT_VALUES.phoneNumber);
  const [customerName, setCustomerName] = useState(DEFAULT_VALUES.customerName);
  const [customerId, setCustomerId] = useState(DEFAULT_VALUES.customerId);
  const [contractId, setContractId] = useState(DEFAULT_VALUES.contractId);
  const [equipmentNo, setEquipmentNo] = useState(DEFAULT_VALUES.equipmentNo);

  // 상태
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // 검색 유형 변경 핸들러
  const handleSearchTypeChange = (type: SearchType) => {
    setSearchType(type);
    // 입력값을 기본값으로 복원 (초기화하지 않음)
    setPhoneNumber(DEFAULT_VALUES.phoneNumber);
    setCustomerName(DEFAULT_VALUES.customerName);
    setCustomerId(DEFAULT_VALUES.customerId);
    setContractId(DEFAULT_VALUES.contractId);
    setEquipmentNo(DEFAULT_VALUES.equipmentNo);
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

  // 검색 결과 초기화 (기본값으로 복원)
  const handleClear = () => {
    setPhoneNumber(DEFAULT_VALUES.phoneNumber);
    setCustomerName(DEFAULT_VALUES.customerName);
    setCustomerId(DEFAULT_VALUES.customerId);
    setContractId(DEFAULT_VALUES.contractId);
    setEquipmentNo(DEFAULT_VALUES.equipmentNo);
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
      <div className="p-3 border-b border-gray-200">
        <div className="flex gap-1.5">
          <button
            onClick={() => handleSearchTypeChange('PHONE_NAME')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              searchType === 'PHONE_NAME'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전화/이름
          </button>
          <button
            onClick={() => handleSearchTypeChange('CUSTOMER_ID')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              searchType === 'CUSTOMER_ID'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            고객ID
          </button>
          <button
            onClick={() => handleSearchTypeChange('CONTRACT_ID')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              searchType === 'CONTRACT_ID'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            계약ID
          </button>
          <button
            onClick={() => handleSearchTypeChange('EQUIPMENT_NO')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              searchType === 'EQUIPMENT_NO'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            장비
          </button>
        </div>
      </div>

      {/* 검색 입력 필드 */}
      <div className="p-3 border-b border-gray-200">
        {searchType === 'PHONE_NAME' && (
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyPress={handleKeyPress}
              placeholder="전화번호"
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="고객명"
              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {searchType === 'CUSTOMER_ID' && (
          <div>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="고객ID 입력"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {searchType === 'CONTRACT_ID' && (
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="계약ID 입력"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        )}

        {searchType === 'EQUIPMENT_NO' && (
          <input
            type="text"
            value={equipmentNo}
            onChange={(e) => setEquipmentNo(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="S/N 또는 MAC"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        )}

        {/* 검색 버튼 */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                검색중
              </>
            ) : (
              '검색'
            )}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 검색 결과 */}
      {hasSearched && (
        <div className="p-3">
          {searchResults.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {searchResults.map((customer, index) => (
                <button
                  key={customer.CUST_ID || index}
                  onClick={() => handleSelectCustomer(customer)}
                  className="w-full p-2.5 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-800">{customer.CUST_NM}</span>
                        <span className="text-gray-500">{customer.CUST_ID}</span>
                        <span className="text-gray-600">{formatPhoneNumber(customer.TEL_NO || customer.HP_NO)}</span>
                      </div>
                      {customer.INST_ADDR && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{customer.INST_ADDR}</div>
                      )}
                    </div>
                    {customer.UNPAY_AMT > 0 && (
                      <span className="text-red-500 text-xs font-medium whitespace-nowrap">
                        {customer.UNPAY_AMT.toLocaleString()}원
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 text-sm">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
