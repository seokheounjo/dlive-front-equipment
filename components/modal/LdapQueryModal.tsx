import React, { useState, useEffect, useCallback } from 'react';
import { getUplsLdapInfo } from '../../services/certifyApiService';
import BaseModal from '../common/BaseModal';
import '../../styles/buttons.css';

interface LdapQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctrtId: string;
  entrNo?: string;
  apMac?: string;
  ontMac?: string;
}

type SearchMode = 'A' | 'B' | 'C';

interface LdapResult {
  AP_MAC: string;
  ONT_MAC: string;
  ENTR_NO: string;
  L2_INFO: string;
  OLT_INFO: string;
  LDAP_DATE: string;
}

const LdapQueryModal: React.FC<LdapQueryModalProps> = ({
  isOpen,
  onClose,
  ctrtId,
  entrNo = '',
  apMac = '',
  ontMac = '',
}) => {
  const [searchMode, setSearchMode] = useState<SearchMode>('A');
  const [searchValue, setSearchValue] = useState('');
  const [result, setResult] = useState<LdapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때 기본값 세팅 + 자동 조회
  useEffect(() => {
    if (isOpen) {
      setSearchMode('A');
      setSearchValue(entrNo);
      setResult(null);
      setError(null);
      // 가입자번호가 있으면 자동 조회
      if (entrNo.trim()) {
        handleSearch('A', entrNo);
      }
    }
  }, [isOpen, entrNo]); // eslint-disable-line react-hooks/exhaustive-deps

  // 라디오 변경 시 해당 기본값 자동 입력
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setResult(null);
    setError(null);
    if (mode === 'A') setSearchValue(entrNo);
    else if (mode === 'B') setSearchValue(apMac);
    else if (mode === 'C') setSearchValue(ontMac);
  };

  const handleSearch = useCallback(async (mode?: SearchMode, value?: string) => {
    const actualMode = mode ?? searchMode;
    const actualValue = value ?? searchValue;

    if (!actualValue.trim()) {
      setError('검색값을 입력하세요');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await getUplsLdapInfo({
        searchMode: actualMode,
        searchValue: actualValue.trim(),
        ctrtId: ctrtId || '',
        entrNo: entrNo || '',
      });

      if (res.success && res.data) {
        setResult({
          AP_MAC: res.data.AP_MAC || '',
          ONT_MAC: res.data.ONT_MAC || '',
          ENTR_NO: res.data.ENTR_NO || '',
          L2_INFO: res.data.L2_INFO || '',
          OLT_INFO: res.data.OLT_INFO || '',
          LDAP_DATE: res.data.LDAP_DATE || '',
        });
      } else {
        setError(res.message || 'LDAP 정보가 존재하지 않습니다');
      }
    } catch (err) {
      console.error('[LDAP현황] 조회 실패:', err);
      setError('조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [searchMode, searchValue, ctrtId, entrNo]);

  const modeLabels: { mode: SearchMode; label: string }[] = [
    { mode: 'A', label: '가입자번호' },
    { mode: 'B', label: 'AP MAC' },
    { mode: 'C', label: 'ONT MAC' },
  ];

  const footer = (
    <button onClick={onClose} className="btn btn-secondary btn-sm">
      닫기
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="LDAP 현황"
      size="medium"
      footer={footer}
    >
      <div className="space-y-3 p-2.5">
        {/* 검색구분 라디오 */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1.5">검색구분</div>
          <div className="flex gap-3">
            {modeLabels.map(({ mode, label }) => (
              <label key={mode} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="ldapSearchMode"
                  checked={searchMode === mode}
                  onChange={() => handleModeChange(mode)}
                  className="w-3.5 h-3.5 text-primary-700"
                />
                <span className="text-xs text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 검색값 입력 + 조회 버튼 */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1.5">검색값</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchMode === 'A' ? '가입자번호' : searchMode === 'B' ? 'AP MAC 주소' : 'ONT MAC 주소'}
              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="btn btn-primary btn-sm whitespace-nowrap"
            >
              {loading ? '조회중...' : '조회'}
            </button>
          </div>
        </div>

        {/* 조회결과 */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-1.5">조회결과</div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="text-gray-500 text-xs">조회 중...</div>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-red-600 text-xs text-center">{error}</div>
            </div>
          )}

          {!loading && !error && !result && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="text-gray-400 text-xs text-center">조회 버튼을 눌러주세요</div>
            </div>
          )}

          {!loading && result && (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {[
                { label: 'AP MAC', value: result.AP_MAC },
                { label: 'ONT MAC', value: result.ONT_MAC },
                { label: '가입자번호', value: result.ENTR_NO },
                { label: 'L2 정보', value: result.L2_INFO },
                { label: 'OLT/ONU', value: result.OLT_INFO },
                { label: 'LDAP일시', value: result.LDAP_DATE },
              ].map(({ label, value }) => (
                <div key={label} className="flex px-2.5 py-1.5">
                  <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
                  <span className="text-xs text-gray-900 font-medium break-all">{value || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
};

export default LdapQueryModal;
