import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Navigation, List, X, Layers } from 'lucide-react';
import { WorkOrder } from '../../types';
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
import { fromLonLat } from 'ol/proj';
import { Style, Icon } from 'ol/style';
import { boundingExtent } from 'ol/extent';
import 'ol/ol.css';

declare global {
  interface Window { kakao: any; }
}

interface WorkMapViewProps {
  workOrders: WorkOrder[];
  onBack: () => void;
  onSelectWork: (work: WorkOrder) => void;
}

type MapSource = 'vworld' | 'kakao';

const STATUS_COLORS: Record<string, string> = {
  '진행중': '#DC2626',
  '완료': '#16A34A',
  '취소': '#9CA3AF',
  'default': '#EF4444'
};

const VWORLD_API_KEY = 'A4EED0C3-BED4-315A-AF7B-B47F94357975';

// 넘버링 마커 SVG
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

// 내 위치 마커 SVG (파란 원 + 흰 테두리 + 펄스 링)
function createMyLocationMarkerUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="#3B82F6" fill-opacity="0.15" stroke="#3B82F6" stroke-width="1.5" stroke-opacity="0.4"/>
    <circle cx="20" cy="20" r="9" fill="#3B82F6" stroke="#fff" stroke-width="3"/>
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
    let t = 0;
    const iv = setInterval(() => {
      t++;
      if (window.kakao?.maps) {
        clearInterval(iv);
        if (window.kakao.maps.services) { resolve(true); return; }
        window.kakao.maps.load(() => resolve(!!window.kakao.maps.services));
      } else if (t > 25) {
        clearInterval(iv);
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
  // Map container refs
  const vworldContainerRef = useRef<HTMLDivElement>(null);
  const kakaoContainerRef = useRef<HTMLDivElement>(null);

  // Map instance refs
  const olMapRef = useRef<OlMap | null>(null);
  const olVectorSourceRef = useRef<VectorSource | null>(null);
  const olMyLocFeatureRef = useRef<Feature | null>(null);
  const kakaoMapRef = useRef<any>(null);
  const kakaoMarkersRef = useRef<any[]>([]);
  const kakaoMyLocMarkerRef = useRef<any>(null);
  const markerInfosRef = useRef<MarkerInfo[]>([]);
  const myLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // State
  const [mapSource, setMapSource] = useState<MapSource>('vworld');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [geocodedSuccess, setGeocodedSuccess] = useState(0);
  const [selectedWork, setSelectedWork] = useState<WorkOrder | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showNavModal, setShowNavModal] = useState(false);

  // Initialize both maps + geocode
  useEffect(() => {
    let disposed = false;

    // ========== V-World (OpenLayers) ==========
    const vectorSource = new VectorSource();
    olVectorSourceRef.current = vectorSource;

    const olMap = new OlMap({
      target: vworldContainerRef.current!,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_API_KEY}/Base/{z}/{y}/{x}.png`,
            maxZoom: 19,
            attributions: '© VWorld'
          })
        }),
        new VectorLayer({ source: vectorSource })
      ],
      view: new View({
        center: fromLonLat([126.9780, 37.5665]),
        zoom: 8,
        maxZoom: 19,
        minZoom: 6
      })
    });
    olMapRef.current = olMap;

    // OL marker click
    olMap.on('click', (evt) => {
      const feature = olMap.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature) {
        const workId = feature.get('workId');
        const info = markerInfosRef.current.find(m => m.work.id === workId);
        if (info) {
          setSelectedWork(info.work);
          setSelectedCoords(info.coords);
          setShowNavModal(false);
          olMap.getView().animate({
            center: fromLonLat([info.coords.lng, info.coords.lat]),
            zoom: Math.max(olMap.getView().getZoom() || 14, 14),
            duration: 300
          });
        }
      } else {
        setSelectedWork(null);
        setSelectedCoords(null);
        setShowNavModal(false);
      }
    });

    olMap.on('pointermove', (evt) => {
      const hit = olMap.forEachFeatureAtPixel(evt.pixel, () => true);
      olMap.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    // ========== Kakao Map ==========
    let kakaoMap: any = null;
    const initKakaoMap = () => {
      if (!window.kakao?.maps?.Map || !kakaoContainerRef.current) return null;
      const map = new window.kakao.maps.Map(kakaoContainerRef.current, {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 8
      });
      kakaoMapRef.current = map;

      // Kakao map click on empty area → close info card
      window.kakao.maps.event.addListener(map, 'click', () => {
        setSelectedWork(null);
        setSelectedCoords(null);
        setShowNavModal(false);
      });

      return map;
    };

    if (window.kakao?.maps) {
      if (window.kakao.maps.Map) {
        kakaoMap = initKakaoMap();
      } else {
        window.kakao.maps.load(() => { kakaoMap = initKakaoMap(); });
      }
    }

    // ========== 내 위치 마커 추가 함수 ==========
    const addMyLocationMarker = (lat: number, lng: number) => {
      myLocationRef.current = { lat, lng };
      const myLocUrl = createMyLocationMarkerUrl();

      // OL 내 위치 마커
      const myLocFeature = new Feature({
        geometry: new Point(fromLonLat([lng, lat]))
      });
      myLocFeature.set('isMyLocation', true);
      myLocFeature.setStyle(new Style({
        image: new Icon({ src: myLocUrl, anchor: [0.5, 0.5], scale: 1 })
      }));
      vectorSource.addFeature(myLocFeature);
      olMyLocFeatureRef.current = myLocFeature;

      // 카카오 내 위치 마커
      if (kakaoMap) {
        const kakaoImg = new window.kakao.maps.MarkerImage(
          myLocUrl,
          new window.kakao.maps.Size(40, 40),
          { offset: new window.kakao.maps.Point(20, 20) }
        );
        const kakaoMyMarker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(lat, lng),
          image: kakaoImg,
          map: kakaoMap,
          zIndex: 10
        });
        kakaoMyLocMarkerRef.current = kakaoMyMarker;
      }

      console.log(`[Map] 내 위치 표시: ${lat}, ${lng}`);
    };

    // ========== GPS 위치 가져오기 (비동기, 지오코딩과 병렬) ==========
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!disposed) {
            addMyLocationMarker(pos.coords.latitude, pos.coords.longitude);
          }
        },
        (err) => console.warn('[Map] 위치 가져오기 실패:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }

    // ========== Geocoding ==========
    (async () => {
      const ready = await ensureKakaoGeocoder();
      if (!ready) {
        setLoadError('주소 변환 서비스를 불러올 수 없습니다.');
        setIsLoading(false);
        return;
      }

      // Ensure Kakao map is initialized
      if (!kakaoMap && window.kakao?.maps?.Map) {
        kakaoMap = initKakaoMap();
      }

      console.log(`[Map] Geocoding 시작: ${workOrders.length}건`);
      const markerInfos: MarkerInfo[] = [];
      const olCoordsList: [number, number][] = [];
      let successCount = 0;

      for (let i = 0; i < workOrders.length; i++) {
        if (disposed) return;
        const work = workOrders[i];
        const address = work.customer?.address;

        if (address) {
          if (i > 0) await new Promise(r => setTimeout(r, 80));
          const result = await geocodeAddress(address);
          if (result) {
            const statusColor = STATUS_COLORS[work.status] || STATUS_COLORS.default;
            const markerDataUrl = createMarkerDataUrl(statusColor, i);

            // --- OpenLayers marker ---
            const feature = new Feature({
              geometry: new Point(fromLonLat([result.lng, result.lat]))
            });
            feature.set('workId', work.id);
            feature.setStyle(new Style({
              image: new Icon({ src: markerDataUrl, anchor: [0.5, 1], scale: 1 })
            }));
            vectorSource.addFeature(feature);
            olCoordsList.push(fromLonLat([result.lng, result.lat]) as [number, number]);

            // --- Kakao marker ---
            if (kakaoMap) {
              const markerImage = new window.kakao.maps.MarkerImage(
                markerDataUrl,
                new window.kakao.maps.Size(36, 48),
                { offset: new window.kakao.maps.Point(18, 48) }
              );
              const marker = new window.kakao.maps.Marker({
                position: new window.kakao.maps.LatLng(result.lat, result.lng),
                image: markerImage,
                map: kakaoMap
              });
              const workRef = work;
              const coordsRef = result;
              window.kakao.maps.event.addListener(marker, 'click', () => {
                setSelectedWork(workRef);
                setSelectedCoords(coordsRef);
                setShowNavModal(false);
                kakaoMap.panTo(new window.kakao.maps.LatLng(coordsRef.lat, coordsRef.lng));
              });
              kakaoMarkersRef.current.push(marker);
            }

            markerInfos.push({ work, coords: result });
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

      // Fit bounds - 내 위치도 포함
      const myLoc = myLocationRef.current;
      if (myLoc) {
        olCoordsList.push(fromLonLat([myLoc.lng, myLoc.lat]) as [number, number]);
      }

      // Fit bounds - V-World
      if (olCoordsList.length > 0) {
        if (olCoordsList.length === 1) {
          olMap.getView().animate({ center: olCoordsList[0], zoom: 15, duration: 300 });
        } else {
          olMap.getView().fit(boundingExtent(olCoordsList), {
            padding: [60, 60, 60, 60], maxZoom: 16, duration: 300
          });
        }
      }

      // Fit bounds - Kakao (내 위치 포함)
      if (kakaoMap && (markerInfos.length > 0 || myLoc)) {
        const bounds = new window.kakao.maps.LatLngBounds();
        markerInfos.forEach(m => {
          bounds.extend(new window.kakao.maps.LatLng(m.coords.lat, m.coords.lng));
        });
        if (myLoc) {
          bounds.extend(new window.kakao.maps.LatLng(myLoc.lat, myLoc.lng));
        }
        kakaoMap.setBounds(bounds);
      }

      setIsLoading(false);
    })();

    return () => {
      disposed = true;
      olMap.setTarget(undefined);
      olMapRef.current = null;
      olVectorSourceRef.current = null;
      olMyLocFeatureRef.current = null;
      kakaoMarkersRef.current.forEach(m => m.setMap(null));
      kakaoMarkersRef.current = [];
      if (kakaoMyLocMarkerRef.current) kakaoMyLocMarkerRef.current.setMap(null);
      kakaoMyLocMarkerRef.current = null;
      kakaoMapRef.current = null;
      myLocationRef.current = null;
    };
  }, [workOrders]);

  // Map source switch → resize
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapSource === 'vworld' && olMapRef.current) {
        olMapRef.current.updateSize();
      } else if (mapSource === 'kakao' && kakaoMapRef.current) {
        kakaoMapRef.current.relayout();
        // Re-fit bounds
        if (markerInfosRef.current.length > 0) {
          const bounds = new window.kakao.maps.LatLngBounds();
          markerInfosRef.current.forEach(m => {
            bounds.extend(new window.kakao.maps.LatLng(m.coords.lat, m.coords.lng));
          });
          kakaoMapRef.current.setBounds(bounds);
        }
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [mapSource]);

  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        myLocationRef.current = { lat: latitude, lng: longitude };

        // OL 내 위치 마커 업데이트
        if (olMyLocFeatureRef.current) {
          (olMyLocFeatureRef.current.getGeometry() as Point).setCoordinates(fromLonLat([longitude, latitude]));
        } else if (olVectorSourceRef.current) {
          const f = new Feature({ geometry: new Point(fromLonLat([longitude, latitude])) });
          f.set('isMyLocation', true);
          f.setStyle(new Style({ image: new Icon({ src: createMyLocationMarkerUrl(), anchor: [0.5, 0.5], scale: 1 }) }));
          olVectorSourceRef.current.addFeature(f);
          olMyLocFeatureRef.current = f;
        }

        // 카카오 내 위치 마커 업데이트
        if (kakaoMyLocMarkerRef.current) {
          kakaoMyLocMarkerRef.current.setPosition(new window.kakao.maps.LatLng(latitude, longitude));
        } else if (kakaoMapRef.current) {
          const img = new window.kakao.maps.MarkerImage(
            createMyLocationMarkerUrl(),
            new window.kakao.maps.Size(40, 40),
            { offset: new window.kakao.maps.Point(20, 20) }
          );
          kakaoMyLocMarkerRef.current = new window.kakao.maps.Marker({
            position: new window.kakao.maps.LatLng(latitude, longitude),
            image: img, map: kakaoMapRef.current, zIndex: 10
          });
        }

        // 지도 이동
        if (mapSource === 'vworld' && olMapRef.current) {
          olMapRef.current.getView().animate({
            center: fromLonLat([longitude, latitude]),
            zoom: 15, duration: 500
          });
        } else if (mapSource === 'kakao' && kakaoMapRef.current) {
          kakaoMapRef.current.panTo(new window.kakao.maps.LatLng(latitude, longitude));
          kakaoMapRef.current.setLevel(3);
        }
      },
      () => alert('위치 정보를 가져올 수 없습니다.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [mapSource]);

  const handleNavigation = useCallback((app: NavApp) => {
    if (!selectedCoords || !selectedWork) return;
    openNavigation(app, {
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      name: selectedWork.customer?.address || '목적지'
    });
    setShowNavModal(false);
  }, [selectedCoords, selectedWork]);

  const closeInfoCard = useCallback(() => {
    setSelectedWork(null);
    setSelectedCoords(null);
    setShowNavModal(false);
  }, []);

  const toggleMapSource = useCallback(() => {
    setMapSource(prev => prev === 'vworld' ? 'kakao' : 'vworld');
    closeInfoCard();
  }, [closeInfoCard]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ zIndex: 200 }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-700">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">목록</span>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">작업 위치</h1>
        <button
          onClick={toggleMapSource}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border"
          style={{
            background: mapSource === 'vworld' ? '#EFF6FF' : '#FEF9C3',
            color: mapSource === 'vworld' ? '#1D4ED8' : '#92400E',
            borderColor: mapSource === 'vworld' ? '#BFDBFE' : '#FDE68A'
          }}
        >
          <Layers className="w-3.5 h-3.5" />
          {mapSource === 'vworld' ? '국토부' : '카카오'}
        </button>
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        {/* V-World (OpenLayers) */}
        <div
          ref={vworldContainerRef}
          className="absolute inset-0"
          style={{ display: mapSource === 'vworld' ? 'block' : 'none' }}
        />
        {/* Kakao Map */}
        <div
          ref={kakaoContainerRef}
          className="absolute inset-0"
          style={{ display: mapSource === 'kakao' ? 'block' : 'none' }}
        />

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
            <p className="text-gray-700 text-center mb-4">{loadError}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded-lg">
              새로고침
            </button>
          </div>
        )}

        {/* 범례 */}
        {!isLoading && !loadError && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-lg shadow p-2.5 z-20">
            <div className="flex gap-3 text-[11px]">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-500" style={{ background: '#3B82F6' }} />
                <span className="text-gray-600 font-semibold">내 위치</span>
              </div>
              {[['#DC2626', '진행중'], ['#16A34A', '완료'], ['#EF4444', '대기'], ['#9CA3AF', '취소']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  <span className="text-gray-600">{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 현재 위치 버튼 */}
        <button onClick={handleMyLocation} title="현재 위치"
          className="absolute bottom-20 right-4 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center z-20"
          style={{ bottom: selectedWork ? '220px' : '80px' }}
        >
          <Navigation className="w-5 h-5 text-blue-500" />
        </button>

        {/* 목록 보기 버튼 */}
        <button onClick={onBack}
          className="absolute left-4 px-4 py-2.5 bg-white rounded-full shadow-lg flex items-center gap-2 z-20"
          style={{ bottom: selectedWork ? '220px' : '80px' }}
        >
          <List className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">목록</span>
        </button>

        {/* 선택된 작업 정보 카드 (하단) */}
        {selectedWork && (
          <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-3">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-lg mx-auto relative">
              {/* 닫기 */}
              <button onClick={closeInfoCard} className="absolute top-3 right-3 p-1">
                <X size={16} className="text-gray-400" />
              </button>

              {/* 상태 + 유형 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{
                    background: `${STATUS_COLORS[selectedWork.status] || STATUS_COLORS.default}15`,
                    color: STATUS_COLORS[selectedWork.status] || STATUS_COLORS.default
                  }}>
                  {selectedWork.typeDisplay || selectedWork.type}
                </span>
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">
                  {selectedWork.status}
                </span>
              </div>

              {/* 고객명 */}
              <div className="font-semibold text-[15px] text-gray-900 mb-1 pr-6">
                {selectedWork.customer?.name || '고객명 없음'}
              </div>

              {/* 주소 */}
              <div className="text-[13px] text-gray-500 mb-3 leading-snug">
                {selectedWork.customer?.address || '주소 없음'}
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => { if (selectedWork.customer?.phone) window.location.href = `tel:${selectedWork.customer.phone}`; }}
                  className="flex-1 py-2.5 rounded-lg bg-blue-500 text-white text-xs font-medium active:bg-blue-600"
                >
                  전화
                </button>
                <button
                  onClick={() => setShowNavModal(!showNavModal)}
                  className="flex-1 py-2.5 rounded-lg bg-purple-500 text-white text-xs font-medium active:bg-purple-600"
                >
                  길찾기
                </button>
                <button
                  onClick={() => onSelectWork(selectedWork)}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-500 text-white text-xs font-medium active:bg-emerald-600"
                >
                  상세보기
                </button>
              </div>

              {/* 네비 앱 선택 */}
              {showNavModal && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleNavigation('kakao')}
                    className="flex-1 py-2.5 rounded-lg font-semibold text-xs active:opacity-80"
                    style={{ background: '#FEE500', color: '#3C1E1E' }}>
                    카카오맵
                  </button>
                  <button onClick={() => handleNavigation('tmap')}
                    className="flex-1 py-2.5 rounded-lg font-semibold text-xs text-white active:opacity-80"
                    style={{ background: '#1C6EF2' }}>
                    T맵
                  </button>
                  <button onClick={() => handleNavigation('naver')}
                    className="flex-1 py-2.5 rounded-lg font-semibold text-xs text-white active:opacity-80"
                    style={{ background: '#1EC800' }}>
                    네이버
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 하단 정보 */}
      <div className="px-4 py-2.5 bg-white border-t border-gray-200">
        <div className="text-center text-sm text-gray-500">
          총 {workOrders.length}건 {geocodedSuccess > 0 && !isLoading && `(${geocodedSuccess}건 표시)`}
        </div>
      </div>
    </div>
  );
};

export default WorkMapView;
