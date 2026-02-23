// 네비게이션 앱 딥링크 유틸리티
// 카카오맵, T맵, 네이버지도 앱으로 길찾기 연동

type NavApp = 'kakao' | 'tmap' | 'naver';

interface NavigationTarget {
  lat: number;
  lng: number;
  name: string;
}

const isIOS = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent);

// 카카오맵 길찾기
export const openKakaoNavigation = ({ lat, lng, name }: NavigationTarget): void => {
  // kakaomap://route?ep=lat,lng&by=car (sp 생략 = 현재위치 출발)
  const appUrl = `kakaomap://route?ep=${lat},${lng}&by=car`;
  const webUrl = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;

  openAppOrFallback(appUrl, webUrl);
};

// T맵 길찾기
export const openTmapNavigation = ({ lat, lng, name }: NavigationTarget): void => {
  const appUrl = `tmap://route?goaly=${lat}&goalx=${lng}&goalname=${encodeURIComponent(name)}`;
  const storeUrl = isIOS()
    ? 'https://apps.apple.com/kr/app/tmap/id431589174'
    : 'market://details?id=com.skt.tmap.ku';

  openAppOrFallback(appUrl, storeUrl);
};

// 네이버지도 길찾기
export const openNaverNavigation = ({ lat, lng, name }: NavigationTarget): void => {
  const appUrl = `nmap://navigation?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(name)}&appname=com.dlive.cona`;
  const storeUrl = isIOS()
    ? 'https://apps.apple.com/kr/app/naver-map/id311867728'
    : 'market://details?id=com.nhn.android.nmap';

  openAppOrFallback(appUrl, storeUrl);
};

// 앱 열기 시도 → 실패 시 fallback (웹/스토어)
function openAppOrFallback(appUrl: string, fallbackUrl: string): void {
  const start = Date.now();
  const timeout = 1500;

  // hidden iframe으로 딥링크 시도
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = appUrl;
  document.body.appendChild(iframe);

  setTimeout(() => {
    document.body.removeChild(iframe);
    // 앱이 열리면 페이지가 blur되므로, 아직 포커스가 있으면 앱 미설치
    if (Date.now() - start < timeout + 500) {
      window.location.href = fallbackUrl;
    }
  }, timeout);
}

// 네비 앱 열기 (통합)
export const openNavigation = (app: NavApp, target: NavigationTarget): void => {
  switch (app) {
    case 'kakao': openKakaoNavigation(target); break;
    case 'tmap': openTmapNavigation(target); break;
    case 'naver': openNaverNavigation(target); break;
  }
};

export type { NavApp, NavigationTarget };
