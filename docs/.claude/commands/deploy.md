---
description: EC2 서버에 변경사항 배포 및 검증
---

# EC2 배포 프로세스

현재 변경사항을 EC2 프로덕션 서버에 배포하고 동작을 검증합니다.

## 배포 전 체크리스트

반드시 확인:
- [ ] PR이 main에 merge되었는가?
- [ ] 로컬 빌드가 성공했는가? (`npm run build`)
- [ ] TypeScript 에러가 없는가? (`npm run type-check`)
- [ ] Git status가 깨끗한가? (커밋 안 된 변경사항 없음)

## 배포 순서

### Step 1: PR 확인 및 로컬 main 업데이트

```bash
# GitHub에서 PR Merge 확인
# → https://github.com/teemartbottle/dlive-cona-client/pulls

# 로컬 main 브랜치 업데이트
git checkout main
git pull teamart main

# 최신 커밋 확인
git log --oneline -5
```

### Step 2: EC2 SSH 접속

**서버 정보**:
- IP: 52.63.131.157
- User: ubuntu
- Directory: /home/ubuntu/dlive-cona-client
- PM2 Process: dlive

```bash
# SSH 접속
ssh ubuntu@52.63.131.157

# 또는 키 파일 사용
ssh -i /path/to/ec2_key.pem ubuntu@52.63.131.157
```

### Step 3: 배포 스크립트 실행

```bash
# 배포 디렉토리로 이동
cd /home/ubuntu/dlive-cona-client

# 현재 브랜치 확인
git branch
# → * main

# 최신 코드 가져오기
git pull origin main

# 의존성 업데이트 (package.json 변경 시만)
npm install

# 빌드
npm run build

# PM2 재시작
pm2 restart dlive

# 로그 확인
pm2 logs dlive --lines 20
```

**자동화 스크립트** (이미 생성됨):
```bash
# /tmp/ec2_deploy.sh 실행
bash /tmp/ec2_deploy.sh
```

### Step 4: 배포 검증

#### 4-1. PM2 상태 확인
```bash
pm2 status

# 예상 출력:
# ┌─────┬──────┬─────────┬──────┬───────┐
# │ id  │ name │ status  │ cpu  │ memory│
# ├─────┼──────┼─────────┼──────┼───────┤
# │ 0   │ dlive│ online  │ 0%   │ 50 MB │
# └─────┴──────┴─────────┴──────┴───────┘

# ❌ status가 errored 또는 stopped이면 문제!
```

#### 4-2. 로그 확인
```bash
# 최근 50줄 로그 확인
pm2 logs dlive --lines 50

# 실시간 로그 (Ctrl+C로 종료)
pm2 logs dlive

# 에러 로그만 확인
pm2 logs dlive --err
```

**정상 로그 예시**:
```
[2025-01-28 10:30:00] Express server listening on port 80
[2025-01-28 10:30:01] API proxy ready: /api → 58.143.140.222:8080
```

**에러 로그 예시**:
```
Error: Cannot find module 'express'
```

#### 4-3. 포트 확인
```bash
# 80번 포트 LISTEN 확인
sudo netstat -tlnp | grep 80

# 예상 출력:
# tcp6  0  0 :::80  :::*  LISTEN  12345/node
```

#### 4-4. cURL 테스트
```bash
# 루트 페이지 확인
curl -I http://52.63.131.157/

# 예상: HTTP/1.1 200 OK

# API 테스트
curl -X POST http://52.63.131.157/api/statistics/equipment/getEquipmentHistoryInfo \
  -H "Content-Type: application/json" \
  -d '{"EQT_SERNO":"TEST"}'

# 예상: JSON 응답 또는 에러 메시지
```

### Step 5: 브라우저 테스트

```
1. http://52.63.131.157/ 접속
2. 로그인 (또는 Demo Mode 활성화)
3. 변경한 기능 테스트
   - 장비관리 메뉴 클릭
   - 해당 기능 탭 선택
   - 동작 확인
4. 브라우저 개발자 도구 확인
   - Console에 에러 없음
   - Network 탭에서 API 호출 성공
```

