import React, { useState } from 'react';

interface CustomerInfoManagementProps {
  onBack: () => void;
}

// Dataset: ds_cust_info_p
interface CustInfo {
  CUST_ID: string;
  CUST_NM: string;
  CUST_TP: string;
  ADDR_FULL: string;
  STREET_ADDR_FULL: string;
}

// Dataset: ds_ctrt_info_p
interface CtrtInfo {
  CTRT_ID: string;
  BASIC_PROD_CD: string;
  BASIC_PROD_CD_NM: string;
  CTRT_STAT: string;
  CTRT_STAT_NM: string;
  OPEN_DD: string;
  ADDR: string;
}

// Dataset: ds_pym_acnt_info_p
interface PymAcntInfo {
  PYM_ACNT_ID: string;
  ACNT_NM: string;
  PYM_MTHD_NM: string;
  ADDR: string;
}

const CustomerInfoManagement: React.FC<CustomerInfoManagementProps> = ({ onBack }) => {
  const [custId, setCustId] = useState('');
  const [custInfo, setCustInfo] = useState<CustInfo | null>(null);
  const [ctrtList, setCtrtList] = useState<CtrtInfo[]>([]);
  const [pymAcntList, setPymAcntList] = useState<PymAcntInfo[]>([]);
  const [showStreetAddr, setShowStreetAddr] = useState(false);

  const handleSearch = () => {
    // TODO: API 연동 - getCustInfo
    console.log('고객 조회:', custId);
  };

  const displayAddr = custInfo ? (showStreetAddr ? custInfo.STREET_ADDR_FULL : custInfo.ADDR_FULL) : '';

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">고객·계약조회</h2>
      </div>

      {/* 검색 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">고객번호</label>
            <input
              type="text"
              value={custId}
              onChange={(e) => setCustId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              placeholder="고객번호 입력"
              maxLength={10}
            />
          </div>
          <div className="pt-6">
            <button
              onClick={handleSearch}
              className="bg-orange-500 hover:bg-orange-600 text-white py-1.5 px-4 rounded font-medium text-sm shadow-md transition-all"
            >
              조회
            </button>
          </div>
        </div>
      </div>

      {/* 고객 기본 정보 */}
      {custInfo ? (
        <>
          <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">고객명</label>
                <input
                  type="text"
                  value={custInfo.CUST_NM}
                  readOnly
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">기본주소</label>
                <textarea
                  value={displayAddr}
                  readOnly
                  rows={3}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 resize-none"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showStreetAddr"
                  checked={showStreetAddr}
                  onChange={(e) => setShowStreetAddr(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="showStreetAddr" className="text-xs text-gray-700">도로명</label>
              </div>
            </div>
          </div>

          {/* 계약 정보 그리드 */}
          {ctrtList.length > 0 && (
            <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">상품명</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">계약상태</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">개통일</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">설치주소</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctrtList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.BASIC_PROD_CD_NM}</td>
                        <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.CTRT_STAT_NM}</td>
                        <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{item.OPEN_DD}</td>
                        <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.ADDR}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 납입 정보 그리드 */}
          {pymAcntList.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">납입계좌명</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">납입계좌ID</th>
                      <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">납입방법</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">청구주소</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pymAcntList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.ACNT_NM}</td>
                        <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{item.PYM_ACNT_ID}</td>
                        <td className="px-2 py-2 text-xs text-center text-gray-900 border-b">{item.PYM_MTHD_NM}</td>
                        <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.ADDR}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-center text-gray-500 text-sm">조회된 결과가 없습니다</p>
        </div>
      )}
    </div>
  );
};

export default CustomerInfoManagement;
