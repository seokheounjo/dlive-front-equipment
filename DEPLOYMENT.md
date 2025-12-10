# 모바일 코나 프론트 - 내부망 배포 가이드

## 배포 전 체크리스트

### 1. 백엔드 서버 준비
- [ ] 백엔드 API 서버 IP/도메인 확인
- [ ] 백엔드 API 서버 포트 확인 (기본: 8080)
- [ ] 백엔드 API 경로 확인 (기본: /api)

### 2. 프론트엔드 환경 설정

#### .env.production 파일 생성
```bash
cd mobile-cona-front
cp .env.production.example .env.production
```

#### .env.production 파일 수정
```bash
# 내부망 백엔드 서버 주소로 변경
VITE_API_BASE_URL=http://내부서버IP:8080/api

# 예시:
# VITE_API_BASE_URL=http://192.168.1.100:8080/api
# VITE_API_BASE_URL=http://dlive-server.internal:8080/api
```

### 3. 프로덕션 빌드

```bash
npm run build
```

빌드 완료 후 `dist` 폴더가 생성됩니다.

### 4. 배포 방법

#### 옵션 1: Nginx 정적 파일 서빙 (권장)

**Nginx 설정 예시:**
```nginx
server {
    listen 80;
    server_name 내부서버도메인;

    root /var/www/mobile-cona-front/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 프록시 (선택사항 - 환경변수 대신 Nginx 프록시 사용 시)
    location /api {
        proxy_pass http://백엔드서버:8080/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**배포 명령:**
```bash
# dist 폴더를 서버로 복사
scp -r dist/* user@내부서버:/var/www/mobile-cona-front/dist/

# Nginx 재시작
ssh user@내부서버 "sudo systemctl restart nginx"
```

#### 옵션 2: Apache 서빙

**.htaccess 파일 (dist 폴더에 생성):**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**배포 명령:**
```bash
# dist 폴더를 서버로 복사
scp -r dist/* user@내부서버:/var/www/html/mobile-cona/
```

#### 옵션 3: Node.js 서버 (개발/테스트용)

```bash
# serve 패키지 설치 (전역)
npm install -g serve

# dist 폴더 서빙
serve -s dist -p 3000
```

## 배포 시나리오별 설정

### 시나리오 A: 프론트/백엔드 같은 서버
```bash
# .env.production
VITE_API_BASE_URL=http://localhost:8080/api
# 또는
VITE_API_BASE_URL=/api  # Nginx 프록시 사용 시
```

### 시나리오 B: 프론트/백엔드 다른 서버
```bash
# .env.production
VITE_API_BASE_URL=http://백엔드서버IP:8080/api
```

### 시나리오 C: 도메인 사용
```bash
# .env.production
VITE_API_BASE_URL=http://dlive-api.internal.company.com/api
```

## 트러블슈팅

### CORS 오류 발생 시
백엔드 서버에서 프론트엔드 도메인을 CORS 허용 목록에 추가:
```java
// Spring 백엔드 예시
@CrossOrigin(origins = {"http://프론트서버IP", "http://프론트도메인"})
```

### API 연결 실패 시
1. 브라우저 개발자도구 → Console 확인
2. `[API 초기화] 환경변수 사용: http://...` 로그 확인
3. Network 탭에서 실제 요청 URL 확인
4. 백엔드 서버 방화벽/포트 확인

### 빌드 파일이 최신이 아닐 때
```bash
# 캐시 삭제 후 재빌드
rm -rf dist node_modules/.vite
npm run build
```

## 백엔드 배포 (참고)

현재 백엔드는 이미 빌드된 JAR 파일 사용:
- `adapter-build-deploy/dlive-api-deployment-20251117_114048/api-controllers.jar`
- `adapter-build-deploy/dlive-api-deployment-20251117_114048/api-servlet.xml`

**백엔드 재빌드 불필요** - 모든 필수 파라미터 이미 지원됨

## 현재 빌드 정보

- 프론트엔드 마지막 수정: 작업완료 파라미터 추가 (STTL_YN, CNFM_CUST_NM, CNFM_CUST_TELNO)
- 백엔드 JAR: 2025.11.17 빌드 (변경 불필요)
- 프록시 설정: 환경변수 기반 (VITE_API_BASE_URL)

## 체크리스트 (배포 전 최종 확인)

- [ ] .env.production 파일에 올바른 백엔드 주소 설정
- [ ] npm run build 실행 성공
- [ ] dist 폴더 생성 확인
- [ ] dist/index.html 파일 존재 확인
- [ ] 백엔드 서버 정상 작동 확인
- [ ] 방화벽 포트 오픈 확인
- [ ] CORS 설정 확인
- [ ] 내부망 네트워크 연결 확인