**체크 포인트**:
- ✅ 페이지 로드 성공
- ✅ CSS 스타일 정상 적용
- ✅ API 호출 성공 (Network 탭)
- ✅ 로딩 스피너 표시
- ✅ 데이터 정상 렌더링
- ✅ 에러 처리 동작

## 배포 실패 시 롤백

### 방법 1: Git Rollback

```bash
# EC2 서버에서

# 최근 커밋 확인
git log --oneline -10

# 이전 커밋으로 되돌리기
git reset --hard <이전_커밋_해시>

# 예: git reset --hard abc1234

# 재빌드 & 재시작
npm run build
pm2 restart dlive
```

### 방법 2: PM2 Restart

```bash
# 간단한 문제는 재시작으로 해결
pm2 restart dlive

# 또는 완전 재시작
pm2 delete dlive
pm2 start ecosystem.config.js
```

### 방법 3: 빌드 파일 복원

```bash
# 빌드 파일 백업 (배포 전에)
cp -r dist dist.backup

# 문제 발생 시 복원
rm -rf dist
mv dist.backup dist
pm2 restart dlive
```

## 트러블슈팅

### 문제 1: 빌드 실패

**증상**:
```
npm ERR! Failed at the build script
```

**해결**:
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# 다시 빌드
npm run build
```

### 문제 2: PM2 프로세스 중지

**증상**:
```
pm2 status
# → dlive: stopped
```

**해결**:
```bash
# 로그 확인
pm2 logs dlive --lines 100

# 재시작
pm2 restart dlive

# 여전히 안 되면
pm2 delete dlive
cd /home/ubuntu/dlive-cona-client
pm2 start npm --name dlive -- start
```

### 문제 3: 포트 충돌

**증상**:
```
Error: listen EADDRINUSE: address already in use :::80
```

**해결**:
```bash
# 80번 포트 사용 프로세스 확인
sudo lsof -i :80

# PID 확인 후 종료
sudo kill -9 <PID>

# PM2 재시작
pm2 restart dlive
```

### 문제 4: API 프록시 에러

**증상**:
```
Error: ECONNREFUSED 58.143.140.222:8080
```

**해결**:
```bash
# Legacy 서버 ping 테스트
ping 58.143.140.222

# 연결 안 되면 Demo Mode 사용
# 또는 관리자에게 Legacy 서버 상태 확인 요청
```

## PM2 유용한 명령어

```bash
# 실시간 모니터링
pm2 monit

# 상세 정보
pm2 show dlive

# 메모리 사용량 확인
pm2 list

# 로그 초기화
pm2 flush

# 재시작 (다운타임 없음)
pm2 reload dlive

# 재시작 (강제)
pm2 restart dlive

# 중지
pm2 stop dlive

# 삭제
pm2 delete dlive
```

## 배포 완료 체크리스트

- [ ] PM2 상태: online
- [ ] 로그: 에러 없음
- [ ] 포트: 80 LISTEN
- [ ] cURL: 200 응답
- [ ] 브라우저: 페이지 로드 성공
- [ ] 기능 테스트: 정상 동작
- [ ] Console 에러: 없음
- [ ] Network API: 성공

## 출력 형식

배포 완료 후 다음 정보 출력:

```
🚀 EC2 배포 완료

✅ 서버 정보
- IP: 52.63.131.157
- Status: online
- Uptime: 2h 30m
- Memory: 45 MB / 1 GB

✅ 배포 내용
- Commit: abc1234 "feat: 장비 할당 API 연동"
- Build Time: 45s
- Deploy Time: 2025-01-28 10:30:00

✅ 검증 결과
- PM2 Status: ✅ online
- Port 80: ✅ LISTEN
- API Health: ✅ 정상
- Browser Test: ✅ 통과

🌐 접속 URL: http://52.63.131.157/

📋 다음 작업: <있으면 표시>
```

## 참고

- **배포 스크립트**: `/tmp/ec2_deploy.sh`
- **배포 가이드**: `/tmp/pr_merge_guide.md`
- **PM2 설정**: `ecosystem.config.js` (있으면)
- **Nginx 설정**: `/etc/nginx/sites-available/default` (있으면)
