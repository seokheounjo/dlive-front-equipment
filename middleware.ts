// Vercel Edge Runtime용 간단한 middleware
export function middleware(request: Request): Response | undefined {
  console.log('🔍 Middleware 실행됨 - URL:', request.url);
  
  // 허용된 IP 목록
  const ALLOWED_IPS = [
    '211.32.50.55',    // 기존 허용 IP
    '58.143.140.34',   // 추가 허용 IP 1
    '58.143.140.167',  // 추가 허용 IP 2
    '58.143.140.222',  // 딜라이브 내부서버 IP
    '193.186.4.167',   // 딜라이브 사무실 IP 추가
    '127.0.0.1',       // 로컬호스트
  ];

  try {
    // URL 파싱
    const url = new URL(request.url);
    console.log('🔍 요청 경로:', url.pathname);
    
    // API 경로는 IP 체크 제외
    if (url.pathname.startsWith('/api/')) {
      console.log('✅ API 경로 - IP 체크 제외');
      return undefined;
    }
    
    // 클라이언트 IP 추출 (여러 헤더 확인)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    const clientIP = cfConnectingIP || realIP || (forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown');
    
    console.log('🔍 IP 헤더들:', {
      'x-forwarded-for': forwardedFor,
      'x-real-ip': realIP,
      'cf-connecting-ip': cfConnectingIP,
      '최종 IP': clientIP
    });
    
    // 허용된 IP인지 확인 (디버깅: 일시적으로 모든 IP 허용)
    if (clientIP !== 'unknown' && !ALLOWED_IPS.includes(clientIP)) {
      console.log(`⚠️ 새로운 IP 접근 시도: ${clientIP} - 임시 허용 중`);
      
      // 임시: 딜라이브 IP 대역 허용 (58.143.140.x)
      if (clientIP.startsWith('58.143.140.')) {
        console.log(`✅ 딜라이브 IP 대역 임시 허용: ${clientIP}`);
        return undefined; // 허용
      }
      
      console.log(`❌ 접근 차단: ${clientIP}`);
      return new Response(`
        <html>
          <head><title>접근 거부</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
            <h1 style="color: #dc2626;">🚫 접근 거부</h1>
            <p>허가되지 않은 IP에서의 접근입니다.</p>
            <p>현재 IP: <strong>${clientIP}</strong></p>
            <p>허용된 IP: ${ALLOWED_IPS.join(', ')}</p>
            <p>문의: 딜라이브 관리자</p>
          </body>
        </html>
      `, { 
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    console.log(`접근 허용: ${clientIP}`);
    return undefined; // 다음 단계로 진행
  } catch (error) {
    console.error('Middleware 오류:', error);
    return undefined; // 오류 시 통과
  }
}

// 모든 경로에 적용 (API 경로 제외)
export const config = {
  matcher: [
    /*
     * 다음 경로들을 제외한 모든 경로에 적용:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
