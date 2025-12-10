import React, { useState } from 'react';

interface CustomerInfoProps {
  onBack: () => void;
}

// Dataset: ds_cust_info_p
interface CustInfo {
  CUST_ID: string;
  CUST_NM: string;
  ADDR_FULL: string;
  STREET_ADDR_FULL: string;
  CUST_TP: string;
}

// Dataset: ds_ctrt_info_p
interface CtrtInfo {
  BASIC_PROD_CD: string;
  BASIC_PROD_CD_NM: string;
  CTRT_STAT: string;
  CTRT_STAT_NM: string;
  OPEN_DD: string;
  CMPL_DD: string;
  ADDR: string;
}

// Dataset: ds_pym_acnt_info_p
interface PymAcntInfo {
  ACNT_NM: string;
  PYM_ACNT_ID: string;
  PYM_MTHD_NM: string;
  ADDR: string;
}

const CustomerInfo: React.FC<CustomerInfoProps> = ({ onBack }) => {
  const [custId, setCustId] = useState('');
  const [custInfo, setCustInfo] = useState<CustInfo | null>(null);
  const [ctrtInfoList, setCtrtInfoList] = useState<CtrtInfo[]>([]);
  const [pymAcntInfoList, setPymAcntInfoList] = useState<PymAcntInfo[]>([]);
  const [useStreetAddr, setUseStreetAddr] = useState(false);

  const handleSearch = () => {
    // TODO: API 연동 - getCustInfo, customerPymInfo, getCustCtrtAll
    console.log('고객정보 조회:', custId);
  };

  const getDisplayAddr = () => {
    if (!custInfo) return '';
    return useStreetAddr ? custInfo.STREET_ADDR_FULL : custInfo.ADDR_FULL;
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">고객정보조회</h2>
      </div>

      {/* 검색 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">고객번호</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={custId}
                onChange={(e) => setCustId(e.target.value)}
                maxLength={10}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
                placeholder="고객번호 입력"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded font-medium shadow-md transition-all"
              >
                조회
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 고객 기본정보 */}
      {custInfo && (
        <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">고객명</label>
            <input
              type="text"
              value={custInfo.CUST_NM || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">고객주소</label>
            <textarea
              value={getDisplayAddr()}
              readOnly
              rows={3}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 resize-none"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="street_addr"
              checked={useStreetAddr}
              onChange={(e) => setUseStreetAddr(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="street_addr" className="text-xs text-gray-700">
              도로명
            </label>
          </div>
        </div>
      )}

      {/* 계약정보 목록 */}
      {ctrtInfoList.length > 0 && (
        <>
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-gray-700">계약정보</h3>
          </div>
          <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">상품명</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">계약상태</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">개통일</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">설치주소</th>
                  </tr>
                </thead>
                <tbody>
                  {ctrtInfoList.map((item, idx) => (
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
        </>
      )}

      {/* 납부계정정보 목록 */}
      {pymAcntInfoList.length > 0 && (
        <>
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-gray-700">납부계정정보</h3>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">납입계좌명</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">납입계좌ID</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">납입방법</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">청구주소</th>
                  </tr>
                </thead>
                <tbody>
                  {pymAcntInfoList.map((item, idx) => (
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
        </>
      )}

      {!custInfo && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-center text-gray-500 text-sm">고객번호를 입력하고 조회 버튼을 눌러주세요</p>
        </div>
      )}
    </div>
  );
};

export default CustomerInfo;
