import React, { useState, useRef } from 'react';
import { Loader2, X, User, AlertCircle } from 'lucide-react';
import { searchCustomerAll, getContractList, CustomerInfo, maskPhoneNumber } from '../../services/customerApi';
import BarcodeScanner from '../equipment/BarcodeScanner';

// ID 포맷 (3-3-4 형식) - 메인 화면 표시용
const formatId = (id: string): string => {
  if (!id) return '-';
  const cleaned = id.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return id;
};

// 숫자만 추출
const extractDigits = (value: string): string => value.replace(/[^0-9]/g, '');

interface CustomerSearchProps {
  onCustomerSelect: (customer: CustomerInfo) => void;
  onCustomerClear?: () => void;  // 고객 선택 해제 (리셋)
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer?: CustomerInfo | null;
}

/**
 * 고객 검색 컴포넌트
 * - 메인: readonly 입력창 (클릭하면 팝업)
 * - 팝업: 모든 검색 필드를 한 화면에 표시
 * - API: CUST_ID + SERCH_GB + LOGIN_ID 파라미터 사용
 */
const CustomerSearch: React.FC<CustomerSearchProps> = ({ onCustomerSelect, onCustomerClear, showToast, selectedCustomer }) => {
  // 팝업 표시 상태
  const [showModal, setShowModal] = useState(false);

  // 검색 입력값
  const [customerId, setCustomerId] = useState('');
  const [contractId, setContractId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [equipmentNo, setEquipmentNo] = useState('');

  // 상태
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // 마지막 검색/선택 시점의 저장된 값 (닫기 후 다시 열면 이 값으로 복원)
  const savedFields = useRef({
    customerId: '',
    contractId: '',
    phoneNumber: '',
    customerName: '',
    equipmentNo: '',
  });

  // 경고 팝업 상태
  const [warningPopup, setWarningPopup] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({ show: false, title: '', message: '' });

  // 팝업 열기 - 저장된 값으로 입력필드 복원
  const openModal = () => {
    setCustomerId(savedFields.current.customerId);
    setContractId(savedFields.current.contractId);
    setPhoneNumber(savedFields.current.phoneNumber);
    setCustomerName(savedFields.current.customerName);
    setEquipmentNo(savedFields.current.equipmentNo);
    setShowModal(true);
  };

  // 팝업 닫기 - 입력필드 변경사항 버리고 저장된 값 유지
  const closeModal = () => {
    setShowModal(false);
  };

  // 리셋 (입력필드만 비움, 저장된 값은 유지 → 닫았다 열면 다시 복원)
  const handleReset = () => {
    // 입력필드만 화면에서 비움
    setCustomerId('');
    setContractId('');
    setPhoneNumber('');
    setCustomerName('');
    setEquipmentNo('');
    // 검색 결과 초기화
    setSearchResults([]);
    setHasSearched(false);
    // 선택된 고객 해제 (기본조회 데이터도 초기화)
    if (onCustomerClear) {
      onCustomerClear();
    }
  };

  // 검색 실행 - 모든 파라미터를 한 번에 전송 (getConditionalCustList3 사용)
  const handleSearch = async () => {
    // 입력된 필드에서 숫자만 추출 (포맷팅 제거)
    let customerIdDigits = extractDigits(customerId);
    let contractIdDigits = extractDigits(contractId);
    const phoneNumberDigits = extractDigits(phoneNumber);

    // 고객ID, 계약ID 앞쪽 0 자동 채움 (10자리 미만이면 앞에 0 추가)
    if (customerIdDigits.length > 0 && customerIdDigits.length < 10) {
      customerIdDigits = customerIdDigits.padStart(10, '0');
      setCustomerId(customerIdDigits);
    }
    if (contractIdDigits.length > 0 && contractIdDigits.length < 10) {
      contractIdDigits = contractIdDigits.padStart(10, '0');
      setContractId(contractIdDigits);
    }

    // 입력된 필드 확인
    const hasCustomerId = customerIdDigits.length >= 4;
    const hasContractId = contractIdDigits.length >= 4;
    const hasPhoneNumber = phoneNumberDigits.length >= 4;
    const hasCustomerName = customerName.length >= 2;
    const hasEquipmentNo = equipmentNo.length >= 4;

    // 이름 1글자 검색 차단 (2글자 이상 필요)
    if (customerName.length === 1) {
      setWarningPopup({
        show: true,
        title: '입력 오류',
        message: '고객명은 2글자 이상 입력해주세요.'
      });
      return;
    }

    // 최소 하나의 조건이 필요
    if (!hasCustomerId && !hasContractId && !hasPhoneNumber && !hasCustomerName && !hasEquipmentNo) {
      setWarningPopup({
        show: true,
        title: '입력 오류',
        message: '검색 조건을 입력해주세요.\n(고객ID/계약ID/장비S/N 4자리, 전화번호 4자리, 이름 2자리)'
      });
      return;
    }

    // 검색 실행 시 현재 입력값을 저장 (닫았다 열면 이 값으로 복원)
    savedFields.current = {
      customerId: customerIdDigits,
      contractId: contractIdDigits,
      phoneNumber,
      customerName,
      equipmentNo,
    };

    setIsSearching(true);
    setHasSearched(true);

    try {
      // 모든 파라미터를 한 번에 전송 (getConditionalCustList3 사용)
      const response = await searchCustomerAll({
        custId: hasCustomerId ? customerIdDigits : undefined,
        contractId: hasContractId ? contractIdDigits : undefined,
        phoneNumber: hasPhoneNumber ? phoneNumberDigits : undefined,
        customerName: hasCustomerName ? customerName : undefined,
        equipmentNo: hasEquipmentNo ? equipmentNo : undefined,
      });

      if (response.success && response.data && response.data.length > 0) {
        let enrichedResults = response.data;

        // 계약ID 검색 시: 검색한 CTRT_ID를 결과에 첨부
        if (hasContractId && enrichedResults.length > 0) {
          enrichedResults = enrichedResults.map(customer => ({
            ...customer,
            CTRT_ID: contractIdDigits,
          }));
        }

        // S/N 검색 시: 계약 목록에서 해당 S/N과 매칭되는 CTRT_ID 찾기
        if (hasEquipmentNo && enrichedResults.length > 0) {
          try {
            const custId = enrichedResults[0].CUST_ID;
            const contractRes = await getContractList(custId);
            if (contractRes.success && contractRes.data) {
              const sn = equipmentNo.toLowerCase();
              const matchingContract = contractRes.data.find(c =>
                c.NOTRECEV?.toLowerCase().includes(sn) ||
                c.EQT_SERNO?.toLowerCase().includes(sn)
              );
              if (matchingContract) {
                enrichedResults = enrichedResults.map(customer => ({
                  ...customer,
                  CTRT_ID: matchingContract.CTRT_ID,
                }));
              }
            }
          } catch (e) {
            console.log('[CustomerSearch] S/N → CTRT_ID lookup failed:', e);
          }
        }

        setSearchResults(enrichedResults);
      } else {
        setSearchResults([]);
        setWarningPopup({
          show: true,
          title: '조회 실패',
          message: '조회대상이 없습니다.\n값을 정확히 입력해주세요.'
        });
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
    // 폼 필드에 선택된 고객 정보 채우기 (포맷팅 적용)
    const newCustId = customer.CUST_ID || '';
    const newPhone = extractDigits(customer.TEL_NO || customer.HP_NO || '');
    const newName = customer.CUST_NM || '';
    const newCtrtId = customer.CTRT_ID || contractId;

    setCustomerId(newCustId);
    setPhoneNumber(newPhone);
    setCustomerName(newName);
    if (customer.CTRT_ID) {
      setContractId(customer.CTRT_ID);
    }

    // 선택한 고객 정보를 저장 (닫았다 열면 이 값으로 복원)
    savedFields.current = {
      customerId: newCustId,
      contractId: newCtrtId,
      phoneNumber: newPhone,
      customerName: newName,
      equipmentNo,
    };

    // S/N으로 검색한 경우 장비번호를 customer 객체에 첨부 (계약현황 검색필드 연동)
    const enrichedCustomer = {
      ...customer,
      EQT_SERNO: equipmentNo || customer.EQT_SERNO || undefined,
    };
    onCustomerSelect(enrichedCustomer);
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
                value={selectedCustomer ? formatId(selectedCustomer.CUST_ID) : ''}
              />
            </div>
          </div>

        </div>
      </div>

      {/* 검색 팝업 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-blue-600 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4" />
                  고객 검색
                </h3>
                <button
                  onClick={handleReset}
                  className="px-3 py-1 text-xs font-medium text-blue-600 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                >
                  리셋
                </button>
              </div>
            </div>

            {/* 검색 입력 영역 */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto min-h-0">
              {/* 고객ID */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">고객ID</label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(extractDigits(e.target.value))}
                  onKeyPress={handleKeyPress}
                  placeholder="0000000000"
                  maxLength={10}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 계약ID */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">계약ID</label>
                <input
                  type="text"
                  value={contractId}
                  onChange={(e) => setContractId(extractDigits(e.target.value))}
                  onKeyPress={handleKeyPress}
                  placeholder="0000000000"
                  maxLength={10}
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
                    onChange={(e) => setPhoneNumber(extractDigits(e.target.value))}
                    onKeyPress={handleKeyPress}
                    placeholder="01000000000"
                    maxLength={11}
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
            </div>

            {/* 조회/닫기 버튼 */}
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

            {/* 검색 결과 - 조회/닫기 버튼 아래 */}
            <div className="px-4 pb-4 flex-shrink-0">
              {hasSearched ? (
                searchResults.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="text-xs text-gray-500 mb-2">검색 결과: {searchResults.length}건</div>
                    {searchResults.map((customer, idx) => (
                      <button
                        key={customer.CUST_ID || idx}
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full p-3 bg-white hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-blue-600 font-mono text-sm">{customer.CUST_ID}</span>
                          <span className="font-semibold text-gray-900">{customer.CUST_NM}</span>
                        </div>
                        {customer.CTRT_ID && (
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="text-gray-400">계약ID:</span> <span className="font-mono">{customer.CTRT_ID}</span>
                          </div>
                        )}
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
                  <div className="text-center py-4 text-gray-500 text-sm border border-gray-200 rounded-lg bg-gray-50">
                    검색 결과가 없습니다.
                  </div>
                )
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                  검색 조건을 입력하고 조회 버튼을 눌러주세요.
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
