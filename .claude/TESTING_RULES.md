# 테스트 필수 규칙 (Testing Mandatory Rules)

## 절대 원칙

**모든 코드 수정 및 배포 후 반드시 테스트를 완료해야 한다.**
**오류율 0%가 확인될 때까지 테스트를 반복해야 한다.**
**테스트 완료 후 반드시 결과를 보고해야 한다.**

---

## 1. 테스트 시점

### 필수 테스트 시점
- [ ] 코드 수정 완료 후
- [ ] 빌드 완료 후
- [ ] 커밋 전
- [ ] 푸시 후
- [ ] 배포 완료 후

### 테스트 없이 진행 금지 항목
- 커밋 (반드시 빌드 성공 확인 후)
- 푸시 (반드시 로컬 테스트 후)
- 작업 완료 보고 (반드시 배포 확인 후)

---

## 2. 테스트 방법 (계층별)

### 2.1 프론트엔드 테스트

#### 빌드 테스트 (필수)
```bash
cd C:/bottle/dlive/frontend
npm run build
```
- 빌드 성공 확인
- 에러/경고 0개 확인
- 빌드 산출물 확인

#### 코드 검증
```bash
# 변경된 코드가 빌드에 포함되었는지 확인
grep -o "변경된키워드" dist/assets/*.js | wc -l

# TypeScript 타입 검사
npx tsc --noEmit
```

#### 로컬 개발 서버 테스트
```bash
npm run dev
# http://localhost:5173 접속하여 UI 확인
```

#### 배포 확인
```bash
# GitHub Pages 배포 상태 확인
curl -s -o /dev/null -w "%{http_code}" "https://seokheounjo.github.io/dlive-front-equipment/"
# 200 응답 확인

# 페이지 내용 확인
curl -s "https://seokheounjo.github.io/dlive-front-equipment/" | grep -o "title"
```

---

### 2.2 백엔드 API 테스트

#### 서버 상태 확인
```bash
# 헬스체크
curl -s "http://localhost:8080/api/health"

# PM2 상태 확인
pm2 status
pm2 logs --lines 20
```

#### API 엔드포인트 테스트 (curl)
```bash
# GET 요청
curl -s -X GET "http://localhost:8080/api/endpoint" \
  -H "Content-Type: application/json"

# POST 요청
curl -s -X POST "http://localhost:8080/api/endpoint" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# 응답 코드 확인
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/endpoint"
```

#### 주요 API 테스트 목록
| API | 메서드 | 테스트 데이터 |
|-----|--------|---------------|
| /customer/search | POST | {"CUST_NM": "테스트"} |
| /customer/negociation/updateCustTelDetailInfo | POST | {"CUST_ID": "...", "TEL_NO_TP": "2"} |
| /equipment/list | POST | {"USR_ID": "..."} |

---

### 2.3 데이터베이스 테스트

#### Oracle 프로시저 테스트
```sql
-- 프로시저 호출 테스트
CALL PCMWK_NOT_REV_EQT(...);

-- 결과 확인
SELECT * FROM TABLE WHERE ...;
```

---

### 2.4 통합 테스트

#### 시나리오 기반 테스트
1. **고객 검색 → 정보 조회 → 변경 → 저장**
2. **장비 스캔 → 이동 처리 → 결과 확인**
3. **로그인 → 메뉴 이동 → 기능 실행**

#### E2E 테스트 체크리스트
- [ ] 로그인 기능
- [ ] 고객 검색
- [ ] 계약 조회
- [ ] 전화번호 변경 (전화번호/휴대폰번호 구분)
- [ ] 주소 변경
- [ ] 장비 조회/이동

---

## 3. 오류 처리 절차

### 오류 발견 시
1. **즉시 수정** - 오류 원인 파악 및 코드 수정
2. **재빌드** - 수정 후 빌드 재실행
3. **재테스트** - 동일한 테스트 재수행
4. **확인** - 오류 해결 확인

### 오류 미해결 시
1. 로그 분석
2. 원인 추적
3. 추가 디버깅
4. **절대로 오류 상태로 배포하지 않음**

---

## 4. 테스트 결과 보고

