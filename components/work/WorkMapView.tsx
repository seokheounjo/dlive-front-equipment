import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Navigation, List, MapPin, Phone, MessageSquare } from 'lucide-react';
import { WorkOrder, WorkOrderStatus, MapMarkerData } from '../../types';
import { useUIStore } from '../../stores/uiStore';

interface WorkMapViewProps {
  workOrders: WorkOrder[];
  onBack: () => void;
  onSelectWork: (work: WorkOrder) => void;
}

// 상태별 마커 색상 (빨간색 계열로 눈에 잘 띄게)
const STATUS_COLORS: Record<string, string> = {
  '진행중': '#DC2626', // 빨간색
  '완료': '#16A34A',   // 초록색
  '취소': '#9CA3AF',   // 회색
  'default': '#EF4444' // 밝은 빨간색 (대기/기본)
};

const WorkMapView: React.FC<WorkMapViewProps> = ({ workOrders, onBack, onSelectWork }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const buttonClickedRef = useRef(false); // 버튼 클릭 플래그
  const [isLoading, setIsLoading] = useState(true);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [selectedWork, setSelectedWork] = useState<WorkOrder | null>(null);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const { setCurrentView, setSelectedWorkDirection } = useUIStore();

  // 카카오맵 SDK 동적 로드
  useEffect(() => {
    const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

    if (!KAKAO_MAP_KEY) {
      console.error('VITE_KAKAO_MAP_KEY 환경변수가 설정되지 않았습니다.');
      setSdkError('카카오맵 API 키가 설정되지 않았습니다.');
      setIsLoading(false);
      return;
    }

    const loadKakaoSDK = () => {
      // 이미 로드되어 있는지 확인
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => {
          console.log('카카오맵 SDK 이미 로드됨');
          setSdkLoaded(true);
        });
        return;
      }

      // 스크립트 동적 로드
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&libraries=services&autoload=false`;
      script.async = true;

      script.onload = () => {
        console.log('카카오맵 스크립트 로드 완료');
        if (window.kakao?.maps) {
          window.kakao.maps.load(() => {
            console.log('카카오맵 SDK 초기화 완료');
            setSdkLoaded(true);
          });
        }
      };

      script.onerror = () => {
        console.error('카카오맵 SDK 로드 실패');
        setSdkError('카카오맵 SDK를 불러오지 못했습니다. 앱키 또는 도메인 설정을 확인해주세요.');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    loadKakaoSDK();
  }, []);

  // 마커 이미지 생성 (SVG) - 인덱스 번호 포함
  const createMarkerImage = useCallback((color: string, index: number) => {
    const displayNumber = index + 1; // 1부터 시작
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
        <path fill="${color}" stroke="#fff" stroke-width="2" d="M18 2C9.163 2 2 9.163 2 18c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z"/>
        <circle fill="#fff" cx="18" cy="18" r="10"/>
        <text x="18" y="22" text-anchor="middle" font-size="${displayNumber >= 100 ? '9' : displayNumber >= 10 ? '11' : '13'}" font-weight="bold" fill="${color}" font-family="Arial, sans-serif">${displayNumber}</text>
      </svg>
    `;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    return new window.kakao.maps.MarkerImage(
      url,
      new window.kakao.maps.Size(36, 48),
      { offset: new window.kakao.maps.Point(18, 48) }
    );
  }, []);

  // 인포윈도우 컨텐츠 생성
  const createInfoContent = useCallback((work: WorkOrder) => {
    const statusColor = STATUS_COLORS[work.status] || STATUS_COLORS.default;
    return `
      <div style="
        padding: 12px 16px;
        min-width: 200px;
        max-width: 280px;
        border-radius: 12px;
        background: white;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="
            padding: 2px 8px;
            border-radius: 4px;
            background: ${statusColor}20;
            color: ${statusColor};
            font-size: 12px;
            font-weight: 600;
          ">${work.typeDisplay || work.type}</span>
          <span style="
            padding: 2px 8px;
            border-radius: 4px;
            background: #f3f4f6;
            color: #6b7280;
            font-size: 12px;
          ">${work.status}</span>
        </div>
        <div style="font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 4px;">
          ${work.customer?.name || '고객명 없음'}
        </div>
        <div style="font-size: 13px; color: #6b7280; margin-bottom: 12px; line-height: 1.4;">
          ${work.customer?.address || '주소 없음'}
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="call-btn-${work.id}" style="
            flex: 1;
            padding: 8px;
            border: none;
            border-radius: 8px;
            background: #3B82F6;
            color: white;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
          ">
            📞 전화
          </button>
          <button id="detail-btn-${work.id}" style="
            flex: 1;
            padding: 8px;
            border: none;
            border-radius: 8px;
            background: #10B981;
            color: white;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
          ">
            상세보기
          </button>
        </div>
      </div>
    `;
  }, []);

  // 지도 초기화 및 마커 표시
  useEffect(() => {
    if (!sdkLoaded || !mapRef.current) {
      return;
    }

    const container = mapRef.current;
    const options = {
      center: new window.kakao.maps.LatLng(37.5665, 126.9780), // 서울 중심
      level: 8
    };

    const map = new window.kakao.maps.Map(container, options);
    mapInstanceRef.current = map;

    // Geocoder로 주소 → 좌표 변환
    const geocoder = new window.kakao.maps.services.Geocoder();
    const bounds = new window.kakao.maps.LatLngBounds();
    let validMarkers = 0;

    // 기존 마커 제거
    markersRef.current.forEach(marker => marker.setMap(null));
    overlaysRef.current.forEach(overlay => overlay.setMap(null));
    markersRef.current = [];
    overlaysRef.current = [];

    const processWork = (work: WorkOrder, index: number) => {
      const address = work.customer?.address;
      if (!address) {
        setGeocodedCount(prev => prev + 1);
        return;
      }

      geocoder.addressSearch(address, (result, status) => {
        setGeocodedCount(prev => prev + 1);

        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          const coords = new window.kakao.maps.LatLng(
            parseFloat(result[0].y),
            parseFloat(result[0].x)
          );

          // 상태별 마커 색상 + 인덱스 번호
          const statusColor = STATUS_COLORS[work.status] || STATUS_COLORS.default;
          const markerImage = createMarkerImage(statusColor, index);

          const marker = new window.kakao.maps.Marker({
            position: coords,
            map: map,
            image: markerImage
          });

          // 커스텀 오버레이 (인포윈도우)
          const overlay = new window.kakao.maps.CustomOverlay({
            position: coords,
            content: createInfoContent(work),
            yAnchor: 1.3
          });

          // 마커 클릭 이벤트
          window.kakao.maps.event.addListener(marker, 'click', () => {
            // 다른 오버레이 닫기
            overlaysRef.current.forEach(o => o.setMap(null));
            // 현재 오버레이 열기
            overlay.setMap(map);
            setSelectedWork(work);
            // 마커 위치로 지도 이동
            map.setCenter(coords);
            map.setLevel(4);

            // 버튼 이벤트 바인딩 (DOM이 렌더링된 후)
            setTimeout(() => {
              const callBtn = document.getElementById(`call-btn-${work.id}`);
              const detailBtn = document.getElementById(`detail-btn-${work.id}`);

              if (callBtn) {
                callBtn.onclick = (e) => {
                  e.stopPropagation();
                  if (work.customer?.phone) {
                    window.location.href = `tel:${work.customer.phone}`;
                  }
                };
              }

              if (detailBtn) {
                detailBtn.onclick = (e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  buttonClickedRef.current = true;
                  console.log('상세보기 클릭:', work.id);
                  onSelectWork(work);
                };
              }
            }, 50);
          });

          markersRef.current.push(marker);
          overlaysRef.current.push(overlay);
          bounds.extend(coords);
          validMarkers++;

          // 모든 마커가 추가되면 bounds 조정
          if (validMarkers > 0 && index === workOrders.length - 1) {
            setTimeout(() => {
              map.setBounds(bounds);
              setIsLoading(false);
            }, 100);
          }
        }

        // 마지막 작업이면 로딩 완료
        if (index === workOrders.length - 1) {
          setTimeout(() => setIsLoading(false), 500);
        }
      });
    };

    // 작업 목록 처리 (딜레이를 두어 API 제한 방지)
    workOrders.forEach((work, index) => {
      setTimeout(() => processWork(work, index), index * 100);
    });

    // 지도 클릭 시 오버레이 닫기 (인포윈도우 외부 클릭 시에만)
    window.kakao.maps.event.addListener(map, 'click', () => {
      // 버튼 클릭 시에는 오버레이 닫지 않음
      setTimeout(() => {
        if (buttonClickedRef.current) {
          buttonClickedRef.current = false;
          return;
        }
        overlaysRef.current.forEach(o => o.setMap(null));
        setSelectedWork(null);
      }, 100);
    });

    return () => {
      // Cleanup
      markersRef.current.forEach(marker => marker.setMap(null));
      overlaysRef.current.forEach(overlay => overlay.setMap(null));
    };
  }, [sdkLoaded, workOrders, createMarkerImage, createInfoContent, onSelectWork]);

  // 현재 위치로 이동
  const handleMyLocation = () => {
    if (!mapInstanceRef.current) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const locPosition = new window.kakao.maps.LatLng(lat, lng);
          mapInstanceRef.current?.setCenter(locPosition);
          mapInstanceRef.current?.setLevel(3);
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
          useUIStore.getState().showGlobalToast('위치 정보를 가져올 수 없습니다.', 'error');
        }
      );
    } else {
      useUIStore.getState().showGlobalToast('이 브라우저에서는 위치 정보를 지원하지 않습니다.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 safe-area-top">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">목록</span>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">작업 위치</h1>
        <div className="w-16" /> {/* 균형용 */}
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* 로딩 오버레이 */}
        {(isLoading || !sdkLoaded) && !sdkError && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600">
              {!sdkLoaded ? '카카오맵 로딩 중...' : `지도 로딩 중... (${geocodedCount}/${workOrders.length})`}
            </p>
          </div>
        )}

        {/* SDK 에러 */}
        {sdkError && (
          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-10 p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-700 text-center mb-4">{sdkError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-500"
            >
              새로고침
            </button>
          </div>
        )}

        {/* 왼쪽 상단 범례 */}
        {!isLoading && sdkLoaded && !sdkError && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-20">
            <div className="text-xs font-semibold text-gray-700 mb-2">상태 구분</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-600" />
                <span className="text-xs text-gray-600">진행중</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-600" />
                <span className="text-xs text-gray-600">완료</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-400" />
                <span className="text-xs text-gray-600">대기</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400" />
                <span className="text-xs text-gray-600">취소</span>
              </div>
            </div>
          </div>
        )}

        {/* 현재 위치 버튼 */}
        <button
          onClick={handleMyLocation}
          className="absolute bottom-24 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 z-20"
          title="현재 위치"
        >
          <Navigation className="w-5 h-5 text-primary-700" />
        </button>

        {/* 목록 보기 버튼 */}
        <button
          onClick={onBack}
          className="absolute bottom-24 left-4 px-4 py-3 bg-white rounded-full shadow-lg flex items-center gap-2 hover:bg-gray-50 active:bg-gray-100 z-20"
        >
          <List className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">목록 보기</span>
        </button>
      </div>

      {/* 하단 정보 바 */}
      <div className="px-4 py-3 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-gray-600">진행중</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <span className="text-gray-600">완료</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-gray-600">대기</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            총 {workOrders.length}건
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkMapView;
