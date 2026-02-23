/**
 * OttSerialModal.tsx
 * OTT BOX 시리얼번호 입력 모달
 *
 * 레거시 참조: mowoa01p12.xml (일반 OTT BOX), mowoa01p13.xml (판매용 OTT)
 *
 * 표시 조건:
 * - PROD_CD == "PD10018480" (OTT판매/할당)
 * - OR prod_promo_info에 "PD10018160" (편채널_Netflix OTT STB) 포함
 */
import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import BaseModal from '../common/BaseModal';
import { getOttSale, saveOttSale, getOttSerno, getOttType, OttSernoItem } from '../../services/apiService';
import '../../styles/buttons.css';

interface OttSerialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (serialNo: string) => void;
  wrkId: string;
  wrkDrctnId: string;
  crrId?: string;
  wrkrId?: string;
  dataType: 'B' | 'C';  // B=일반 OTT BOX, C=판매용 OTT
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  readOnly?: boolean;
}

const OttSerialModal: React.FC<OttSerialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  wrkId,
  wrkDrctnId,
  crrId,
  wrkrId,
  dataType,
  showToast,
  readOnly = false
}) => {
  const [serialNo, setSerialNo] = useState('');
  const [searchResults, setSearchResults] = useState<OttSernoItem[]>([]);
  const [ottType, setOttType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // 기존 시리얼 조회 및 OTT 타입 조회
  useEffect(() => {
    if (isOpen && wrkId && wrkDrctnId) {
      loadExistingSerial();
      if (dataType === 'C') {
        loadOttType();
      }
    }
  }, [isOpen, wrkId, wrkDrctnId, dataType]);

  const loadExistingSerial = async () => {
    try {
      const result = await getOttSale({
        WRK_ID: wrkId,
        WRK_DRCTN_ID: wrkDrctnId,
        DATA_TYPE: dataType,
      });
      if (result?.EQT_SERNO) {
        setSerialNo(result.EQT_SERNO);
      }
    } catch (error) {
      console.error('[OttSerialModal] 기존 시리얼 조회 실패:', error);
    }
  };

  const loadOttType = async () => {
    try {
      const result = await getOttType({ WRK_ID: wrkId });
      if (result?.OTT_TYPE) {
        setOttType(result.OTT_TYPE);
      } else {
        // OTT 타입이 없으면 경고 후 닫기
        showToast?.('OTT BOX 판매정보가 등록되지 않았습니다. 판매정보 등록을 완료 처리 하시기 바랍니다.', 'warning');
        onClose();
      }
    } catch (error) {
      console.error('[OttSerialModal] OTT 타입 조회 실패:', error);
    }
  };

  // 시리얼 검색
  const handleSearch = async () => {
    if (!serialNo.trim()) {
      showToast?.('OTT BOX 시리얼번호를 입력하세요.', 'warning');
      return;
    }

    setIsSearching(true);
    try {
      const params: any = {
        EQT_SERNO: serialNo,
        DATA_TYPE: dataType,
      };

      // 판매용 OTT는 추가 파라미터 필요
      if (dataType === 'C') {
        params.CRR_ID = crrId || '';
        params.OTT_TYPE = ottType;
        params.WRKR_ID = wrkrId || '';
      }

      const results = await getOttSerno(params);

      // 판매용 OTT는 EQT_STAT='OK'인 것만 필터
      const filtered = dataType === 'C'
        ? results.filter(item => item.EQT_STAT === 'OK')
        : results;

      setSearchResults(filtered);

      if (filtered.length === 0) {
        showToast?.('검색 결과가 없습니다.', 'info');
      }
    } catch (error) {
      console.error('[OttSerialModal] 시리얼 검색 실패:', error);
      showToast?.('시리얼 검색 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // 검색 결과 선택
  const handleSelectSerial = (item: OttSernoItem) => {
    setSerialNo(item.EQT_SERNO || '');
  };

  // 저장
  const handleSave = async () => {
    if (!serialNo.trim()) {
      showToast?.('OTT BOX 시리얼번호를 입력하세요.', 'warning');
      return;
    }

    // 판매용 OTT는 조회 후 저장 필수
    if (dataType === 'C' && searchResults.length < 1) {
      showToast?.('먼저 조회하신 후 저장하시기 바랍니다.', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};

      const result = await saveOttSale({
        WRK_ID: wrkId,
        WRK_DRCTN_ID: wrkDrctnId,
        EQT_SERNO: serialNo,
        DATA_TYPE: dataType,
        REG_UID: user.userId || '',
      });

      if (result.code === 'SUCCESS' || result.code === 'OK') {
        showToast?.('OTT 시리얼번호가 저장되었습니다.', 'success');
        onSave(serialNo);
        onClose();
      } else {
        showToast?.(result.message || '저장에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      console.error('[OttSerialModal] 저장 실패:', error);
      showToast?.(error.message || '저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Enter 키로 검색
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={dataType === 'C' ? '판매용 OTT 시리얼번호 입력' : 'OTT 시리얼번호 입력'}
      maxWidth="md"
    >
      <div className="p-4 space-y-4">
        {/* 시리얼번호 입력 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            BOX S/N
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="시리얼번호 입력"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              readOnly={readOnly}
              disabled={readOnly}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || readOnly}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:bg-gray-300"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>조회</span>
            </button>
          </div>
        </div>

        {/* OTT 타입 (판매용만 표시) */}
        {dataType === 'C' && ottType && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              타입
            </label>
            <input
              type="text"
              value={ottType}
              readOnly
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
            />
          </div>
        )}

        {/* 검색 결과 목록 */}
        {searchResults.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              검색 결과 (클릭하여 선택)
            </label>
            <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
              {searchResults.map((item, index) => (
                <div
                  key={index}
                  onClick={() => !readOnly && handleSelectSerial(item)}
                  className={`px-4 py-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                    serialNo === item.EQT_SERNO
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50'
                  } ${readOnly ? 'cursor-not-allowed' : ''}`}
                >
                  <span className="font-medium">{item.EQT_SERNO}</span>
                  {item.EQT_STAT && (
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      item.EQT_STAT === 'OK' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {item.EQT_STAT}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex gap-2 pt-4 border-t">
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={isLoading || !serialNo.trim()}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg"
          >
            {readOnly ? '닫기' : '취소'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default OttSerialModal;
