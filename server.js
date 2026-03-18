const express = require('express');
const cors = require('cors');
const path = require('path');
const webpush = require('web-push');
const cron = require('node-cron');
const fs = require('fs');

// .env 파일 로드 (dotenv 없이 직접 파싱)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...vals] = line.split('=');
      if (key && vals.length > 0 && !process.env[key.trim()]) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

// JSON 파싱 미들웨어 (이미지 Base64 업로드를 위해 50MB 제한)
app.use(express.json({ limit: '50mb' }));

// CORS 설정
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://52.63.131.157',
    'http://58.143.140.5',
    'http://58.143.140.5:3000',
    'http://58.143.140.5:8080',
    'https://roomtobe.co.kr',
    'http://roomtobe.co.kr'
  ],
  credentials: true
}));

// ==================== Web Push 설정 ====================
const VAPID_KEYS_PATH = path.join(__dirname, 'vapid-keys.json');
const SUBSCRIPTIONS_PATH = path.join(__dirname, 'push-subscriptions.json');

// VAPID 키 로드 또는 생성
let vapidKeys;
if (fs.existsSync(VAPID_KEYS_PATH)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEYS_PATH, 'utf8'));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_KEYS_PATH, JSON.stringify(vapidKeys, null, 2));
  console.log('[Push] VAPID 키 생성 완료');
}

webpush.setVapidDetails(
  'mailto:admin@roomtobe.co.kr',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// 구독 목록 로드
function loadSubscriptions() {
  if (fs.existsSync(SUBSCRIPTIONS_PATH)) {
    return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_PATH, 'utf8'));
  }
  return [];
}

function saveSubscriptions(subs) {
  fs.writeFileSync(SUBSCRIPTIONS_PATH, JSON.stringify(subs, null, 2));
}

// Push 엔드포인트
app.get('/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/push/subscribe', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  const subs = loadSubscriptions();
  const exists = subs.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subs.push(subscription);
    saveSubscriptions(subs);
    console.log(`[Push] 새 구독 등록 (총 ${subs.length}개)`);
  }
  res.json({ success: true });
});

app.post('/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint required' });
  }
  let subs = loadSubscriptions();
  subs = subs.filter(s => s.endpoint !== endpoint);
  saveSubscriptions(subs);
  console.log(`[Push] 구독 해제 (총 ${subs.length}개)`);
  res.json({ success: true });
});

// 푸시 발송 함수
async function sendPushToAll(payload) {
  const subs = loadSubscriptions();
  if (subs.length === 0) {
    console.log('[Push] 등록된 구독 없음');
    return { sent: 0, failed: 0 };
  }
  const message = JSON.stringify(payload);
  let sent = 0, failed = 0;
  const invalidEndpoints = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, message);
      sent++;
    } catch (err) {
      failed++;
      console.log(`[Push] 발송 실패: ${err.statusCode || err.message}`);
      if (err.statusCode === 404 || err.statusCode === 410) {
        invalidEndpoints.push(sub.endpoint);
      }
    }
  }

  // 만료된 구독 정리
  if (invalidEndpoints.length > 0) {
    const cleaned = subs.filter(s => !invalidEndpoints.includes(s.endpoint));
    saveSubscriptions(cleaned);
    console.log(`[Push] 만료 구독 ${invalidEndpoints.length}개 정리`);
  }

  console.log(`[Push] 발송 완료: 성공 ${sent}, 실패 ${failed}`);
  return { sent, failed };
}

// 수동 발송 (테스트용)
app.post('/push/send', async (req, res) => {
  const payload = req.body && req.body.title ? req.body : {
    title: "D'LIVE 알림",
    body: '퇴근 시간입니다! 오늘도 수고하셨습니다.',
    url: '/'
  };
  const result = await sendPushToAll(payload);
  res.json(result);
});

// 퇴근 알림 (18:00 기준)
cron.schedule('30 17 * * 1-5', async () => {
  console.log('[Cron] 17:30 퇴근 30분 전 알림');
  await sendPushToAll({
    title: "D'LIVE 퇴근 알림",
    body: '퇴근 30분 전입니다! 마무리 준비하세요.',
    url: '/'
  });
}, { timezone: 'Asia/Seoul' });

cron.schedule('40 17 * * 1-5', async () => {
  console.log('[Cron] 17:40 퇴근 20분 전 알림');
  await sendPushToAll({
    title: "D'LIVE 퇴근 알림",
    body: '퇴근 20분 전입니다! 업무 정리하세요.',
    url: '/'
  });
}, { timezone: 'Asia/Seoul' });

