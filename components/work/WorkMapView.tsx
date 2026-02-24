import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Navigation, List, X, Layers } from 'lucide-react';
import { WorkOrder, WorkOrderStatus } from '../../types';
import { useUIStore } from '../../stores/uiStore';
import { openNavigation, NavApp } from '../../services/navigationService';

// OpenLayers imports
import OlMap from 'ol/Map';
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

// V-World API Key
const VWORLD_API_KEY = (import.meta as any).env?.VITE_VWORLD_API_KEY || 'A4EED0C3-BED4-315A-AF7B-B47F94357975';

type MapSource = 'vworld' | 'kakao';

// 타일 소스 생성
function createTileSource(source: MapSource): XYZ {
  if (source === 'kakao') {
    // 카카오맵 타일 (비공식 XYZ)
    return new XYZ({
      url: 'https://map{0-3}.daumcdn.net/map_2d/2401dms/L{z}/{y}/{x}.png',
      tileUrlFunction: ([z, x, y]) => {
        // 카카오맵은 WMTS 스타일로 y 좌표를 반전
        const level = 15 - z; // 카카오 레벨 변환 (OL zoom → Kakao level)
        if (level < 1 || level > 14) return '';
        const tileY = Math.pow(2, z) - 1 - y;
        const server = (x + y) % 4;
        return `https://map${server}.daumcdn.net/map_2d/2401dms/L${level}/${tileY}/${x}.png`;
      },
      maxZoom: 19,
      attributions: '© Kakao'
    });
  }
  return new XYZ({
    url: `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_API_KEY}/Base/{z}/{y}/{x}.png`,
    maxZoom: 19,
    attributions: '© VWorld'
  });
}

// 마커 SVG 생성
function createMarkerDataUrl(color: string, index: number): string {
  const n = index + 1;
  const fs = n >= 100 ? 9 : n >= 10 ? 11 : 13;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <path fill="${color}" stroke="#fff" stroke-width="2" d="M18 2C9.163 2 2 9.163 2 18c0 12 16 28 16 28s16-16 16-28c0-8.837-7.163-16-16-16z"/>
    <circle fill="#fff" cx="18" cy="18" r="10"/>
    <text x="18" y="22" text-anchor="middle" font-size="${fs}" font-weight="bold" fill="${color}" font-family="Arial,sans-serif">${n}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// 카카오 SDK 로드 대기
function ensureKakaoGeocoder(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.kakao?.maps?.services) { resolve(true); return; }
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(!!window.kakao.maps.services));
      return;
    }
    // index.html에서 로드 중 대기 (최대 5초)
    let t = 0;
    const iv = setInterval(() => {
      t++;
      if (window.kakao?.maps) {
        clearInterval(iv);
        if (window.kakao.maps.services) { resolve(true); return; }
        window.kakao.maps.load(() => resolve(!!window.kakao.maps.services));
      } else if (t > 25) {
        clearInterval(iv);
        // 동적 로드 시도
        const s = document.createElement('script');
        s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=60a7bd1a64feb3d63955a9165bb4bc79&libraries=services&autoload=false';
        s.onload = () => {
          if (window.kakao?.maps) {
            window.kakao.maps.load(() => resolve(!!window.kakao.maps.services));
          } else resolve(false);
        };
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      }
    }, 200);
  });
}

// 카카오 Geocoding
function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) { resolve(null); return; }
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
      } else {
        // 정제 후 재시도
        const cleaned = address.replace(/\(.*?\)/g, '').replace(/\d+[층호]/g, '').replace(/\s{2,}/g, ' ').trim();
        if (cleaned !== address) {
          geocoder.addressSearch(cleaned, (r2: any, s2: any) => {
            if (s2 === window.kakao.maps.services.Status.OK && r2[0]) {
              resolve({ lat: parseFloat(r2[0].y), lng: parseFloat(r2[0].x) });
            } else resolve(null);
          });
        } else resolve(null);
      }
    });
  });
}

interface MarkerInfo {
  work: WorkOrder;
  coords: { lat: number; lng: number };
}

