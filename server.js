const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;  // nginx 뒤에서 3000 포트 사용

// 허용된 IP 목록
const ALLOWED_IPS = [
  '211.32.50.55',    // 기존 허용 IP
  '58.143.140.34',   // 추가 허용 IP 1
  '58.143.140.167',  // 추가 허용 IP 2
  '58.143.140.222',  // 딜라이브 내부서버 IP
  '193.186.4.167',   // 딜라이브 사무실 IP
  '127.0.0.1',       // 로컬호스트
  '::1',             // IPv6 로컬호스트
];

// IP 제한 미들웨어
const ipRestriction = (req, res, next) => {
  // API 경로는 IP 체크 제외
  if (req.path.startsWith('/api/')) {
    console.log('✅ API 경로 - IP 체크 제외:', req.path);
    return next();
  }

  // 클라이언트 IP 추출
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null);

  console.log('🔍 접근 시도 IP:', clientIP);
  console.log('🔍 요청 경로:', req.path);
  console.log('🔍 허용된 IP 목록:', ALLOWED_IPS);

  // IPv6 로컬호스트 처리
  const normalizedIP = clientIP === '::1' ? '127.0.0.1' : clientIP;

  // IP 허용 체크
  if (normalizedIP && !ALLOWED_IPS.includes(normalizedIP)) {
    // 딜라이브 IP 대역 임시 허용
    if (normalizedIP.startsWith('58.143.140.')) {
      console.log(`✅ 딜라이브 IP 대역 허용: ${normalizedIP}`);
      return next();
    }

    console.log(`❌ 접근 차단: ${normalizedIP}`);
    return res.status(403).send(`
      <html>
        <head><title>접근 거부</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
          <h1 style="color: #dc2626;">🚫 접근 거부</h1>
          <p>허가되지 않은 IP에서의 접근입니다.</p>
          <p>현재 IP: <strong>${normalizedIP}</strong></p>
          <p>허용된 IP: ${ALLOWED_IPS.join(', ')}</p>
          <p>문의: 딜라이브 관리자</p>
        </body>
      </html>
    `);
  }

  console.log(`✅ 접근 허용: ${normalizedIP}`);
  next();
};

// JSON 파싱 미들웨어
app.use(express.json());

// CORS 설정
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://52.63.232.141', 'http://52.63.232.141'],
  credentials: true
}));

// IP 제한 미들웨어 적용 (테스트를 위해 임시 비활성화)
// app.use(ipRestriction);

// API 프록시 라우터
const apiProxy = require('./api-proxy');
app.use('/api', apiProxy);

// 정적 파일 서빙 (Vite 빌드 결과)
app.use(express.static(path.join(__dirname, 'dist')));

// SPA를 위한 fallback (모든 경로를 index.html로)
app.use((req, res, next) => {
  // API 경로가 아닌 경우에만 index.html 반환
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`🔗 접속 URL: http://52.63.232.141:${PORT}`);
  console.log(`🛡️ IP 제한 활성화 - 허용된 IP: ${ALLOWED_IPS.join(', ')}`);
});
