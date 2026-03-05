import React, { useState, useRef } from 'react';
import {
  MapPin, Clock, Send, Search, ChevronDown, ChevronUp,
  Loader2, CalendarDays, LogIn, LogOut, RefreshCw
} from 'lucide-react';
import { loadMapApiKeys, pickRandomKey } from '../../services/navigationService';

interface AttendanceRegistrationProps {
  onBack: () => void;
  userInfo?: { userId: string; userName: string; soId?: string } | null;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface LocationInfo {
  roadAddr: string;
  jibunAddr: string;
  lat: number;
  lng: number;
  checkedAt: string;
}

interface AttendanceRecord {
  date: string;
  type: 'in' | 'out';
  time: string;
  location: string;
  memo: string;
}

const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const formatDateTimeKR = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}년 ${m}월 ${dd}일 ${hh}시 ${mm}분 ${ss}초`;
};

const AttendanceRegistration: React.FC<AttendanceRegistrationProps> = ({
  onBack,
  userInfo,
  showToast
}) => {
  // 출근/퇴근 탭 (오후 2시 기준 자동 선택)
  const currentHour = new Date().getHours();
  const defaultTab = currentHour >= 14 ? 'out' : 'in';
  const [activeTab, setActiveTab] = useState<'in' | 'out'>(defaultTab);

  // 위치 정보
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [addrType, setAddrType] = useState<'jibun' | 'road'>('jibun');

  // 메모
  const [memo, setMemo] = useState('');

  // 등록 로딩
  const [submitting, setSubmitting] = useState(false);

  // 기간 조회
  const today = formatDateStr(new Date());
  const weekAgo = formatDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [searchFrom, setSearchFrom] = useState(weekAgo);
  const [searchTo, setSearchTo] = useState(today);
  const [searching, setSearching] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [expandedRecords, setExpandedRecords] = useState<Set<number>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(true);
  const historyRef = useRef<HTMLDivElement>(null);

  // VWorld reverse geocoding (server proxy to bypass CORS)
  const vworldFetch = async (point: string, key: string, type: string): Promise<any> => {
    const res = await fetch(`/api/vworld/address?point=${encodeURIComponent(point)}&key=${encodeURIComponent(key)}&type=${type}`);
    return res.json();
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<{ road: string; jibun: string }> => {
    const mapKeys = await loadMapApiKeys();
    const vworldKey = pickRandomKey(mapKeys.vworld);
    if (!vworldKey) {
      console.warn('[Attendance] MOMP001 VWorld key not found');
      return { road: '', jibun: '' };
    }
    try {
      const point = `${lng},${lat}`;
      // parcel + road parallel request
      const [parcelData, roadData] = await Promise.all([
        vworldFetch(point, vworldKey, 'parcel'),
        vworldFetch(point, vworldKey, 'road'),
      ]);
      let jibun = '';
      let road = '';
      if (parcelData?.response?.status === 'OK' && parcelData.response.result) {
        jibun = parcelData.response.result[0]?.text || '';
      }
      if (roadData?.response?.status === 'OK' && roadData.response.result) {
        road = roadData.response.result[0]?.text || '';
      }
      return { road, jibun };
    } catch (e) {
      console.warn('[Attendance] VWorld reverse geocode failed:', e);
      return { road: '', jibun: '' };
    }
  };

  // 위치 확인
  const handleCheckLocation = () => {
    if (!navigator.geolocation) {
      showToast?.('GPS를 지원하지 않는 브라우저입니다.', 'error');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const { road, jibun } = await reverseGeocode(latitude, longitude);
          const coordsFallback = `위도 ${latitude.toFixed(6)}, 경도 ${longitude.toFixed(6)}`;
          setLocation({
            roadAddr: road || jibun || coordsFallback,
            jibunAddr: road ? jibun : '',
            lat: latitude,
            lng: longitude,
            checkedAt: formatDateTimeKR(new Date())
          });
          if (road || jibun) {
            showToast?.('위치 확인 완료', 'success');
          } else {
            showToast?.('주소 변환 실패 (좌표로 표시)', 'warning');
          }
        } catch {
          setLocation({
            roadAddr: `위도 ${latitude.toFixed(6)}, 경도 ${longitude.toFixed(6)}`,
            jibunAddr: '',
            lat: latitude,
            lng: longitude,
            checkedAt: formatDateTimeKR(new Date())
          });
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        let msg = '위치 정보를 가져올 수 없습니다.';
        if (error.code === 1) msg = '위치 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.';
        else if (error.code === 2) msg = '위치 정보를 사용할 수 없습니다.';
        else if (error.code === 3) msg = '위치 정보 요청 시간이 초과되었습니다.';
        showToast?.(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 근태 입력
  const handleSubmit = async () => {
    if (!location) {
      showToast?.('위치 확인을 먼저 해주세요.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // TODO: Backend API call
      // const params = {
      //   userId: userInfo?.userId,
      //   type: activeTab,
      //   lat: location.lat,
      //   lng: location.lng,
      //   roadAddr: location.roadAddr,
      //   jibunAddr: location.jibunAddr,
      //   memo: memo,
      //   checkedAt: location.checkedAt
      // };

      showToast?.(`${activeTab === 'in' ? '출근' : '퇴근'} 등록이 완료되었습니다.`, 'success');
      setMemo('');
      setLocation(null);
    } catch (err: any) {
      showToast?.('근태 등록에 실패했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 기간 조회
  const handleSearch = async () => {
    const from = new Date(searchFrom);
    const to = new Date(searchTo);
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays > 7) {
      showToast?.('조회 기간은 최대 1주일입니다.', 'warning');
      return;
    }
    if (diffDays < 0) {
      showToast?.('시작일이 종료일보다 클 수 없습니다.', 'warning');
      return;
    }

    setSearching(true);
    try {
      // TODO: Backend API call
      // Mock data for UI demo
      const mockRecords: AttendanceRecord[] = [];
      const cur = new Date(searchFrom);
      const end = new Date(searchTo);
      while (cur <= end) {
        const dateStr = formatDateStr(cur);
        const dayOfWeek = cur.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          mockRecords.push({
            date: dateStr,
            type: 'in',
            time: '08:52',
            location: `위도 37.5665, 경도 126.9780`,
            memo: ''
          });
          mockRecords.push({
            date: dateStr,
            type: 'out',
            time: '18:05',
            location: `위도 37.5665, 경도 126.9780`,
            memo: ''
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
      setRecords(mockRecords);
      setHistoryOpen(true);
      showToast?.(`${mockRecords.length}건 조회되었습니다.`, 'info');
      setTimeout(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch {
      showToast?.('조회에 실패했습니다.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const toggleRecord = (index: number) => {
    setExpandedRecords(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  // 날짜별로 그룹핑
  const groupedRecords: Record<string, AttendanceRecord[]> = records.reduce<Record<string, AttendanceRecord[]>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = [];
    acc[r.date].push(r);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-4">
      {/* 출근/퇴근 탭 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-1">
        <button
          onClick={() => setActiveTab('in')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
            activeTab === 'in'
              ? 'bg-blue-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <LogIn className="w-4 h-4" />
          출근
        </button>
        <button
          onClick={() => setActiveTab('out')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
            activeTab === 'out'
              ? 'bg-blue-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <LogOut className="w-4 h-4" />
          퇴근
        </button>
        <div className="flex items-center px-2 text-xs text-gray-400">
          오후2시기준
        </div>
      </div>

      {/* 근태 등록 카드 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
        <h3 className="font-medium text-gray-800 flex items-center gap-2">
          {activeTab === 'in' ? (
            <LogIn className="w-5 h-5 text-blue-500" />
          ) : (
            <LogOut className="w-5 h-5 text-blue-500" />
          )}
          {activeTab === 'in' ? '출근' : '퇴근'} 등록
        </h3>

        {/* 위치 확인 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm text-gray-600">위치</label>
            <button
              onClick={handleCheckLocation}
              disabled={locationLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {locationLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              위치확인
            </button>
          </div>

          {location && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-1.5 flex-1">
                  <MapPin className="w-5 h-5 flex-shrink-0 text-blue-500 mt-0.5" />
                  <div>
                    <span className="text-xs text-blue-500 font-medium">
                      {addrType === 'jibun' ? '지번' : '도로명'}
                    </span>
                    <p className="text-lg font-semibold text-gray-900 leading-snug">
                      {addrType === 'jibun'
                        ? (location.jibunAddr || location.roadAddr)
                        : (location.roadAddr || location.jibunAddr)}
                    </p>
                  </div>
                </div>
                {location.roadAddr && location.jibunAddr && (
                  <button
                    onClick={() => setAddrType(prev => prev === 'jibun' ? 'road' : 'jibun')}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-blue-600 border border-blue-300 rounded-lg text-xs hover:bg-blue-100 transition-colors flex-shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {addrType === 'jibun' ? '도로명' : '지번'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-600 pt-1.5 border-t border-blue-200">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-sm font-medium">{location.checkedAt}</span>
              </div>
            </div>
          )}
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">메모</label>
          <textarea
            placeholder="메모를 입력해주세요. (선택)"
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* 근태 입력 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !location}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          {activeTab === 'in' ? '출근' : '퇴근'} 등록
        </button>
      </div>

      {/* 기간 조회 */}
      <div ref={historyRef} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-800">근태 이력</span>
            {records.length > 0 && (
              <span className="text-sm text-gray-500">({records.length}건)</span>
            )}
          </div>
          {historyOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {historyOpen && (
          <div className="px-4 pb-4 space-y-3">
            {/* 기간 선택 */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={searchFrom}
                onChange={(e) => setSearchFrom(e.target.value)}
                className="flex-1 min-w-0 px-1.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-400 text-xs flex-shrink-0">~</span>
              <input
                type="date"
                value={searchTo}
                onChange={(e) => setSearchTo(e.target.value)}
                className="flex-1 min-w-0 px-1.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {searching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                조회
              </button>
            </div>
            <p className="text-xs text-gray-400">* 최대 1주일까지 조회 가능</p>

            {/* 조회 결과 */}
            {Object.keys(groupedRecords).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(groupedRecords)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([date, dayRecords]) => (
                    <div key={date} className="bg-gray-50 rounded-lg border border-gray-100">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-800">{date}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({['일','월','화','수','목','금','토'][new Date(date).getDay()]}요일)
                        </span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {dayRecords.map((record, idx) => {
                          const globalIdx = records.indexOf(record);
                          const isExpanded = expandedRecords.has(globalIdx);
                          return (
                            <div key={idx} className="px-3 py-2">
                              <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleRecord(globalIdx)}
                              >
                                <div className="flex items-center gap-3 text-sm">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    record.type === 'in'
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    {record.type === 'in' ? '출근' : '퇴근'}
                                  </span>
                                  <span className="text-gray-800 font-medium">{record.time}</span>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              {isExpanded && (
                                <div className="mt-2 pl-2 space-y-1 text-xs text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span>{record.location}</span>
                                  </div>
                                  {record.memo && (
                                    <div className="flex items-start gap-1">
                                      <span className="text-gray-400">메모:</span>
                                      <span>{record.memo}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            ) : records.length === 0 && !searching ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                조회 버튼을 눌러 근태 이력을 확인하세요.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceRegistration;