cron.schedule('50 17 * * 1-5', async () => {
  console.log('[Cron] 17:50 퇴근 10분 전 알림');
  await sendPushToAll({
    title: "D'LIVE 퇴근 알림",
    body: '퇴근 10분 전입니다! 오늘도 수고하셨습니다.',
    url: '/'
  });
}, { timezone: 'Asia/Seoul' });

// ==================== 이미지 업로드 엔드포인트 ====================
const SAFE_IMAGE_DIR = path.join(__dirname, 'safe_image');
const PAYMENT_IMAGE_DIR = path.join(__dirname, 'payment_image');

// 디렉토리 존재 확인
if (!fs.existsSync(SAFE_IMAGE_DIR)) fs.mkdirSync(SAFE_IMAGE_DIR, { recursive: true });
if (!fs.existsSync(PAYMENT_IMAGE_DIR)) fs.mkdirSync(PAYMENT_IMAGE_DIR, { recursive: true });

// 안전점검 이미지 업로드
app.post('/upload/safe-image', (req, res) => {
  try {
    const { images, userId } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'images array required' });
    }

    const savedPaths = [];
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    for (let i = 0; i < images.length; i++) {
      const base64Data = images[i].replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${userId || 'unknown'}_${dateStr}_${timeStr}_${i + 1}.jpg`;
      const filePath = path.join(SAFE_IMAGE_DIR, filename);

      fs.writeFileSync(filePath, buffer);
      savedPaths.push(`/safe_image/${filename}`);
      console.log(`[Upload] 안전점검 이미지 저장: ${filename} (${buffer.length} bytes)`);
    }

    res.json({ success: true, paths: savedPaths });
  } catch (error) {
    console.error('[Upload] 이미지 저장 실패:', error);
    res.status(500).json({ error: 'Image save failed', message: error.message });
  }
});

// 안전점검 이미지 삭제 (재업로드 시 이전 파일 삭제용)
app.post('/upload/delete-safe-image', (req, res) => {
  try {
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths)) {
      return res.status(400).json({ error: 'paths array required' });
    }
    let deleted = 0;
    for (const p of paths) {
      const filename = path.basename(p);
      const filePath = path.join(SAFE_IMAGE_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted++;
        console.log(`[Upload] 이미지 삭제: ${filename}`);
      }
    }
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('[Upload] 이미지 삭제 실패:', error);
    res.status(500).json({ error: 'Delete failed', message: error.message });
  }
});

// safe_image, payment_image 인증 후 서빙 (보안: 로그인 상태에서만 접근 가능)
// api-proxy.js의 storedUserId를 참조하여 로그인 여부 판단
const fileAuthCheck = (req, res, next) => {
  // api-proxy 모듈에서 storedUserId 가져오기
  const apiProxy = require('./api-proxy');
  const isAuthenticated = apiProxy.getStoredUserId && apiProxy.getStoredUserId();

  // Referer 체크: 같은 도메인에서의 요청만 허용
  const referer = req.headers.referer || '';
  const host = req.headers.host || '';
  const isSameOrigin = referer.includes(host);

  if (isAuthenticated || isSameOrigin) {
    return next();
  }

  console.log(`[Security] Blocked file access: ${req.originalUrl} (no auth, referer: ${referer})`);
  res.status(401).json({ error: 'Unauthorized', message: 'Login required to access files' });
};

app.use('/safe_image', fileAuthCheck, express.static(SAFE_IMAGE_DIR));
app.use('/payment_image', fileAuthCheck, express.static(PAYMENT_IMAGE_DIR));

// API 프록시 라우터
const apiProxy = require('./api-proxy');
app.use('/api', apiProxy);

// Hashed assets (JS/CSS with content hash) - long cache (1 year, immutable)
app.use('/assets', express.static(path.join(__dirname, 'dist/assets'), {
  maxAge: '1y',
  immutable: true
}));

// Other static files - short cache
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // index.html should never be cached (always get latest)
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// SPA를 위한 fallback (모든 경로를 index.html로)
app.use((req, res, next) => {
  // API 경로나 정적 파일 요청이 아닌 경우에만 index.html 반환
  const isStaticFile = req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json)$/);
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/push/') && !req.path.startsWith('/upload/') && !req.path.startsWith('/safe_image/') && !req.path.startsWith('/payment_image/') && !isStaticFile) {
    // index.html은 캐시하지 않음 (항상 최신 버전 제공)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`🔗 접속 URL: https://roomtobe.co.kr`);
});
