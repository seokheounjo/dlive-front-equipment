# EC2 + PM2 BFF 프록시 배포 가이드

## 🚀 배포 과정

### 1. 최신 코드 받기
```bash
git pull origin main
```

### 2. 패키지 설치
```bash
npm install
```

### 3. PM2로 프로덕션 배포 (빌드 + 시작)
```bash
# 기존 PM2 프로세스 중지 (있다면)
pm2 stop all
pm2 delete all

# 자동 빌드 + PM2 시작
sudo npm run pm2:start

# PM2 상태 확인
pm2 status

# PM2 로그 확인 (실시간)
npm run pm2:logs

# 포트 80 사용 확인
sudo netstat -tlnp | grep :80

# PM2 재시작
npm run pm2:restart

# PM2 중지
npm run pm2:stop
```

### 4. 문제 해결
```bash
# 404 오류 시 확인사항
pm2 logs dlive-cona-front --lines 50

# Express 서버 직접 실행 (디버깅)
sudo node server.js

# 프로세스 확인
ps aux | grep node
```

### 4. 수동 테스트 (선택사항)
```bash
# 빌드만
npm run build:ec2

# 서버 직접 실행 (테스트용)
npm run start:ec2
```

## 🛡️ IP 제한 기능

### 허용된 IP 목록
- `211.32.50.55` - 기존 허용 IP
- `58.143.140.34` - 추가 허용 IP 1
- `58.143.140.167` - 추가 허용 IP 2
- `58.143.140.222` - 딜라이브 내부서버 IP
- `193.186.4.167` - 딜라이브 사무실 IP
- `127.0.0.1` - 로컬호스트

### IP 추가 방법
`server.js` 파일의 `ALLOWED_IPS` 배열에 IP 추가 후 재시작

## 🔗 API 호출 흐름
```
딜라이브 사무실 (193.186.4.167)
    ↓ 브라우저 접속
EC2 서버 (52.63.131.157) ← Express.js IP 제한
    ↓ JavaScript API 호출
딜라이브 내부서버 (58.143.140.222:8080)
```

## 📝 로그 확인
```bash
# PM2 로그 실시간 확인
pm2 logs dlive-cona-front --lines 100

# 접근 로그 확인
pm2 logs dlive-cona-front | grep "접근"
```

## 🔧 문제 해결
- **403 접근 거부**: IP가 허용 목록에 없음 → IP 추가 필요
- **API 호출 실패**: 딜라이브 내부서버 방화벽 확인 필요
- **CORS 오류**: 딜라이브 서버 CORS 설정 확인 필요
