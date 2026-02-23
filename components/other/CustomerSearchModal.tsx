import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import {
  searchCustByPhone,
  searchCustById,
  searchCustByCtrtId,
  searchCustByEqtNo,
  CustomerSearchResult,
} from '../../services/apiService';

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: CustomerSearchResult) => void;
}

const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
}) => {
  const [custId, setCustId] = useState('');
  const [ctrtId, setCtrtId] = useState('');
  const [phoneNo, setPhoneNo] = useState('');
  const [eqtNo, setEqtNo] = useState('');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleReset = () => {
    setCustId('');
    setCtrtId('');
    setPhoneNo('');
    setEqtNo('');
    setResults([]);
    setSearched(false);
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setSearched(true);
    setResults([]);

    try {
      let data: CustomerSearchResult[] = [];

      if (ctrtId.trim()) {
        data = await searchCustByCtrtId(ctrtId.trim());
      } else if (custId.trim()) {
        data = await searchCustById(custId.trim());
      } else if (phoneNo.trim()) {
        data = await searchCustByPhone(phoneNo.trim());
      } else if (eqtNo.trim()) {
        data = await searchCustByEqtNo(eqtNo.trim());
      } else {
        alert('검색 조건을 입력하세요.');
        setIsLoading(false);
        return;
      }

      setResults(data);
    } catch (err) {
      console.error('Customer search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (item: CustomerSearchResult) => {
    // 계약ID로 검색한 경우, 결과에 CTRT_ID가 없으면 검색한 CTRT_ID를 세팅
    const enrichedItem = { ...item };
    if (ctrtId.trim() && !enrichedItem.CTRT_ID) {
      enrichedItem.CTRT_ID = ctrtId.trim();
    }
    onSelectCustomer(enrichedItem);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-blue-500 rounded-t-xl">
          <h3 className="text-white font-bold text-base">고객 검색</h3>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1 text-xs bg-white/20 text-white rounded-full hover:bg-white/30"
            >
              리셋
            </button>
            <button onClick={onClose} className="text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Fields */}
        <div className="p-4 space-y-3 border-b">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-16 flex-shrink-0">고객ID</label>
            <input
              type="text"
              value={custId}
              onChange={(e) => setCustId(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="고객ID 입력"
              maxLength={10}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-16 flex-shrink-0">계약ID</label>
            <input
              type="text"
              value={ctrtId}
              onChange={(e) => setCtrtId(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="계약ID 입력"
              maxLength={15}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-16 flex-shrink-0">전화번호</label>
            <input
              type="tel"
              value={phoneNo}
              onChange={(e) => setPhoneNo(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="전화번호 입력"
              maxLength={15}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-16 flex-shrink-0">S/N</label>
            <input
              type="text"
              value={eqtNo}
              onChange={(e) => setEqtNo(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
              placeholder="장비번호 입력"
              maxLength={20}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              조회
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium text-sm"
            >
              닫기
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-3 border-blue-500 border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-500">검색 중...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-2">검색결과 {results.length}건</p>
              {results.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.CUST_NM || '-'} <span className="text-gray-400 text-xs">({item.CUST_ID})</span>
                      </p>
                      {item.CTRT_ID && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          계약: {item.CTRT_ID} | {item.BASIC_PROD_CD_NM || item.PROD_NM || '-'}
                        </p>
                      )}
                      {item.ADDR && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{item.ADDR}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {item.CTRT_STAT_NM && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {item.CTRT_STAT_NM}
                        </span>
                      )}
                      {item.SO_NM && (
                        <p className="text-xs text-gray-400 mt-1">{item.SO_NM}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searched ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">검색 조건을 입력하고 조회 버튼을 눌러주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerSearchModal;