const WorkMapView: React.FC<WorkMapViewProps> = ({ workOrders, onBack, onSelectWork }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const tileLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const overlayElRef = useRef<HTMLDivElement>(null);
  const markerInfosRef = useRef<MarkerInfo[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [geocodedSuccess, setGeocodedSuccess] = useState(0);
  const [selectedWork, setSelectedWork] = useState<WorkOrder | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showNavModal, setShowNavModal] = useState(false);
  const [mapSource, setMapSource] = useState<MapSource>('vworld');
  const { setCurrentView, setSelectedWorkDirection } = useUIStore();

  // 지도 소스 변경
  const switchMapSource = useCallback(() => {
    const next: MapSource = mapSource === 'vworld' ? 'kakao' : 'vworld';
    setMapSource(next);
    if (tileLayerRef.current) {
      tileLayerRef.current.setSource(createTileSource(next));
    }
  }, [mapSource]);

  // 지도 초기화
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const tileLayer = new TileLayer({ source: createTileSource('vworld') });
    tileLayerRef.current = tileLayer;

    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({ source: vectorSource });

    const overlay = new Overlay({
      element: overlayElRef.current!,
      positioning: 'bottom-center',
      offset: [0, -52],
      stopEvent: true
    });
    overlayRef.current = overlay;

    const map = new OlMap({
      target: mapContainerRef.current,
      layers: [tileLayer, vectorLayer],
      overlays: [overlay],
      view: new View({
        center: fromLonLat([126.9780, 37.5665]),
        zoom: 8, maxZoom: 19, minZoom: 6
      })
    });
    mapRef.current = map;

    // 마커 클릭
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
        overlay.setPosition(undefined);
        setSelectedWork(null);
        setSelectedCoords(null);
        setShowNavModal(false);
      }
    });

    map.on('pointermove', (evt) => {
      const hit = map.forEachFeatureAtPixel(evt.pixel, () => true);
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    // Geocoding (카카오 SDK 사용 — CORS 문제 없음)
    (async () => {
      const ready = await ensureKakaoGeocoder();
      if (!ready) {
        console.error('[Map] 카카오 Geocoder 로드 실패');
        setLoadError('주소 변환 서비스를 불러올 수 없습니다.\n카카오 SDK 로드를 확인해주세요.');
        setIsLoading(false);
        return;
      }

      console.log(`[Map] Geocoding 시작: ${workOrders.length}건`);
      const markerInfos: MarkerInfo[] = [];
      const coordsList: [number, number][] = [];
      let successCount = 0;

      for (let i = 0; i < workOrders.length; i++) {
        const work = workOrders[i];
        const address = work.customer?.address;

        if (address) {
          if (i > 0) await new Promise(r => setTimeout(r, 80));
          const result = await geocodeAddress(address);
          if (result) {
            const statusColor = STATUS_COLORS[work.status] || STATUS_COLORS.default;
            const feature = new Feature({
              geometry: new Point(fromLonLat([result.lng, result.lat]))
            });
            feature.set('workId', work.id);
            feature.setStyle(new Style({
              image: new Icon({ src: createMarkerDataUrl(statusColor, i), anchor: [0.5, 1], scale: 1 })
            }));
            vectorSource.addFeature(feature);
            markerInfos.push({ work, coords: result });
            coordsList.push(fromLonLat([result.lng, result.lat]) as [number, number]);
            successCount++;
            console.log(`[Map] ${i + 1}/${workOrders.length} 성공: "${address}" → ${result.lat},${result.lng}`);
          } else {
            console.warn(`[Map] ${i + 1}/${workOrders.length} 실패: "${address}"`);
          }
        }
        setGeocodedCount(i + 1);
        setGeocodedSuccess(successCount);
      }

      markerInfosRef.current = markerInfos;
      console.log(`[Map] Geocoding 완료: ${successCount}/${workOrders.length}건 성공`);

      if (coordsList.length > 0) {
        if (coordsList.length === 1) {
          map.getView().animate({ center: coordsList[0], zoom: 15, duration: 300 });
        } else {
          map.getView().fit(boundingExtent(coordsList), {
            padding: [60, 60, 60, 60], maxZoom: 16, duration: 300
          });
        }
      }
      setIsLoading(false);
    })();

    return () => { map.setTarget(undefined); mapRef.current = null; };
  }, [workOrders]);

  const handleMyLocation = useCallback(() => {
    if (!mapRef.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.getView().animate({
          center: fromLonLat([pos.coords.longitude, pos.coords.latitude]),
          zoom: 15, duration: 500
        });
      },
      () => alert('위치 정보를 가져올 수 없습니다.')
    );
  }, []);

  const handleNavigation = useCallback((app: NavApp) => {
    if (!selectedCoords || !selectedWork) return;
    openNavigation(app, {
      lat: selectedCoords.lat, lng: selectedCoords.lng,
      name: selectedWork.customer?.name || '목적지'
    });
    setShowNavModal(false);
  }, [selectedCoords, selectedWork]);

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
        <button onClick={onBack} className="flex items-center gap-2 text-gray-700">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">목록</span>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">작업 위치</h1>
        {/* 지도 소스 토글 */}
        <button
          onClick={switchMapSource}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-700"
        >
          <Layers className="w-3.5 h-3.5" />
          {mapSource === 'vworld' ? 'V-World' : '카카오'}
        </button>
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* 인포윈도우 */}
        <div ref={overlayElRef} style={{ position: 'absolute' }}>
          {selectedWork && (
            <div style={{
              padding: '12px 16px', minWidth: 220, maxWidth: 300, borderRadius: 12,
              background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              transform: 'translateX(-50%)', marginLeft: '50%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: `${STATUS_COLORS[selectedWork.status] || STATUS_COLORS.default}20`,
                  color: STATUS_COLORS[selectedWork.status] || STATUS_COLORS.default,
                  fontSize: 12, fontWeight: 600
                }}>{selectedWork.typeDisplay || selectedWork.type}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280', fontSize: 12
                }}>{selectedWork.status}</span>
                <button onClick={closeOverlay} style={{
                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0
                }}><X size={14} color="#9ca3af" /></button>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1f2937', marginBottom: 4 }}>
                {selectedWork.customer?.name || '고객명 없음'}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.4 }}>
                {selectedWork.customer?.address || '주소 없음'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { if (selectedWork.customer?.phone) window.location.href = `tel:${selectedWork.customer.phone}`; }}
                  style={{ flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, background: '#3B82F6', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  전화
                </button>
                <button onClick={() => setShowNavModal(true)}
                  style={{ flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, background: '#8B5CF6', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  길찾기
                </button>
                <button onClick={() => onSelectWork(selectedWork)}
                  style={{ flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, background: '#10B981', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  상세보기
                </button>
              </div>
              {showNavModal && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button onClick={() => handleNavigation('kakao')}
                    style={{ flex: 1, padding: '10px 4px', border: '1px solid #FEE500', borderRadius: 8, background: '#FEE500', color: '#3C1E1E', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    카카오맵
                  </button>
                  <button onClick={() => handleNavigation('tmap')}
                    style={{ flex: 1, padding: '10px 4px', border: '1px solid #1C6EF2', borderRadius: 8, background: '#1C6EF2', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    T맵
                  </button>
                  <button onClick={() => handleNavigation('naver')}
                    style={{ flex: 1, padding: '10px 4px', border: '1px solid #1EC800', borderRadius: 8, background: '#1EC800', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    네이버
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 로딩 */}
        {isLoading && !loadError && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600">주소 변환 중... ({geocodedCount}/{workOrders.length})</p>
            {geocodedSuccess > 0 && (
              <p className="text-sm text-green-600 mt-1">{geocodedSuccess}건 위치 확인</p>
            )}
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
            <p className="text-gray-700 text-center mb-4 whitespace-pre-line">{loadError}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded-lg">새로고침</button>
          </div>
        )}

        {/* 범례 */}
        {!isLoading && !loadError && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-20">
            <div className="text-xs font-semibold text-gray-700 mb-2">상태 구분</div>
            <div className="space-y-1.5">
              {[['bg-red-600', '진행중'], ['bg-green-600', '완료'], ['bg-red-400', '대기'], ['bg-gray-400', '취소']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${c}`} />
                  <span className="text-xs text-gray-600">{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 현재 위치 */}
        <button onClick={handleMyLocation} title="현재 위치"
          className="absolute bottom-24 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-20">
          <Navigation className="w-5 h-5 text-blue-500" />
        </button>

        {/* 목록 보기 */}
        <button onClick={onBack}
          className="absolute bottom-24 left-4 px-4 py-3 bg-white rounded-full shadow-lg flex items-center gap-2 z-20">
          <List className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">목록 보기</span>
        </button>
      </div>

      {/* 하단 바 */}
      <div className="px-4 py-3 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            {[['bg-red-600', '진행중'], ['bg-green-600', '완료'], ['bg-red-400', '대기']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${c}`} />
                <span className="text-gray-600">{l}</span>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500">총 {workOrders.length}건</div>
        </div>
      </div>
    </div>
  );
};

export default WorkMapView;
