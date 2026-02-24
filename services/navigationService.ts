// 네비게이션 앱 딥링크 유틸리티

type NavApp = 'kakao' | 'tmap' | 'naver';

interface NavigationTarget {
  lat: number;
  lng: number;
  name: string;
}

const isIOS = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent);

// 카카오맵 길찾기 (sp 생략 = 현재위치 출발)
export const openKakaoNavigation = ({ lat, lng, name }: NavigationTarget): void => {
  const appUrl = `kakaomap://route?ep=${lat},${lng}&by=car`;
  const webUrl = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
  openApp(appUrl, webUrl);
};

// T맵 길찾기 (현재위치 → 목적지)
export const openTmapNavigation = ({ lat, lng, name }: NavigationTarget): void => {
  const appUrl = `tmap://route?goaly=${lat}&goalx=${lng}&goalname=${encodeURIComponent(name)}`;
  const fallback = isIOS()
    ? 'https://apps.apple.com/kr/app/tmap/id431589174'
    : 'market://details?id=com.skt.tmap.ku';
  openApp(appUrl, fallback);
};

// 네이버지도 길찾기 (현재위치 → 목적지)
export const openNaverNavigation = ({ lat, lng, name }: NavigationTarget): void => {
  const appUrl = `nmap://navigation?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(name)}&appname=com.dlive.cona`;
  const fallback = isIOS()
    ? 'https://apps.apple.com/kr/app/naver-map/id311867728'
    : 'market://details?id=com.nhn.android.nmap';
  openApp(appUrl, fallback);
};

// 앱 열기: 직접 location.href로 시도, 실패 시 fallback
function openApp(appUrl: string, fallbackUrl: string): void {
  // 모바일에서는 직접 URL scheme으로 이동
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isMobile = isIOS() || isAndroid;

  if (isMobile) {
    // Android Intent 방식 (더 안정적)
    if (isAndroid && appUrl.startsWith('kakaomap://')) {
      window.location.href = `intent://route?ep=${appUrl.split('ep=')[1]}#Intent;scheme=kakaomap;package=net.daum.android.map;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
      return;
    }
    if (isAndroid && appUrl.startsWith('tmap://')) {
      window.location.href = `intent://${appUrl.replace('tmap://', '')}#Intent;scheme=tmap;package=com.skt.tmap.ku;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
      return;
    }
    if (isAndroid && appUrl.startsWith('nmap://')) {
      window.location.href = `intent://${appUrl.replace('nmap://', '')}#Intent;scheme=nmap;package=com.nhn.android.nmap;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
      return;
    }

    // iOS: 직접 URL scheme
    window.location.href = appUrl;
    setTimeout(() => {
      // 앱이 안 열렸으면 (페이지가 아직 보이면) fallback
      if (!document.hidden) {
        window.location.href = fallbackUrl;
      }
    }, 2000);
  } else {
    // PC: 웹 fallback 바로 열기
    window.open(fallbackUrl, '_blank');
  }
}

// 통합
export const openNavigation = (app: NavApp, target: NavigationTarget): void => {
  switch (app) {
    case 'kakao': openKakaoNavigation(target); break;
    case 'tmap': openTmapNavigation(target); break;
    case 'naver': openNaverNavigation(target); break;
  }
};

// 카카오 SDK 로드 대기
function ensureKakaoGeocoder(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).kakao?.maps?.services) { resolve(true); return; }
    if ((window as any).kakao?.maps) {
      (window as any).kakao.maps.load(() => resolve(!!(window as any).kakao.maps.services));
      return;
    }
    let t = 0;
    const iv = setInterval(() => {
      t++;
      if ((window as any).kakao?.maps) {
        clearInterval(iv);
        if ((window as any).kakao.maps.services) { resolve(true); return; }
        (window as any).kakao.maps.load(() => resolve(!!(window as any).kakao.maps.services));
      } else if (t > 25) {
        clearInterval(iv);
        const s = document.createElement('script');
        s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=60a7bd1a64feb3d63955a9165bb4bc79&libraries=services&autoload=false';
        s.onload = () => {
          if ((window as any).kakao?.maps) {
            (window as any).kakao.maps.load(() => resolve(!!(window as any).kakao.maps.services));
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
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) { resolve(null); return; }
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
      } else {
        const cleaned = address.replace(/\(.*?\)/g, '').replace(/\d+[층호]/g, '').replace(/\s{2,}/g, ' ').trim();
        if (cleaned !== address) {
          geocoder.addressSearch(cleaned, (r2: any, s2: any) => {
            if (s2 === kakao.maps.services.Status.OK && r2[0]) {
              resolve({ lat: parseFloat(r2[0].y), lng: parseFloat(r2[0].x) });
            } else resolve(null);
          });
        } else resolve(null);
      }
    });
  });
}

// 주소 → geocoding → 네비 앱 실행
export async function geocodeAndNavigate(address: string, app: NavApp): Promise<boolean> {
  const ready = await ensureKakaoGeocoder();
  if (!ready) return false;
  const coords = await geocodeAddress(address);
  if (!coords) return false;
  openNavigation(app, { lat: coords.lat, lng: coords.lng, name: address });
  return true;
}

export type { NavApp, NavigationTarget };
