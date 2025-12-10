import { 
  Wrench, 
  Home, 
  Truck, 
  Settings, 
  Wifi, 
  Monitor, 
  Cable,
  Router,
  Smartphone,
  Tv,
  Plus,
  ArrowRightLeft,
  LucideIcon
} from 'lucide-react';

export const getWorkTypeIcon = (workType: string): LucideIcon => {
  const type = workType.toLowerCase();
  
  // A/S 관련
  if (type.includes('a/s') || type.includes('as') || type.includes('수리') || type.includes('점검')) {
    return Wrench;
  }
  
  // 신규 설치
  if (type.includes('신규') && (type.includes('설치') || type.includes('개통'))) {
    return Plus;
  }
  
  // 이전 설치
  if (type.includes('이전') || type.includes('이사') || type.includes('이설')) {
    return ArrowRightLeft;
  }
  
  // 일반 설치 (신규가 아닌 경우)
  if (type.includes('설치') || type.includes('개통')) {
    return Home;
  }
  
  // 인터넷/네트워크 관련
  if (type.includes('인터넷') || type.includes('네트워크') || type.includes('wifi') || type.includes('와이파이')) {
    return Wifi;
  }
  
  // TV/방송 관련
  if (type.includes('tv') || type.includes('방송') || type.includes('케이블')) {
    return Tv;
  }
  
  // 전화 관련
  if (type.includes('전화') || type.includes('phone')) {
    return Smartphone;
  }
  
  // 모니터/화면 관련
  if (type.includes('모니터') || type.includes('화면') || type.includes('디스플레이')) {
    return Monitor;
  }
  
  // 케이블/선로 관련
  if (type.includes('케이블') || type.includes('선로') || type.includes('배선')) {
    return Cable;
  }
  
  // 라우터/장비 관련
  if (type.includes('라우터') || type.includes('모뎀') || type.includes('장비')) {
    return Router;
  }
  
  // 기본값 (설정/기타)
  return Settings;
};

export const getWorkTypeIconColor = (workType: string): string => {
  const type = workType.toLowerCase();

  // 개통/신규 설치 - 초록색 (emerald)
  if (type.includes('개통') || (type.includes('신규') && type.includes('설치'))) {
    return 'text-emerald-500';
  }

  // A/S - 오렌지색
  if (type.includes('a/s') || type.includes('as') || type.includes('수리') || type.includes('점검')) {
    return 'text-orange-500';
  }

  // 해지 - 빨강색
  if (type.includes('해지') || type.includes('철거')) {
    return 'text-red-500';
  }

  // 이전 - 파란색
  if (type.includes('이전') || type.includes('이사') || type.includes('이설')) {
    return 'text-blue-500';
  }

  // 상품변경 - 보라색
  if (type.includes('변경') || type.includes('전환')) {
    return 'text-purple-500';
  }

  // 정지 - 회색
  if (type.includes('정지') || type.includes('중지')) {
    return 'text-gray-500';
  }

  // 일반 설치 - 파란색
  if (type.includes('설치')) {
    return 'text-blue-500';
  }

  // 인터넷/네트워크 - 청록색
  if (type.includes('인터넷') || type.includes('네트워크') || type.includes('wifi') || type.includes('와이파이')) {
    return 'text-cyan-500';
  }

  // TV/방송 - 인디고색
  if (type.includes('tv') || type.includes('방송') || type.includes('케이블')) {
    return 'text-indigo-500';
  }

  // 전화 - 분홍색
  if (type.includes('전화') || type.includes('phone')) {
    return 'text-pink-500';
  }

  // 기본값 - 회색
  return 'text-gray-500';
};
