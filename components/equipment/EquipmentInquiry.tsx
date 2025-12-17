import React, { useState, useEffect } from 'react';
import {
  getWorkerEquipmentList,
  getEquipmentReturnRequestList,
  addEquipmentReturnRequest,
  processEquipmentLoss,
  setEquipmentCheckStandby,
  getCommonCodes
} from '../../services/apiService';
import BaseModal from '../common/BaseModal';

interface EquipmentInquiryProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface UserInfo {
  userId: string;
  userName: string;
  soId?: string;
  crrId?: string;
  mstSoId?: string;
}

// 장비 상태 타입 (미회수 제외 - 미회수장비 메뉴에서 처리)
type EquipmentSearchCondition = 'OWNED' | 'RETURN_REQUESTED' | 'INSPECTION_WAITING';

// 장비 아이템 인터페이스
interface EquipmentItem {
  CHK: boolean;
  EQT_NO: string;
  EQT_SERNO: string;
  MAC_ADDRESS: string;
  EQT_CL_CD: string;
  EQT_CL_NM: string;
  ITEM_MID_CD: string;
  ITEM_MID_NM: string;
  ITEM_NM: string;
  SO_ID: string;
  SO_NM: string;
  EQT_STAT_CD: string;
  EQT_STAT_NM: string;
  PROC_STAT?: string;
  PROC_STAT_NM?: string;
  WRKR_ID?: string;
  WRKR_NM?: string;
  CUST_ID?: string;
  CTRT_ID?: string;
  EQT_USE_END_DT?: string;
  RETN_RESN_CD?: string;
  RETN_RESN_NM?: string;
}

interface SoListItem {
  SO_ID: string;
  SO_NM: string;
}

interface ItemMidItem {
  COMMON_CD: string;
  COMMON_CD_NM: string;
}

// 기본 지점 목록
const DEFAULT_SO_LIST: SoListItem[] = [
  { SO_ID: '209', SO_NM: '송파지점' },
  { SO_ID: '210', SO_NM: '강남지점' },
  { SO_ID: '211', SO_NM: '서초지점' },
  { SO_ID: '212', SO_NM: '강동지점' },
  { SO_ID: '100', SO_NM: '동서울지점' },
];

// 장비 중분류 목록
const DEFAULT_ITEM_MID_LIST: ItemMidItem[] = [
  { COMMON_CD: '', COMMON_CD_NM: '전체' },
  { COMMON_CD: '03', COMMON_CD_NM: '추가장비' },
  { COMMON_CD: '04', COMMON_CD_NM: '모뎀' },
  { COMMON_CD: '05', COMMON_CD_NM: '셋톱박스' },
  { COMMON_CD: '07', COMMON_CD_NM: '특수장비' },
];

