import React, { useState, useEffect } from 'react';
import { getEquipmentHistoryInfo, apiRequest, getWrkrHaveEqtList } from '../../services/apiService';

interface EquipmentListProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

// 장비 상세 정보 인터페이스 (75+ fields from legacy)
interface EquipmentDetail {
  // 기본 정보
  EQT_NO: string;
  EQT_SERNO: string;
  MAC_ADDRESS: string;
  BAR_CD: string;
  IRD_SN: string;

  // 장비 유형
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  EQT_TP_CD: string;
  EQT_TP_CD_NM: string;
  ITEM_CD: string;
  ITEM_NM: string;

  // 제조 정보
  MAKER: string;
  MNFCT_DT: string;

  // 상태 정보
  EQT_STAT_CD: string;
  EQT_STAT_CD_NM: string;
  EQT_USE_STAT_CD: string;
  EQT_USE_STAT_CD_NM: string;
  EQT_USE_ARR_YN: string;
  EQT_USE_ARR_YN_NM: string;
  EQT_USE_END_DT: string;

  // 위치 정보
  EQT_LOC_TP_CD: string;
  EQT_LOC_TP_CD_NM: string;
  EQT_LOC_NM: string;
  OLD_EQT_LOC_TP_CD: string;
  OLD_EQT_LOC_TP_CD_NM: string;
  OLD_EQT_LOC_NM: string;

  // 지점/협력사 정보
  SO_ID: string;
  SO_NM: string;
  MST_SO_ID: string;
  MST_SO_NM: string;
  OLD_SO_ID: string;
  OLD_SO_NM: string;
  OLD_MST_SO_ID: string;
  OLD_MST_SO_NM: string;
  CRR_ID: string;
  CRR_NM: string;
  OLD_CRR_ID: string;
  OLD_CRR_NM: string;

  // 작업자 정보
  WRKR_ID: string;
  WRKR_NM: string;
  OLD_WRKR_ID: string;
  OLD_WRKR_NM: string;

  // 고객/계약 정보
  CUST_ID: string;
  CUST_NM: string;
  OLD_CUST_ID: string;
  CTRT_ID: string;

  // 소유/구매 정보
  OWNER_TP_CD: string;
  OWNER_TP_CD_NM: string;
  PRCHS_CL: string;
  PRCHS_CL_NM: string;
  PRCHS_UT_PRC: number;

  // 입고/출고 정보
  FIRST_IN_DT: string;
  IN_GRP_NO: string;
  OUT_REQ_NO: string;

  // 반납/폐기 정보
  RETN_RESN_CD: string;
  RETN_RESN_CD_NM: string;
  OBS_RCPT_CD: string;
  OBS_RCPT_CD_NM: string;
  OBS_RCPT_DTL_CD: string;
  OBS_RCPT_DTL_CD_NM: string;

  // MAC 주소들
  STB_CM_MAC_ADDR: string;
  STB_INTERNAL_MAC_ADDR: string;
  STB_RTCA_ID: string;
  STB_CARTON_NO: string;

  // 변경 정보
  CHG_KND_CD: string;
  CHG_DATE: string;
  CHG_UID: string;
  REG_DATE: string;
  REG_UID: string;

  // 기타
  CCU_NO: string;
  EQT_UNI_ID: string;
  WRK_ID: string;
  CMIS_DATE: string;
  CMIS_REG_FLG: string;
  CMIS_REG_UID: string;
}

