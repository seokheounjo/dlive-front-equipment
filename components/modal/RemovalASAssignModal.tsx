import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { RemovalLineData } from './RemovalLineManageModal';

interface RemovalASAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ASAssignData) => void;
  removalLineData: RemovalLineData | null;
  custId: string;
  custNm: string;
  addrOrd: string;
  address: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  // Address info for AS assignment (from order data)
  addressInfo?: {
    POST_ID?: string;
    BLD_ID?: string;
    BLD_CL?: string;
    BLD_NM?: string;
    BUN_CL?: string;
    BUN_NO?: string;
    HO_NM?: string;
    APT_DONG_NO?: string;
    APT_HO_CNT?: string;
    ADDR?: string;
    ADDR_DTL?: string;
  };
}

export interface ASAssignData {
  CUST_ID: string;
  RCPT_ID: string;
  WRK_DTL_TCD: string;       // AS작업상세 (0380: 선로철거)
  WRK_RCPT_CL: string;       // AS접수유형 (JH: CS(전화회수))
  WRK_RCPT_CL_DTL: string;   // AS접수상세 (JHA:출입불가, JHB:2층1인, JHC:특수지역)
  WRK_HOPE_DTTM: string;     // 작업희망일시 (YYYYMMDDHHmm)
  HOPE_DTTM: string;
  MEMO: string;
  EMRG_YN: string;
  HOLY_YN: string;
  CRR_ID: string;
  WRKR_ID: string;
  REG_UID: string;
  // RemovalLineData
  REMOVE_LINE_TP: string;
  REMOVE_GB: string;
  REMOVE_STAT: string;
  // Address fields (legacy ds_cust_info)
  POST_ID?: string;
  BLD_ID?: string;
  BLD_CL?: string;
  BLD_NM?: string;
  BUN_CL?: string;
  BUN_NO?: string;
  HO_NM?: string;
  APT_DONG_NO?: string;
  APT_HO_CNT?: string;
  ADDR?: string;
  ADDR_DTL?: string;
}

// 미철거 사유 → AS접수상세 매핑
const removeStatToAsDetail: Record<string, string> = {
  '5': 'JHA',  // 출입불가
  '6': 'JHB',  // 2층1인
  '7': 'JHC',  // 특수지역
};