const EquipmentInquiry: React.FC<EquipmentInquiryProps> = ({ onBack, showToast }) => {
  // localStorage에서 userInfo 가져오기
  const getUserInfo = (): UserInfo | null => {
    try {
      const stored = localStorage.getItem('userInfo');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const userInfo = getUserInfo();

  // 검색 조건
  const [selectedSoId, setSelectedSoId] = useState<string>(userInfo?.soId || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedItemMidCd, setSelectedItemMidCd] = useState<string>('');
  const [eqtSerno, setEqtSerno] = useState<string>('');

  // 검색 조건 - 보유, 반납요청중, 검사대기 (미회수 제외 - 별도 메뉴에서 처리)
  const [searchCondition, setSearchCondition] = useState<EquipmentSearchCondition>('OWNED');

  // 데이터
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [soList, setSoList] = useState<SoListItem[]>(DEFAULT_SO_LIST);
  const [itemMidList] = useState<ItemMidItem[]>(DEFAULT_ITEM_MID_LIST);

  // UI 상태
  const [isLoading, setIsLoading] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');
  const [lossReason, setLossReason] = useState<string>('');

  // 초기 데이터 로드
  useEffect(() => {
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    // 지점 코드는 API가 올바른 데이터를 반환하지 않으므로 기본값 사용
    // API 응답: {name: '선택', sort_no: '0', ...} 형태로 SO_ID/SO_NM 없음
    // 추후 백엔드에서 지점코드 API 추가 시 연동 가능
    console.log('📋 [지점코드] 기본값 사용 (API 미지원)');
    setSoList(DEFAULT_SO_LIST);
  };

  // 장비 조회
  const handleSearch = async () => {
    if (!userInfo?.userId) {
      showToast?.('로그인 정보가 없습니다. 다시 로그인해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    setEquipmentList([]);

    try {
      console.log('🔍 [장비처리] 시작:', {
        searchCondition,
        SO_ID: selectedSoId,
        WRKR_ID: userInfo.userId,
        ITEM_MID_CD: selectedItemMidCd,
        EQT_SERNO: eqtSerno
      });

      let result: any[] = [];

      // 검색 조건에 따라 다른 API 호출 또는 필터링
      const baseParams: any = {
        WRKR_ID: userInfo.userId,
        SO_ID: selectedSoId || userInfo.soId || undefined,
        ITEM_MID_CD: selectedItemMidCd || undefined,
        EQT_SERNO: eqtSerno || undefined,
      };

      // 검색조건별 파라미터 설정
      switch (searchCondition) {
        case 'OWNED':
          // 보유: EQT_STAT_CD = '10' (재고있음), EQT_LOC_TP_CD = '3' (작업기사 소유)
          // 반납요청중, 미회수, 검사대기 제외
          baseParams.EQT_STAT_CD = '10';
          baseParams.EQT_LOC_TP_CD = '3';
          baseParams.EXCLUDE_STAT = ['40', '60', '50']; // 반납요청중, 미회수, 검사대기 제외
          break;
        case 'RETURN_REQUESTED':
          // 반납요청중: EQT_STAT_CD = '40'
          baseParams.EQT_STAT_CD = '40';
          break;
        case 'INSPECTION_WAITING':
          // 검사대기: EQT_STAT_CD = '50'
          baseParams.EQT_STAT_CD = '50';
          break;
      }

      // getEquipmentReturnRequestList 또는 getWorkerEquipmentList 호출
      // 보유/반납요청중에는 getEquipmentReturnRequestList 사용
      if (searchCondition === 'OWNED' || searchCondition === 'RETURN_REQUESTED') {
        result = await getEquipmentReturnRequestList({
          WRKR_ID: userInfo.userId,
          SO_ID: selectedSoId || userInfo.soId || undefined,
          ...baseParams
        });
      } else {
        // 검사대기는 getWorkerEquipmentList 사용
        result = await getWorkerEquipmentList({
          WRKR_ID: userInfo.userId,
          SO_ID: selectedSoId || userInfo.soId || undefined,
          ...baseParams
        });
      }

      console.log('✅ [장비처리] 결과:', result);

      // 결과 변환 및 필터링
      const transformedList: EquipmentItem[] = (Array.isArray(result) ? result : []).map((item: any) => ({
        CHK: false,
        EQT_NO: item.EQT_NO || '',
        EQT_SERNO: item.EQT_SERNO || item.SERIAL_NO || '',
        MAC_ADDRESS: item.MAC_ADDRESS || item.MAC || '',
        EQT_CL_CD: item.EQT_CL_CD || '',
        EQT_CL_NM: item.EQT_CL_NM || item.EQT_TYPE || '',
        ITEM_MID_CD: item.ITEM_MID_CD || '',
        ITEM_MID_NM: item.ITEM_MID_NM || '',
        ITEM_NM: item.ITEM_NM || '',
        SO_ID: item.SO_ID || selectedSoId,
        SO_NM: item.SO_NM || '',
        EQT_STAT_CD: item.EQT_STAT_CD || item.STATUS || '',
        EQT_STAT_NM: item.EQT_STAT_NM || item.STATUS_NM || '',
        PROC_STAT: item.PROC_STAT || '',
        PROC_STAT_NM: item.PROC_STAT_NM || '',
        WRKR_ID: item.WRKR_ID || userInfo.userId,
        WRKR_NM: item.WRKR_NM || userInfo.userName,
        CUST_ID: item.CUST_ID || '',
        CTRT_ID: item.CTRT_ID || '',
        EQT_USE_END_DT: item.EQT_USE_END_DT || '',
        RETN_RESN_CD: item.RETN_RESN_CD || '',
        RETN_RESN_NM: item.RETN_RESN_NM || '',
      }));

      // 추가 필터링 (S/N)
      let filteredList = transformedList;
      if (eqtSerno) {
        filteredList = filteredList.filter(item => item.EQT_SERNO?.toUpperCase().includes(eqtSerno.toUpperCase()));
      }

      setEquipmentList(filteredList);

      if (filteredList.length === 0) {
        showToast?.('조회된 장비가 없습니다.', 'info');
      } else {
        showToast?.(`${filteredList.length}건의 장비를 조회했습니다.`, 'success');
      }
    } catch (error: any) {
      console.error('❌ [장비조회] 실패:', error);
      showToast?.(error.message || '장비 조회에 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 전체 선택/해제
  const handleCheckAll = (checked: boolean) => {
    setEquipmentList(equipmentList.map(item => ({ ...item, CHK: checked })));
  };

  // 개별 선택
  const handleCheckItem = (index: number, checked: boolean) => {
    const newList = [...equipmentList];
    newList[index].CHK = checked;
    setEquipmentList(newList);
  };

  // 장비 중분류별 색상
  const getItemColor = (itemMidCd: string) => {
    switch (itemMidCd) {
      case '03': return 'bg-green-100 text-green-800';  // 추가장비
      case '04': return 'bg-blue-100 text-blue-800';    // 모뎀
      case '05': return 'bg-purple-100 text-purple-800'; // 셋톱박스
      case '07': return 'bg-orange-100 text-orange-800'; // 특수장비
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 장비반납/취소 버튼 클릭
  const handleReturnClick = () => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('반납할 장비를 선택해주세요.', 'warning');
      return;
    }
    setShowReturnModal(true);
  };

  // 장비반납 처리
  const handleReturnRequest = async (action: 'RETURN' | 'CANCEL') => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('처리할 장비를 선택해주세요.', 'warning');
      return;
    }

    try {
      const result = await addEquipmentReturnRequest({
        WRKR_ID: userInfo?.userId || '',
        equipmentList: checkedItems.map(item => ({
          EQT_NO: item.EQT_NO,
          EQT_SERNO: item.EQT_SERNO,
          ACTION: action,
          RETN_RESN_CD: returnReason || '01', // 기본: 사용기간 만료
        })),
      });

      console.log('✅ 반납 처리 결과:', result);
      showToast?.(
        action === 'RETURN'
          ? `${checkedItems.length}건의 장비 반납 요청이 완료되었습니다.`
          : `${checkedItems.length}건의 반납 요청이 취소되었습니다.`,
        'success'
      );
      setShowReturnModal(false);
      setReturnReason('');
      await handleSearch(); // 리스트 새로고침
    } catch (error: any) {
      console.error('❌ 반납 처리 실패:', error);
      showToast?.(error.message || '반납 처리에 실패했습니다.', 'error');
    }
  };

  // 분실처리 버튼 클릭
  const handleLossClick = () => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('분실 처리할 장비를 선택해주세요.', 'warning');
      return;
    }
    if (checkedItems.length > 1) {
      showToast?.('분실 처리는 한 번에 1건만 가능합니다.', 'warning');
      return;
    }
    setSelectedEquipment(checkedItems[0]);
    setShowLossModal(true);
  };

  // 분실처리 실행
  const handleLossProcess = async () => {
    if (!selectedEquipment) return;

    try {
      const result = await processEquipmentLoss({
        EQT_NO: selectedEquipment.EQT_NO,
        WRKR_ID: userInfo?.userId || '',
        LOSS_REASON: lossReason || undefined,
      });

      console.log('✅ 분실 처리 결과:', result);
      showToast?.('장비 분실 처리가 완료되었습니다.', 'success');
      setShowLossModal(false);
      setSelectedEquipment(null);
      setLossReason('');
      await handleSearch(); // 리스트 새로고침
    } catch (error: any) {
      console.error('❌ 분실 처리 실패:', error);
      showToast?.(error.message || '분실 처리에 실패했습니다.', 'error');
    }
  };

  // 사용가능변경 버튼 클릭
  const handleStatusChangeClick = async () => {
    const checkedItems = equipmentList.filter(item => item.CHK);
    if (checkedItems.length === 0) {
      showToast?.('상태 변경할 장비를 선택해주세요.', 'warning');
      return;
    }

    // 동일고객의 당일해지 후 당일설치 작업이 발생하는 경우만 변경 가능
    // 이 검증은 서버에서 처리되지만 UI에서도 안내
    if (!confirm('동일 고객의 당일해지 후 당일설치 작업이 발생하는 경우에만 변경 가능합니다. 계속하시겠습니까?')) {
      return;
    }

    try {
      for (const item of checkedItems) {
        await setEquipmentCheckStandby({
          EQT_NO: item.EQT_NO,
        });
      }

      showToast?.(`${checkedItems.length}건의 장비 상태가 '사용가능'으로 변경되었습니다.`, 'success');
      await handleSearch(); // 리스트 새로고침
    } catch (error: any) {
      console.error('❌ 상태 변경 실패:', error);
      showToast?.(error.message || '상태 변경에 실패했습니다.', 'error');
    }
  };

  // 선택된 장비 수
  const selectedCount = equipmentList.filter(item => item.CHK).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
        {/* 검색 조건 선택 박스 (상단 배치) - 라디오 버튼 없이 박스 클릭으로 선택 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSearchCondition('OWNED')}
              className={`p-3 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                searchCondition === 'OWNED'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="text-sm font-bold">보유</div>
              <div className="text-[10px] text-gray-500 mt-0.5">내 장비 목록</div>
            </button>

            <button
              type="button"
              onClick={() => setSearchCondition('RETURN_REQUESTED')}
              className={`p-3 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                searchCondition === 'RETURN_REQUESTED'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="text-sm font-bold">반납요청</div>
              <div className="text-[10px] text-gray-500 mt-0.5">반납 진행중</div>
            </button>

            <button
              type="button"
              onClick={() => setSearchCondition('INSPECTION_WAITING')}
              className={`p-3 rounded-lg border-2 transition-all text-center active:scale-[0.98] touch-manipulation ${
                searchCondition === 'INSPECTION_WAITING'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-600'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="text-sm font-bold">검사대기</div>
              <div className="text-[10px] text-gray-500 mt-0.5">검사 대기중</div>
            </button>
          </div>
        </div>

        {/* 검색 필터 영역 - 키-값 한줄 레이아웃 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="space-y-3">
            {/* 지점 (한 줄) */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">지점</label>
              <select
                value={selectedSoId}
                onChange={(e) => setSelectedSoId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">전체</option>
                {soList.map((item) => (
                  <option key={item.SO_ID} value={item.SO_ID}>{item.SO_NM}</option>
                ))}
              </select>
            </div>
            {/* 구분 (한 줄) */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">구분</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">전체</option>
                <option value="Y">임대</option>
                <option value="N">판매</option>
                <option value="31">할부</option>
              </select>
            </div>
            {/* 장비종류 (한 줄) */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">장비종류</label>
              <select
                value={selectedItemMidCd}
                onChange={(e) => setSelectedItemMidCd(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {itemMidList.map((item) => (
                  <option key={item.COMMON_CD} value={item.COMMON_CD}>{item.COMMON_CD_NM}</option>
                ))}
              </select>
            </div>
            {/* S/N (한 줄) */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 w-16 flex-shrink-0">S/N</label>
              <input
                type="text"
                value={eqtSerno}
                onChange={(e) => setEqtSerno(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="바코드 또는 일련번호"
              />
            </div>
          </div>

          {/* 조회 버튼 */}
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full mt-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent' }}
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

        {/* 장비 리스트 */}
        {equipmentList.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 전체 선택 & 카운트 헤더 */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  onChange={(e) => handleCheckAll(e.target.checked)}
                  checked={equipmentList.length > 0 && equipmentList.every(item => item.CHK)}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-800">전체선택</span>
              </label>
              <span className="text-xs text-gray-500">
                {equipmentList.length}건 (선택: {equipmentList.filter(item => item.CHK).length}건)
              </span>
            </div>

            {/* 장비 리스트 테이블 */}
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2.5 text-center border-b border-gray-100 w-8">선택</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-600 border-b border-gray-100">요청</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">장비유형</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">장비일련번호</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-100">M/A</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentList.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`${item.CHK ? 'bg-blue-50' : 'hover:bg-blue-50/50'} transition-colors`}
                    >
                      <td className="px-2 py-2.5 text-center border-b border-gray-50">
                        <input
                          type="checkbox"
                          checked={item.CHK || false}
                          onChange={(e) => handleCheckItem(idx, e.target.checked)}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-center border-b border-gray-50">
                        {item.PROC_STAT === 'R' && (
                          <span className="text-blue-600 font-bold">●</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 border-b border-gray-50">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getItemColor(item.ITEM_MID_CD)}`}>
                          {item.EQT_CL_NM || item.ITEM_MID_NM || '장비'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-900 border-b border-gray-50 font-mono">
                        {item.EQT_SERNO || '-'}
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-500 border-b border-gray-50 font-mono truncate max-w-[80px]">
                        {item.MAC_ADDRESS || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {equipmentList.length === 0 && !isLoading && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm mb-1">조회된 장비가 없습니다</p>
              <p className="text-gray-400 text-xs">검색 조건을 설정하고 조회 버튼을 눌러주세요</p>
            </div>
          </div>
        )}

        {/* 하단 버튼 영역 - 검색조건별 필요한 버튼만 표시 */}
        <div className="flex gap-2">
          {/* 보유: 장비반납, 분실처리 */}
          {searchCondition === 'OWNED' && (
            <>
              <button
                onClick={handleReturnClick}
                disabled={selectedCount === 0}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                  selectedCount > 0
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                장비반납
              </button>
              <button
                onClick={handleLossClick}
                disabled={selectedCount === 0}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                  selectedCount > 0
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                분실처리
              </button>
            </>
          )}

          {/* 반납요청중: 반납취소 */}
          {searchCondition === 'RETURN_REQUESTED' && (
            <button
              onClick={handleReturnClick}
              disabled={selectedCount === 0}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                selectedCount > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              반납취소
            </button>
          )}

          {/* 검사대기: 사용가능변경 */}
          {searchCondition === 'INSPECTION_WAITING' && (
            <button
              onClick={handleStatusChangeClick}
              disabled={selectedCount === 0}
              className={`flex-1 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-all active:scale-[0.98] touch-manipulation ${
                selectedCount > 0
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              사용가능변경
            </button>
          )}
        </div>

      {/* 장비반납 모달 */}
      <BaseModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="장비반납요청-장비선택"
        size="md"
      >
        <div className="space-y-4">
          {/* 지점 (ReadOnly) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">지점</label>
            <input
              type="text"
              value={soList.find(s => s.SO_ID === selectedSoId)?.SO_NM || userInfo?.soId || ''}
              readOnly
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-gray-100"
            />
          </div>

          {/* 반납 사유 선택 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">반납 사유</label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="">선택</option>
              <option value="01">장비 사용일 만료</option>
              <option value="02">장비 불량 (고객 설치 불가)</option>
              <option value="03">기타</option>
            </select>
          </div>

          {/* 선택된 장비 리스트 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">선택된 장비</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">장비유형</th>
                    <th className="px-2 py-1.5 text-left">일련번호</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentList.filter(item => item.CHK).map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">{item.EQT_CL_NM}</td>
                      <td className="px-2 py-1.5 font-mono">{item.EQT_SERNO}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowReturnModal(false)}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              재선택
            </button>
            {searchCondition === 'OWNED' ? (
              <button
                onClick={() => handleReturnRequest('RETURN')}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                반납요청
              </button>
            ) : (
              <button
                onClick={() => handleReturnRequest('CANCEL')}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                요청취소
              </button>
            )}
          </div>
        </div>
      </BaseModal>

      {/* 분실처리 모달 */}
      <BaseModal
        isOpen={showLossModal}
        onClose={() => { setShowLossModal(false); setSelectedEquipment(null); }}
        title="분실처리"
        size="md"
      >
        {selectedEquipment && (
          <div className="space-y-4">
            {/* 장비 정보 */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">장비유형:</span>
                  <span className="ml-1 font-medium">{selectedEquipment.EQT_CL_NM}</span>
                </div>
                <div>
                  <span className="text-gray-500">일련번호:</span>
                  <span className="ml-1 font-medium font-mono">{selectedEquipment.EQT_SERNO}</span>
                </div>
              </div>
            </div>

            {/* 분실 사유 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">분실 사유</label>
              <textarea
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded h-20 resize-none"
                placeholder="분실 사유를 입력해주세요"
              />
            </div>

            {/* 경고 메시지 */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600">
                ⚠️ 분실 처리 시 장비 변상금이 청구될 수 있습니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowLossModal(false); setSelectedEquipment(null); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                취소
              </button>
              <button
                onClick={handleLossProcess}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-all active:scale-[0.98] touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                분실처리
              </button>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  );
};

export default EquipmentInquiry;