const EquipmentList: React.FC<EquipmentListProps> = ({ onBack, showToast }) => {
  const [searchType, setSearchType] = useState<'SN' | 'MAC'>('SN');
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [myEquipments, setMyEquipments] = useState<any[]>([]);
  const [isLoadingMyEquipments, setIsLoadingMyEquipments] = useState(false);

  // 로그인한 사용자 정보 가져오기
  const getLoggedInUser = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.USR_ID || user.WRKR_ID || null;
      }
    } catch (e) {
      console.warn('사용자 정보 파싱 실패:', e);
    }
    return null;
  };

  // 내 보유 장비 목록 로드
  useEffect(() => {
    const loadMyEquipments = async () => {
      const wrkrId = getLoggedInUser();
      if (!wrkrId) return;

      setIsLoadingMyEquipments(true);
      try {
        console.log('📦 [장비목록] 내 보유 장비 로드 중... WRKR_ID:', wrkrId);
        const result = await getWrkrHaveEqtList({ WRKR_ID: wrkrId });
        console.log('📦 [장비목록] 내 보유 장비 응답:', result);

        if (Array.isArray(result)) {
          setMyEquipments(result);
        } else if (result && Array.isArray(result.data)) {
          setMyEquipments(result.data);
        }
      } catch (err) {
        console.warn('내 보유 장비 로드 실패:', err);
      } finally {
        setIsLoadingMyEquipments(false);
      }
    };

    loadMyEquipments();
  }, []);

  // 내 보유 장비에서 검색
  const searchInMyEquipments = (searchVal: string): any | null => {
    const normalizedSearch = searchVal.toUpperCase().replace(/[:-]/g, '');

    for (const eq of myEquipments) {
      // S/N 검색
      const serno = (eq.EQT_SERNO || eq.SERIAL_NO || eq.SN || '').toUpperCase().replace(/[:-]/g, '');
      if (serno && serno.includes(normalizedSearch)) {
        return eq;
      }

      // MAC 검색
      const mac = (eq.MAC_ADDRESS || eq.MAC || eq.MAC_ADDR || '').toUpperCase().replace(/[:-]/g, '');
      if (mac && mac.includes(normalizedSearch)) {
        return eq;
      }

      // EQT_NO 검색
      const eqtNo = (eq.EQT_NO || '').toUpperCase();
      if (eqtNo && eqtNo.includes(normalizedSearch)) {
        return eq;
      }
    }

    return null;
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      showToast?.('검색어를 입력해주세요.', 'warning');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEquipmentDetail(null);
    setRawResponse(null);

    const searchVal = searchValue.toUpperCase().replace(/[:-]/g, '');
    console.log('🔍 [장비목록] 검색 시작:', { searchType, searchValue: searchVal });

    const allResponses: any[] = [];

    // 1. 먼저 내 보유 장비에서 검색 시도
    if (myEquipments.length > 0) {
      console.log('🔍 [장비목록] 내 보유 장비에서 검색 시도...');
      const foundInMy = searchInMyEquipments(searchVal);
      if (foundInMy) {
        console.log('✅ [장비목록] 내 보유 장비에서 발견:', foundInMy);
        setEquipmentDetail(foundInMy as EquipmentDetail);
        setRawResponse({ successApi: 'myEquipments', data: foundInMy, source: '내 보유 장비' });
        showToast?.('장비 정보를 조회했습니다. (내 보유 장비)', 'success');
        setIsLoading(false);
        return;
      }
      allResponses.push({ api: 'myEquipments', status: 'not_found' });
    }

    // 2. API를 통한 검색 시도
    const apiAttempts = [
      // 1. 장비 이력 조회 API (statistics)
      {
        name: 'getEquipmentHistoryInfo',
        call: () => getEquipmentHistoryInfo(
          searchType === 'SN' ? { EQT_SERNO: searchVal } : { MAC_ADDRESS: searchVal }
        )
      },
      // 2. EQT_NO로 직접 조회
      {
        name: 'getEquipmentHistoryInfo (EQT_NO)',
        call: () => apiRequest('/statistics/equipment/getEquipmentHistoryInfo', 'POST', {
          EQT_NO: searchVal
        })
      },
      // 3. 직접 API 호출 - SERIAL_NO 파라미터
      {
        name: 'getEquipmentHistoryInfo (SERIAL_NO)',
        call: () => apiRequest('/statistics/equipment/getEquipmentHistoryInfo', 'POST', {
          SERIAL_NO: searchVal
        })
      },
      // 4. 직접 API 호출 - MAC_ADDR 파라미터
      {
        name: 'getEquipmentHistoryInfo (MAC_ADDR)',
        call: () => apiRequest('/statistics/equipment/getEquipmentHistoryInfo', 'POST', {
          MAC_ADDR: searchVal
        })
      },
      // 5. 장비 상태 조회 API
      {
        name: 'getEquipmentStatus',
        call: () => apiRequest('/customer/equipment/getStatus', 'POST', {
          EQT_SERNO: searchVal,
          SERIAL_NO: searchVal,
          EQT_NO: searchVal
        })
      },
    ];

    for (const attempt of apiAttempts) {
      try {
        console.log(`🔍 [장비목록] ${attempt.name} 시도...`);
        const result = await attempt.call();
        console.log(`✅ [장비목록] ${attempt.name} 응답:`, result);

        allResponses.push({ api: attempt.name, response: result });

        // 유효한 응답인지 확인
        if (result && typeof result === 'object') {
          // 에러 응답이 아니고 데이터가 있으면 성공
          if (!result.code || result.code === 'SUCCESS') {
            // 배열이면 첫 번째 항목 사용
            const data = Array.isArray(result) ? result[0] : result;
            if (data && Object.keys(data).length > 0 && !data.code) {
              setEquipmentDetail(data as EquipmentDetail);
              setRawResponse({ successApi: attempt.name, data: result, allAttempts: allResponses });
              showToast?.('장비 정보를 조회했습니다.', 'success');
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [장비목록] ${attempt.name} 실패:`, err.message);
        allResponses.push({ api: attempt.name, error: err.message });
      }
    }

    // 모든 시도 실패
    setRawResponse({ allAttempts: allResponses });
    setError('장비 정보를 찾을 수 없습니다. S/N 또는 MAC 주소를 확인해주세요.\n\n참고: 현재 장비 원장 조회 API가 정상 동작하지 않습니다. 내 보유 장비에서만 검색이 가능합니다.');
    showToast?.('장비 정보를 찾을 수 없습니다.', 'error');
    setIsLoading(false);
  };

  // 정보 필드 렌더링 헬퍼
  const InfoRow: React.FC<{ label: string; value: string | number | undefined | null }> = ({ label, value }) => (
    <div className="flex border-b border-gray-100 py-1.5">
      <span className="w-28 flex-shrink-0 text-xs text-gray-500">{label}</span>
      <span className="flex-1 text-xs text-gray-900 font-medium break-all">{value || '-'}</span>
    </div>
  );

  // 섹션 헤더
  const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <div className="bg-gray-100 px-3 py-2 -mx-3 mt-3 mb-2 first:mt-0">
      <h4 className="text-xs font-bold text-gray-700">{title}</h4>
    </div>
  );

  return (
    <div className="p-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">장비목록</h2>
          {isLoadingMyEquipments ? (
            <p className="text-xs text-gray-500">내 보유 장비 로딩 중...</p>
          ) : myEquipments.length > 0 ? (
            <p className="text-xs text-green-600">내 보유 장비: {myEquipments.length}건 (로컬 검색 가능)</p>
          ) : (
            <p className="text-xs text-gray-500">내 보유 장비 없음</p>
          )}
        </div>
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          ← 뒤로
        </button>
      </div>

      {/* 검색 영역 */}
      <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="space-y-3">
          {/* 검색 타입 선택 */}
          <div className="flex gap-2">
            <button
              onClick={() => setSearchType('SN')}
              className={`flex-1 py-2 rounded text-sm font-medium transition-all ${
                searchType === 'SN'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              S/N 검색
            </button>
            <button
              onClick={() => setSearchType('MAC')}
              className={`flex-1 py-2 rounded text-sm font-medium transition-all ${
                searchType === 'MAC'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              MAC 검색
            </button>
          </div>

          {/* 검색 입력 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {searchType === 'SN' ? '장비 일련번호 (S/N)' : 'MAC 주소'}
            </label>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 uppercase font-mono"
              placeholder={searchType === 'SN' ? '예: 330968023116101734' : '예: 481B40B6F453'}
            />
          </div>

          {/* 조회 버튼 */}
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white py-2.5 rounded font-medium text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                조회 중...
              </>
            ) : (
              '조회'
            )}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* 장비 상세 정보 */}
      {equipmentDetail && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
          <h3 className="text-sm font-bold text-gray-800 mb-2 pb-2 border-b border-gray-200">
            📦 장비 상세 정보
          </h3>

          <div className="max-h-[60vh] overflow-y-auto">
            {/* 기본 정보 */}
            <SectionHeader title="기본 정보" />
            <InfoRow label="장비번호" value={equipmentDetail.EQT_NO} />
            <InfoRow label="일련번호(S/N)" value={equipmentDetail.EQT_SERNO} />
            <InfoRow label="MAC 주소" value={equipmentDetail.MAC_ADDRESS} />
            <InfoRow label="바코드" value={equipmentDetail.BAR_CD} />
            <InfoRow label="IRD S/N" value={equipmentDetail.IRD_SN} />

            {/* 장비 유형 */}
            <SectionHeader title="장비 유형" />
            <InfoRow label="장비분류" value={equipmentDetail.EQT_CL_NM || equipmentDetail.EQT_CL_CD} />
            <InfoRow label="장비타입" value={equipmentDetail.EQT_TP_CD_NM || equipmentDetail.EQT_TP_CD} />
            <InfoRow label="품목코드" value={equipmentDetail.ITEM_CD} />
            <InfoRow label="품목명" value={equipmentDetail.ITEM_NM} />
            <InfoRow label="제조사" value={equipmentDetail.MAKER} />
            <InfoRow label="제조일" value={equipmentDetail.MNFCT_DT} />

            {/* 상태 정보 */}
            <SectionHeader title="상태 정보" />
            <InfoRow label="장비상태" value={equipmentDetail.EQT_STAT_CD_NM || equipmentDetail.EQT_STAT_CD} />
            <InfoRow label="사용상태" value={equipmentDetail.EQT_USE_STAT_CD_NM || equipmentDetail.EQT_USE_STAT_CD} />
            <InfoRow label="사용가능여부" value={equipmentDetail.EQT_USE_ARR_YN_NM || equipmentDetail.EQT_USE_ARR_YN} />
            <InfoRow label="사용종료일" value={equipmentDetail.EQT_USE_END_DT} />

            {/* 위치 정보 */}
            <SectionHeader title="위치 정보" />
            <InfoRow label="현재위치" value={equipmentDetail.EQT_LOC_NM || equipmentDetail.EQT_LOC_TP_CD_NM} />
            <InfoRow label="이전위치" value={equipmentDetail.OLD_EQT_LOC_NM || equipmentDetail.OLD_EQT_LOC_TP_CD_NM} />

            {/* 지점/협력사 */}
            <SectionHeader title="지점/협력사" />
            <InfoRow label="지점" value={equipmentDetail.SO_NM || equipmentDetail.SO_ID} />
            <InfoRow label="본부" value={equipmentDetail.MST_SO_NM || equipmentDetail.MST_SO_ID} />
            <InfoRow label="협력사" value={equipmentDetail.CRR_NM || equipmentDetail.CRR_ID} />
            <InfoRow label="이전지점" value={equipmentDetail.OLD_SO_NM || equipmentDetail.OLD_SO_ID} />
            <InfoRow label="이전협력사" value={equipmentDetail.OLD_CRR_NM || equipmentDetail.OLD_CRR_ID} />

            {/* 작업자 정보 */}
            <SectionHeader title="작업자 정보" />
            <InfoRow label="작업자" value={equipmentDetail.WRKR_NM ? `${equipmentDetail.WRKR_NM} (${equipmentDetail.WRKR_ID})` : equipmentDetail.WRKR_ID} />
            <InfoRow label="이전작업자" value={equipmentDetail.OLD_WRKR_NM ? `${equipmentDetail.OLD_WRKR_NM} (${equipmentDetail.OLD_WRKR_ID})` : equipmentDetail.OLD_WRKR_ID} />

            {/* 고객/계약 */}
            <SectionHeader title="고객/계약 정보" />
            <InfoRow label="고객ID" value={equipmentDetail.CUST_ID} />
            <InfoRow label="고객명" value={equipmentDetail.CUST_NM} />
            <InfoRow label="계약ID" value={equipmentDetail.CTRT_ID} />

            {/* 소유/구매 */}
            <SectionHeader title="소유/구매 정보" />
            <InfoRow label="소유구분" value={equipmentDetail.OWNER_TP_CD_NM || equipmentDetail.OWNER_TP_CD} />
            <InfoRow label="구매구분" value={equipmentDetail.PRCHS_CL_NM || equipmentDetail.PRCHS_CL} />
            <InfoRow label="구매단가" value={equipmentDetail.PRCHS_UT_PRC ? `${equipmentDetail.PRCHS_UT_PRC.toLocaleString()}원` : '-'} />

            {/* 입고/출고 */}
            <SectionHeader title="입고/출고 정보" />
            <InfoRow label="최초입고일" value={equipmentDetail.FIRST_IN_DT} />
            <InfoRow label="입고그룹번호" value={equipmentDetail.IN_GRP_NO} />
            <InfoRow label="출고요청번호" value={equipmentDetail.OUT_REQ_NO} />

            {/* 반납/폐기 */}
            <SectionHeader title="반납/폐기 정보" />
            <InfoRow label="반납사유" value={equipmentDetail.RETN_RESN_CD_NM || equipmentDetail.RETN_RESN_CD} />
            <InfoRow label="폐기구분" value={equipmentDetail.OBS_RCPT_CD_NM || equipmentDetail.OBS_RCPT_CD} />
            <InfoRow label="폐기상세" value={equipmentDetail.OBS_RCPT_DTL_CD_NM || equipmentDetail.OBS_RCPT_DTL_CD} />

            {/* STB 추가 정보 */}
            <SectionHeader title="STB 추가 정보" />
            <InfoRow label="CM MAC" value={equipmentDetail.STB_CM_MAC_ADDR} />
            <InfoRow label="Internal MAC" value={equipmentDetail.STB_INTERNAL_MAC_ADDR} />
            <InfoRow label="RTCA ID" value={equipmentDetail.STB_RTCA_ID} />
            <InfoRow label="카톤번호" value={equipmentDetail.STB_CARTON_NO} />

            {/* 변경 이력 */}
            <SectionHeader title="변경 이력" />
            <InfoRow label="변경종류" value={equipmentDetail.CHG_KND_CD} />
            <InfoRow label="변경일시" value={equipmentDetail.CHG_DATE} />
            <InfoRow label="변경자" value={equipmentDetail.CHG_UID} />
            <InfoRow label="등록일시" value={equipmentDetail.REG_DATE} />
            <InfoRow label="등록자" value={equipmentDetail.REG_UID} />
          </div>
        </div>
      )}

      {/* 디버그: Raw 응답 데이터 */}
      {rawResponse && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          <details>
            <summary className="text-xs font-medium text-gray-600 cursor-pointer">
              🔧 API 원본 응답 (디버그)
            </summary>
            <pre className="mt-2 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap bg-white p-2 rounded border max-h-48 overflow-y-auto">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && !equipmentDetail && !error && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-600 text-sm mb-1">장비 일련번호(S/N) 또는 MAC 주소로</p>
            <p className="text-gray-600 text-sm mb-3">장비 정보를 조회해보세요</p>
            {myEquipments.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 내 보유 장비({myEquipments.length}건)에서 먼저 검색합니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 내 보유 장비 목록 미리보기 */}
      {!equipmentDetail && myEquipments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mt-3">
          <details>
            <summary className="text-xs font-medium text-gray-700 cursor-pointer">
              📦 내 보유 장비 목록 ({myEquipments.length}건)
            </summary>
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {myEquipments.slice(0, 20).map((eq, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    setSearchValue(eq.EQT_SERNO || eq.SERIAL_NO || eq.MAC_ADDRESS || eq.MAC || '');
                    setEquipmentDetail(eq);
                    setRawResponse({ source: '내 보유 장비 목록에서 선택', data: eq });
                  }}
                >
                  <div>
                    <span className="font-medium text-gray-800">{eq.EQT_CL_NM || eq.EQT_TP_CD || '장비'}</span>
                    <span className="ml-2 text-gray-500">{eq.EQT_SERNO || eq.SERIAL_NO || '-'}</span>
                  </div>
                  <span className="text-gray-400 text-xs">{eq.EQT_STAT_CD_NM || eq.EQT_USE_STAT_CD || ''}</span>
                </div>
              ))}
              {myEquipments.length > 20 && (
                <p className="text-xs text-gray-500 text-center py-1">... 외 {myEquipments.length - 20}건</p>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default EquipmentList;
