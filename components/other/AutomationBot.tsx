import React, { useState } from 'react';

interface AutomationBotProps {
  onBack: () => void;
}

// Dataset: dsCustList
interface CustListItem {
  CUST_ID: string;
  CUST_NM: string;
  CTRT_ID: string;
  ADDR: string;
  PHONE_NO: string;
  VOIP_TEL_NO: string;
}

// Dataset: ds_gift_lst
interface GiftItem {
  COMMON_CD: string;
  COMMON_CD_NM: string;
}

// Dataset: ds_buga_lst
interface BugaItem {
  COMMON_CD: string;
  COMMON_CD_NM: string;
}

const AutomationBot: React.FC<AutomationBotProps> = ({ onBack }) => {
  const [custNm, setCustNm] = useState('');
  const [telNo, setTelNo] = useState('');
  const [custId, setCustId] = useState('');
  const [custList, setCustList] = useState<CustListItem[]>([]);
  const [selectedCust, setSelectedCust] = useState<CustListItem | null>(null);

  // 봇 종류 선택
  const [selectedBot, setSelectedBot] = useState<'sinho' | 'gift' | 'buga' | null>(null);

  // 사은품/부가 리스트
  const [giftList, setGiftList] = useState<GiftItem[]>([]);
  const [bugaList, setBugaList] = useState<BugaItem[]>([]);
  const [selectedGift, setSelectedGift] = useState('');
  const [selectedBuga, setSelectedBuga] = useState('');

  const handleCustSearch = () => {
    // TODO: API 연동 - 고객 검색
    console.log('고객 검색:', { custNm, telNo, custId });
  };

  const handleCustSelect = (item: CustListItem) => {
    setSelectedCust(item);
  };

  const handleBotSelect = (botType: 'sinho' | 'gift' | 'buga') => {
    setSelectedBot(botType);

    if (botType === 'gift') {
      // TODO: 사은품 목록 로드
      console.log('사은품 목록 로드');
    } else if (botType === 'buga') {
      // TODO: 부가 목록 로드
      console.log('부가 목록 로드');
    }
  };

  const handleRunBot = () => {
    if (!selectedCust) {
      alert('고객을 선택해주세요');
      return;
    }

    if (selectedBot === 'sinho') {
      // TODO: 신호연동봇 수행
      console.log('신호연동봇 수행:', selectedCust);
    } else if (selectedBot === 'gift') {
      if (!selectedGift) {
        alert('사은품을 선택해주세요');
        return;
      }
      // TODO: 사은품접수봇 수행
      console.log('사은품접수봇 수행:', { selectedCust, selectedGift });
    } else if (selectedBot === 'buga') {
      if (!selectedBuga) {
        alert('부가상품을 선택해주세요');
        return;
      }
      // TODO: 부가가입봇 수행
      console.log('부가가입봇 수행:', { selectedCust, selectedBuga });
    }
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-gray-900">자동화봇</h2>
      </div>

      {/* 고객 검색 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">고객명/전화번호</label>
              <input
                type="text"
                value={custNm}
                onChange={(e) => setCustNm(e.target.value.toUpperCase())}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded uppercase"
                placeholder="고객명 또는 전화번호"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
              <input
                type="text"
                value={telNo}
                onChange={(e) => setTelNo(e.target.value.toUpperCase())}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded uppercase"
                placeholder="전화번호"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">고객ID</label>
            <input
              type="text"
              value={custId}
              onChange={(e) => setCustId(e.target.value.toUpperCase())}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded uppercase"
              placeholder="고객ID"
            />
          </div>
          <button
            onClick={handleCustSearch}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium text-sm shadow-md transition-all"
          >
            고객 조회
          </button>
        </div>
      </div>

      {/* 고객 목록 */}
      {custList.length > 0 && (
        <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">고객ID</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">고객명</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">계약ID</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">전화번호</th>
                </tr>
              </thead>
              <tbody>
                {custList.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleCustSelect(item)}
                    className={`cursor-pointer hover:bg-orange-50 transition-colors ${
                      selectedCust?.CUST_ID === item.CUST_ID ? 'bg-orange-100' : ''
                    }`}
                  >
                    <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.CUST_ID}</td>
                    <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.CUST_NM}</td>
                    <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.CTRT_ID}</td>
                    <td className="px-2 py-2 text-xs text-gray-900 border-b">{item.PHONE_NO}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 봇 선택 버튼들 */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => handleBotSelect('sinho')}
          className={`h-28 rounded-lg font-bold text-sm shadow-md transition-all ${
            selectedBot === 'sinho'
              ? 'bg-green-600 text-white ring-4 ring-green-300'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
          }`}
        >
          신호연동
          <br />봇
        </button>
        <button
          onClick={() => handleBotSelect('gift')}
          className={`h-28 rounded-lg font-bold text-sm shadow-md transition-all ${
            selectedBot === 'gift'
              ? 'bg-green-600 text-white ring-4 ring-green-300'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
          }`}
        >
          사은품접수
          <br />봇
        </button>
        <button
          onClick={() => handleBotSelect('buga')}
          className={`h-28 rounded-lg font-bold text-sm shadow-md transition-all ${
            selectedBot === 'buga'
              ? 'bg-green-600 text-white ring-4 ring-green-300'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
          }`}
        >
          부가가입
          <br />봇
        </button>
      </div>

      {/* 사은품 선택 (사은품접수봇 선택시) */}
      {selectedBot === 'gift' && (
        <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">사은품 선택</label>
          <select
            value={selectedGift}
            onChange={(e) => setSelectedGift(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          >
            <option value="">선택</option>
            {giftList.map((item) => (
              <option key={item.COMMON_CD} value={item.COMMON_CD}>
                {item.COMMON_CD_NM}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 부가 선택 (부가가입봇 선택시) */}
      {selectedBot === 'buga' && (
        <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">부가상품 선택</label>
          <select
            value={selectedBuga}
            onChange={(e) => setSelectedBuga(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
          >
            <option value="">선택</option>
            {bugaList.map((item) => (
              <option key={item.COMMON_CD} value={item.COMMON_CD}>
                {item.COMMON_CD_NM}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 봇 실행 버튼 */}
      {selectedBot && (
        <div className="flex justify-center">
          <button
            onClick={handleRunBot}
            className="w-64 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-bold text-base shadow-lg transition-all"
          >
            {selectedBot === 'sinho' && '신호연동봇 수행'}
            {selectedBot === 'gift' && '사은품접수봇 수행'}
            {selectedBot === 'buga' && '부가가입봇 수행'}
          </button>
        </div>
      )}

      {!selectedCust && custList.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-center text-gray-500 text-sm">
            고객을 검색하고 봇 종류를 선택한 후 실행하세요
          </p>
        </div>
      )}
    </div>
  );
};

export default AutomationBot;