const RemovalASAssignModal: React.FC<RemovalASAssignModalProps> = ({
  isOpen,
  onClose,
  onSave,
  removalLineData,
  custId,
  custNm,
  addrOrd,
  address,
  showToast,
  addressInfo
}) => {
  // 작업희망일
  const [hopeDate, setHopeDate] = useState<string>('');
  // 작업희망시 (09~21)
  const [hopeHour, setHopeHour] = useState<string>('10');
  // 작업희망분 (00, 10, 20, 30, 40, 50)
  const [hopeMinute, setHopeMinute] = useState<string>('00');
  // 메모
  const [memo, setMemo] = useState<string>('');

  // 시간 옵션 (09~21)
  const hourOptions = Array.from({ length: 13 }, (_, i) => {
    const hour = (9 + i).toString().padStart(2, '0');
    return { value: hour, label: hour };
  });

  // 분 옵션 (00, 10, 20, 30, 40, 50)
  const minuteOptions = ['00', '10', '20', '30', '40', '50'].map(m => ({
    value: m,
    label: m
  }));

  // 초기값 설정
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed

      // 해당월 말일 계산
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      const today = now.getDate();

      // 마지막 주 판단 (해당월의 마지막 7일)
      const isLastWeek = today > lastDayOfMonth - 7;

      let defaultDate: Date;
      if (isLastWeek) {
        // 익월 말일
        defaultDate = new Date(year, month + 2, 0);
      } else {
        // 해당월 말일
        defaultDate = new Date(year, month + 1, 0);
      }

      const dateYear = defaultDate.getFullYear();
      const dateMonth = String(defaultDate.getMonth() + 1).padStart(2, '0');
      const dateDay = String(defaultDate.getDate()).padStart(2, '0');
      setHopeDate(`${dateYear}-${dateMonth}-${dateDay}`);

      // 기본 시간: 10:00 고정 (수정 가능)
      setHopeHour('10');
      setHopeMinute('00');

      setMemo('');
    }
  }, [isOpen]);

  // 저장 핸들러
  const handleSave = () => {
    if (!hopeDate) {
      if (showToast) showToast('작업희망일을 선택하세요', 'warning');
      return;
    }

    // 현재 시간 체크
    const now = new Date();
    const hopeDttm = hopeDate.replace(/-/g, '') + hopeHour + hopeMinute;
    const currentDttm = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');

    if (Number(hopeDttm) < Number(currentDttm)) {
      if (showToast) showToast('희망일시를 현재시각 이후로 선택하세요', 'warning');
      return;
    }

    // 사용자 정보 가져오기
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const workerId = user.userId || 'A20130708';
    const crrId = user.crrId || '01';

    // AS접수상세 매핑
    const wrkRcptClDtl = removalLineData?.REMOVE_STAT
      ? removeStatToAsDetail[removalLineData.REMOVE_STAT] || ''
      : '';

    const data: ASAssignData = {
      CUST_ID: custId,
      RCPT_ID: '',
      WRK_DTL_TCD: '0380',      // 선로철거(AS할당)
      WRK_RCPT_CL: 'JH',        // CS(전화회수)
      WRK_RCPT_CL_DTL: wrkRcptClDtl,
      WRK_HOPE_DTTM: hopeDttm,
      HOPE_DTTM: hopeDttm,
      MEMO: memo,
      EMRG_YN: 'N',
      HOLY_YN: 'N',
      CRR_ID: crrId,
      WRKR_ID: workerId,
      REG_UID: workerId,
      // RemovalLineData
      REMOVE_LINE_TP: removalLineData?.REMOVE_LINE_TP || '',
      REMOVE_GB: removalLineData?.REMOVE_GB || '',
      REMOVE_STAT: removalLineData?.REMOVE_STAT || '',
      // Address fields (legacy ds_cust_info)
      POST_ID: addressInfo?.POST_ID || '',
      BLD_ID: addressInfo?.BLD_ID || '',
      BLD_CL: addressInfo?.BLD_CL || '',
      BLD_NM: addressInfo?.BLD_NM || '',
      BUN_CL: addressInfo?.BUN_CL || '',
      BUN_NO: addressInfo?.BUN_NO || '',
      HO_NM: addressInfo?.HO_NM || '',
      APT_DONG_NO: addressInfo?.APT_DONG_NO || '',
      APT_HO_CNT: addressInfo?.APT_HO_CNT || '',
      ADDR: addressInfo?.ADDR || address || '',
      ADDR_DTL: addressInfo?.ADDR_DTL || '',
    };

    onSave(data);
  };

  // 미철거 사유 라벨
  const getRemoveStatLabel = (stat: string) => {
    const labels: Record<string, string> = {
      '5': '출입불가',
      '6': '2층1인',
      '7': '특수지역',
    };
    return labels[stat] || stat;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[90%] max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="bg-purple-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between sticky top-0">
          <h2 className="text-sm sm:text-lg font-bold">인입선로미철거 선로철거AS할당</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-purple-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 바디 */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* 고객정보 */}
          <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
            <div className="flex">
              <span className="text-xs sm:text-sm text-gray-500 w-16 sm:w-20">고객번호</span>
              <span className="text-xs sm:text-sm font-medium">{custId} / {custNm}</span>
            </div>
            <div className="flex">
              <span className="text-xs sm:text-sm text-gray-500 w-16 sm:w-20">주소</span>
              <span className="text-xs sm:text-sm font-medium truncate">{address}</span>
            </div>
          </div>

          {/* 미철거 사유 표시 */}
          {removalLineData?.REMOVE_STAT && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <span className="text-sm text-yellow-700 font-medium">
                미철거 사유: {getRemoveStatLabel(removalLineData.REMOVE_STAT)}
              </span>
            </div>
          )}

          {/* AS작업상세 - 고정값 표시 */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
              AS작업상세
            </label>
            <input
              type="text"
              value="선로철거(AS할당)"
              readOnly
              className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-100 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-600"
            />
          </div>

          {/* AS접수유형 - 고정값 표시 */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                AS접수유형(대)
              </label>
              <input
                type="text"
                value="CS(전화회수)"
                readOnly
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-100 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                AS접수유형(소)
              </label>
              <input
                type="text"
                value={getRemoveStatLabel(removalLineData?.REMOVE_STAT || '')}
                readOnly
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-100 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-600"
              />
            </div>
          </div>

          {/* 작업희망일시 */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
              작업희망일시 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={hopeDate}
                  onChange={(e) => setHopeDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <select
                  value={hopeHour}
                  onChange={(e) => setHopeHour(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {hourOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <span className="text-gray-500">:</span>
                <select
                  value={hopeMinute}
                  onChange={(e) => setHopeMinute(e.target.value)}
                  className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  {minuteOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
              요청내용
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="요청 내용을 입력하세요..."
              rows={3}
              maxLength={512}
              className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm resize-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200 sticky bottom-0">
          <button
            onClick={handleSave}
            className="w-full py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors text-sm sm:text-base"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemovalASAssignModal;
