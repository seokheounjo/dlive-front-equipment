import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Navigation, List, X } from 'lucide-react';
import { WorkOrder, WorkOrderStatus } from '../../types';
import { useUIStore } from '../../stores/uiStore';
import { openNavigation, NavApp } from '../../services/navigationService';

// OpenLayers imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import { Style, Icon } from 'ol/style';
import { boundingExtent } from 'ol/extent';
import 'ol/ol.css';

interface WorkMapViewProps {
  workOrders: WorkOrder[];
  onBack: () => void;
  onSelectWork: (work: WorkOrder) => void;
}

// 상태별 마커 색상
const STATUS_COLORS: Record<string, string> = {
  '진행중': '#DC2626',
  '완료': '#16A34A',
  '취소': '#9CA3AF',
  'default': '#EF4444'
};

// V-World API Key (환경변수 또는 기본 테스트키)
const VWORLD_API_KEY = (import.meta as any).env?.VITE_VWORLD_API_KEY || 'A4EED0C3-BED4-315A-AF7B-B47F94357975';

// 마커 SVG 생성 (data URL)
function createMarkerDataUrl(color: string, index: number): string {
  const displayNumber = index + 1;
  const fontSize = displayNumber >= 100 ? 9 : displayNumber >= 10 ? 11 : 13;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <path fill="${color}" stroke="#fff" stroke-width="2" d="M18 2C9.163 2 2 9.163 2 18c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z"/>
    <circle fill="#fff" cx="18" cy="18" r="10"/>
    <text x="18" y="22" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="${color}" font-family="Arial,sans-serif">${displayNumber}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// 주소 정제 (상세 주소, 괄호 등 제거)
function cleanAddress(address: string): string {
  let cleaned = address
    .replace(/\(.*?\)/g, '')           // 괄호 내용 제거
    .replace(/\d+층/g, '')             // 층수 제거
    .replace(/\d+호/g, '')             // 호수 제거
    .replace(/지하\s*\d*/g, '')        // 지하 제거
    .replace(/\s{2,}/g, ' ')           // 다중 공백 정리
    .trim();
  return cleaned;
}

// V-World Geocoding - getcoord (정확한 주소)
async function geocodeVWorldGetcoord(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    for (const type of ['road', 'parcel']) {
      const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=EPSG:4326&address=${encodeURIComponent(address)}&refine=true&simple=false&format=json&type=${type}&key=${VWORLD_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.response?.status === 'OK' && data.response?.result?.point) {
        return {
          lat: parseFloat(data.response.result.point.y),
          lng: parseFloat(data.response.result.point.x)
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// V-World Geocoding - search (유연한 검색)
async function geocodeVWorldSearch(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:4326&size=1&page=1&query=${encodeURIComponent(address)}&type=address&format=json&key=${VWORLD_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const items = data.response?.result?.items;
    if (items && items.length > 0 && items[0].point) {
      return {
        lat: parseFloat(items[0].point.y),
        lng: parseFloat(items[0].point.x)
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 카카오 Geocoding (폴백)
function geocodeKakao(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) {
      resolve(null);
      return;
    }
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        resolve({
          lat: parseFloat(result[0].y),
          lng: parseFloat(result[0].x)
        });
      } else {
        resolve(null);
      }
    });
  });
}

// 통합 Geocoding: V-World getcoord → V-World search → 카카오 폴백
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const cleaned = cleanAddress(address);
  console.log(`[Geocode] 원본: "${address}" → 정제: "${cleaned}"`);

  // 1차: V-World getcoord (정확한 주소)
  let result = await geocodeVWorldGetcoord(cleaned);
  if (result) { console.log(`[Geocode] V-World getcoord 성공:`, result); return result; }

  // 2차: V-World search (유연한 검색)
  result = await geocodeVWorldSearch(cleaned);
  if (result) { console.log(`[Geocode] V-World search 성공:`, result); return result; }

  // 원본 주소로도 search 시도
  if (cleaned !== address) {
    result = await geocodeVWorldSearch(address);
    if (result) { console.log(`[Geocode] V-World search(원본) 성공:`, result); return result; }
  }

  // 3차: 카카오 폴백
  result = await geocodeKakao(address);
  if (result) { console.log(`[Geocode] 카카오 성공:`, result); return result; }

  console.warn(`[Geocode] 실패: "${address}"`);
  return null;
}

interface MarkerInfo {
  work: WorkOrder;
  coords: { lat: number; lng: number };
}

const WorkMapView: React.FC<WorkMapViewProps> = ({ workOrders, onBack, onSelectWork }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const overlayElRef = useRef<HTMLDivElement>(null);
  const markerInfosRef = useRef<MarkerInfo[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [selectedWork, setSelectedWork] = useState<WorkOrder | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showNavModal, setShowNavModal] = useState(false);
  const { setCurrentView, setSelectedWorkDirection } = useUIStore();

  // 지도 초기화
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // V-World 타일 레이어
    const tileLayer = new TileLayer({
      source: new XYZ({
        url: `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_API_KEY}/Base/{z}/{y}/{x}.png`,
        maxZoom: 19,
        attributions: '© VWorld'
      })
    });

    // 마커 벡터 레이어
    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({ source: vectorSource });

    // 인포윈도우 오버레이
    const overlay = new Overlay({
      element: overlayElRef.current!,
      positioning: 'bottom-center',
      offset: [0, -52],
      stopEvent: true
    });
    overlayRef.current = overlay;

    // 맵 생성
    const map = new Map({
      target: mapContainerRef.current,
      layers: [tileLayer, vectorLayer],
      overlays: [overlay],
      view: new View({
        center: fromLonLat([126.9780, 37.5665]), // 서울 중심
        zoom: 8,
        maxZoom: 19,
        minZoom: 6
      })
    });
    mapRef.current = map;

    // 마커 클릭 이벤트
    map.on('click', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature) {
        const workId = feature.get('workId');
        const info = markerInfosRef.current.find(m => m.work.id === workId);
        if (info) {
          setSelectedWork(info.work);
          setSelectedCoords(info.coords);
          overlay.setPosition(fromLonLat([info.coords.lng, info.coords.lat]));
          map.getView().animate({
            center: fromLonLat([info.coords.lng, info.coords.lat]),
            zoom: Math.max(map.getView().getZoom() || 14, 14),
            duration: 300
          });
        }
      } else {
        // 빈 곳 클릭 시 인포윈도우 닫기
        overlay.setPosition(undefined);
        setSelectedWork(null);
        setSelectedCoords(null);
        setShowNavModal(false);
      }
    });

    // 커서 변경 (마커 위 hover)
    map.on('pointermove', (evt) => {
      const hit = map.forEachFeatureAtPixel(evt.pixel, () => true);
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    // Geocoding 후 마커 추가 (V-World 기본, 카카오 폴백)
    (async () => {
      // 카카오 SDK가 있으면 폴백용으로 초기화 (없어도 진행)
      if (window.kakao?.maps && !window.kakao.maps.services) {
        try { window.kakao.maps.load(() => {}); } catch {}
      }

      const markerInfos: MarkerInfo[] = [];
      const coords: [number, number][] = [];

      for (let i = 0; i < workOrders.length; i++) {
        const work = workOrders[i];
        const address = work.customer?.address;

        if (address) {
          // 딜레이를 두어 API 호출 속도 제한
          if (i > 0) await new Promise(r => setTimeout(r, 80));

          const result = await geocodeAddress(address);
          if (result) {
            const statusColor = STATUS_COLORS[work.status] || STATUS_COLORS.default;
            const iconUrl = createMarkerDataUrl(statusColor, i);

            const feature = new Feature({
              geometry: new Point(fromLonLat([result.lng, result.lat]))
            });
            feature.set('workId', work.id);
            feature.setStyle(new Style({
              image: new Icon({
                src: iconUrl,
                anchor: [0.5, 1],
                scale: 1
              })
            }));

            vectorSource.addFeature(feature);
            markerInfos.push({ work, coords: result });
            coords.push(fromLonLat([result.lng, result.lat]) as [number, number]);
          }
        }

        setGeocodedCount(i + 1);
      }

      markerInfosRef.current = markerInfos;

      // 모든 마커가 보이도록 bounds 조정
      if (coords.length > 0) {
        if (coords.length === 1) {
          map.getView().animate({
            center: coords[0],
            zoom: 15,
            duration: 300
          });
        } else {
          const extent = boundingExtent(coords);
          map.getView().fit(extent, {
            padding: [60, 60, 60, 60],
            maxZoom: 16,
            duration: 300
          });
        }
      }

      setIsLoading(false);
    })();

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [workOrders]);

  // 현재 위치로 이동
  const handleMyLocation = useCallback(() => {
    if (!mapRef.current) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapRef.current?.getView().animate({
            center: fromLonLat([longitude, latitude]),
            zoom: 15,
            duration: 500
          });
        },
        () => alert('위치 정보를 가져올 수 없습니다.')
      );
    } else {
      alert('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
    }
  }, []);

  // 길찾기 앱 열기
  const handleNavigation = useCallback((app: NavApp) => {
    if (!selectedCoords || !selectedWork) return;
    openNavigation(app, {
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      name: selectedWork.customer?.name || '목적지'
    });
    setShowNavModal(false);
  }, [selectedCoords, selectedWork]);

  // 인포윈도우 닫기
  const closeOverlay = useCallback(() => {
    overlayRef.current?.setPosition(undefined);
    setSelectedWork(null);
    setSelectedCoords(null);
    setShowNavModal(false);
  }, []);

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
        <div className="w-16" />
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* 인포윈도우 오버레이 (OpenLayers Overlay용 DOM) */}
        <div ref={overlayElRef} style={{ position: 'absolute' }}>
          {selectedWork && (
            <div style={{
              padding: '12px 16px',
              minWidth: 220,
              maxWidth: 300,
              borderRadius: 12,
              background: 'white',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              transform: 'translateX(-50%)',
              marginLeft: '50%'
            }}>
              {/* 상태 태그 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: `${STATUS_COLORS[selectedWork.status] || STATUS_COLORS.default}20`,
                  color: STATUS_COLORS[selectedWork.status] || STATUS_COLORS.default,
                  fontSize: 12, fontWeight: 600
                }}>{selectedWork.typeDisplay || selectedWork.type}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: '#f3f4f6', color: '#6b7280',
                  fontSize: 12
                }}>{selectedWork.status}</span>
                <button onClick={closeOverlay} style={{
                  marginLeft: 'auto', background: 'none', border: 'none',
                  cursor: 'pointer', padding: 2, lineHeight: 0
                }}>
                  <X size={14} color="#9ca3af" />
                </button>
              </div>

              {/* 고객 정보 */}
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1f2937', marginBottom: 4 }}>
                {selectedWork.customer?.name || '고객명 없음'}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.4 }}>
                {selectedWork.customer?.address || '주소 없음'}
              </div>

              {/* 버튼 그룹 */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => {
                    if (selectedWork.customer?.phone) {
                      window.location.href = `tel:${selectedWork.customer.phone}`;
                    }
                  }}
                  style={{
                    flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8,
                    background: '#3B82F6', color: 'white', fontSize: 12,
                    fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3
                  }}
                >
                  전화
                </button>
                <button
                  onClick={() => setShowNavModal(true)}
                  style={{
                    flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8,
                    background: '#8B5CF6', color: 'white', fontSize: 12,
                    fontWeight: 500, cursor: 'pointer'
                  }}
                >
                  길찾기
                </button>
                <button
                  onClick={() => onSelectWork(selectedWork)}
                  style={{
                    flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8,
                    background: '#10B981', color: 'white', fontSize: 12,
                    fontWeight: 500, cursor: 'pointer'
                  }}
                >
                  상세보기
                </button>
              </div>

              {/* 길찾기 네비 선택 */}
              {showNavModal && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleNavigation('kakao')}
                    style={{
                      flex: 1, padding: '10px 4px', border: '1px solid #FEE500',
                      borderRadius: 8, background: '#FEE500', color: '#3C1E1E',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    카카오맵
                  </button>
                  <button
                    onClick={() => handleNavigation('tmap')}
                    style={{
                      flex: 1, padding: '10px 4px', border: '1px solid #1C6EF2',
                      borderRadius: 8, background: '#1C6EF2', color: 'white',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    T맵
                  </button>
                  <button
                    onClick={() => handleNavigation('naver')}
                    style={{
                      flex: 1, padding: '10px 4px', border: '1px solid #1EC800',
                      borderRadius: 8, background: '#1EC800', color: 'white',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    네이버
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 로딩 오버레이 */}
        {isLoading && !loadError && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600">
              지도 로딩 중... ({geocodedCount}/{workOrders.length})
            </p>
          </div>
        )}

        {/* 에러 */}
        {loadError && (
          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-10 p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-700 text-center mb-4">{loadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              새로고침
            </button>
          </div>
        )}

        {/* 왼쪽 상단 범례 */}
        {!isLoading && !loadError && (
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
          <Navigation className="w-5 h-5 text-blue-500" />
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