### 보고 형식
```
## 테스트 결과 보고

### 테스트 일시
YYYY-MM-DD HH:MM

### 테스트 항목
- [ ] 빌드 테스트: ✅ 성공 / ❌ 실패
- [ ] 코드 검증: ✅ 성공 / ❌ 실패
- [ ] API 테스트: ✅ 성공 / ❌ 실패
- [ ] 배포 확인: ✅ 성공 / ❌ 실패

### 테스트 상세
| 항목 | 결과 | 비고 |
|------|------|------|
| npm run build | ✅ | 2.3s |
| curl API test | ✅ | 200 OK |
| 배포 URL 접속 | ✅ | 정상 |

### 오류 현황
- 발견된 오류: 0건
- 해결된 오류: 0건
- 미해결 오류: 0건

### 결론
✅ 모든 테스트 통과 - 배포 완료
```

---

## 5. 테스트 자동화 스크립트

### 전체 테스트 실행 스크립트
```bash
#!/bin/bash
# test-all.sh

echo "=== D'Live 전체 테스트 시작 ==="

# 1. 프론트엔드 빌드 테스트
echo "[1/4] 프론트엔드 빌드 테스트..."
cd C:/bottle/dlive/frontend
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 빌드 실패"
    exit 1
fi
echo "✅ 빌드 성공"

# 2. TypeScript 타입 검사
echo "[2/4] TypeScript 타입 검사..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ 타입 오류"
    exit 1
fi
echo "✅ 타입 검사 통과"

# 3. 백엔드 API 테스트
echo "[3/4] 백엔드 API 테스트..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/health")
if [ "$API_RESPONSE" != "200" ]; then
    echo "⚠️ API 서버 응답 없음 (로컬 테스트 스킵)"
else
    echo "✅ API 서버 정상"
fi

# 4. 배포 확인
echo "[4/4] 배포 확인..."
DEPLOY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://seokheounjo.github.io/dlive-front-equipment/")
if [ "$DEPLOY_RESPONSE" == "200" ]; then
    echo "✅ 배포 정상"
else
    echo "⚠️ 배포 확인 필요 (HTTP $DEPLOY_RESPONSE)"
fi

echo ""
echo "=== 테스트 완료 ==="
```

---

## 6. PM2 관련 테스트

### PM2 상태 확인
```bash
pm2 status
pm2 list
```

### PM2 로그 확인
```bash
pm2 logs
pm2 logs --lines 100
pm2 logs app-name --err
```

### PM2 재시작 후 테스트
```bash
pm2 restart all
pm2 status
# 상태가 online인지 확인
```

---

## 7. 체크리스트 (매 작업 시)

### 코드 수정 후
- [ ] 빌드 성공 확인 (`npm run build`)
- [ ] 에러/경고 0개 확인
- [ ] 변경 코드가 빌드에 포함 확인

### 커밋/푸시 후
- [ ] Git 상태 확인 (`git status`)
- [ ] 원격 저장소 푸시 성공 확인
- [ ] GitHub Actions 워크플로우 확인

### 배포 후
- [ ] 배포 URL 접속 확인
- [ ] 변경된 기능 동작 확인
- [ ] 콘솔 에러 없음 확인

### 보고 전
- [ ] 모든 테스트 항목 통과 확인
- [ ] 오류율 0% 확인
- [ ] 테스트 결과 문서화

---

## 8. 금지 사항

### 절대 금지
1. **테스트 없이 커밋/푸시**
2. **빌드 실패 상태로 배포**
3. **오류 발견 후 무시하고 진행**
4. **테스트 결과 보고 없이 완료 선언**

### 경고 사항
1. 일부 테스트만 수행하고 완료 선언
2. 로컬에서만 테스트하고 배포 확인 생략
3. API 테스트 없이 프론트엔드만 테스트

---

## 9. 문제 해결 가이드

### 빌드 실패 시
1. 에러 메시지 확인
2. 해당 파일/라인 확인
3. 문법 오류, 타입 오류, import 오류 확인
4. 수정 후 재빌드

### API 오류 시
1. 서버 상태 확인 (`pm2 status`)
2. 로그 확인 (`pm2 logs`)
3. 네트워크 연결 확인
4. 요청 파라미터 확인

### 배포 실패 시
1. GitHub Actions 로그 확인
2. 빌드 산출물 확인
3. 배포 설정 확인
4. 수동 배포 시도

---

**이 문서의 모든 규칙은 필수이며, 예외 없이 준수해야 한다.**
**테스트 완료 및 오류 0% 확인 없이는 어떤 작업도 완료된 것으로 간주하지 않는다.**
