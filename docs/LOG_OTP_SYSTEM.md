# D'Live CONA 모바일 - 로그/OTP/로그인 시스템 문서

> 최종 업데이트: 2026-03-12
> 상태: 프론트엔드 배포 완료 / 백엔드 jsh 브랜치 push (관리자 빌드/배포 대기)

---

## 1. 아키텍처 개요

```
[모바일 브라우저 / Capacitor 앱]
    ↓ HTTPS (fetch / sendBeacon)
[EC2 Nginx:443]
    ↓
[PM2 Node.js:8080 - Express (api-proxy.js)]
    ↓ HTTP proxy (JSON, UTF-8)
[CONA WebSphere:8080 - TaskAuthController.java]
    ↓ iBatis SQL
[Oracle DB]
    ↓ DB Link
[@CONATOMOBILE (원격 DB)]
```

### 인코딩 체인
- 브라우저 → Express: `Content-Type: application/json` (UTF-8)
- Express → CONA: `Content-Type: application/json; charset=utf-8`
- CONA: `req.getInputStream()` → `new String(bytes, "UTF-8")` 명시적 디코딩
- Oracle JDBC: Java String → DB charset 자동 변환

---

## 2. 로그인 플로우

### 2.1 레거시 MiPlatform 로그인 파라미터

```javascript
// 레거시 fn_Login() - MiPlatform
ds_user.SetColumn(0, "USR_ID", ed_UserId.Text);
ds_user.SetColumn(0, "PASSWORD", ed_Pwd.Text);
ds_user.SetColumn(0, "LOGIN_VIEW", "MOBILE");
ds_user.SetColumn(0, "DRM_VERSION", "1000");
```

### 2.2 React 프론트 로그인 파라미터 (apiService.ts)

```typescript
// services/apiService.ts - login()
body: JSON.stringify({
  USR_ID: userId,
  PASSWORD: password,
  DISCONN_YN: disconnYn,    // Y: 강제 로그인, N: 동시접속 체크
  DRM_VERSION: '1000',      // 레거시 동일
  LOGIN_VIEW: 'MOBILE'      // 레거시 동일
})
```

### 2.3 백엔드 로그인 처리 흐름 (TaskAuthController.handleLogin)

```
1. checkSkipDRM(row)
   ├─ true  → checkLogin(row)        // DRM 체크 안 함
   └─ false → checkLoginDRM(row)     // DRM_VERSION 검증
      └─ INVALID_DRM → 401 에러

2. 에러 코드 처리
   ├─ INVALID_DRM  → 401 "DRM version invalid"
   ├─ INVALID_CORP → 401 "Invalid corp"
   ├─ INVALID_USE  → 401 "User not usable"
   ├─ INVALID_PASS → 401 "Password mismatch"
   ├─ INVALID_USER → 401 "User not found"
   ├─ USE_YN_IS_A_TYPE → 401 "Account archived"
   └─ *LOCK*       → 423 "Account locked"

3. getUserInfo(row) → userMap

4. 동시접속 체크 (레거시 동일)
   ├─ getUsrSessionInfo(sessionChk)
   ├─ DISCONN_YN=Y → delUsrSessionInfo → LOGIN_DUP_YN=N
   └─ DISCONN_YN=N
      ├─ 같은 IP → delUsrSessionInfo → LOGIN_DUP_YN=N
      └─ 다른 IP → LOGIN_DUP_YN=Y, sessionInsFlag=N

5. LOGIN_VIEW 변환: "MOBILE" → "M", else → "P"

6. 세션 설정
   ├─ session.setAttribute("UserId", ...)
   ├─ session.setAttribute("LOGIN_FLAG", "Y")
   └─ ...

7. sessionInsFlag=Y일 때만:
   ├─ addUsrSessionInfo(sessionInfo)
   └─ setSessionIdentifier(sessionInfo)

8. modUsrLoginDt(loginDtMap)        // LAST_LOGIN_DT 업데이트
9. addUsrConnLog(connLogMap)        // tsylm_usr_conn 접속 로그 INSERT
10. getUsrSoList(soParam)           // AUTH_SO_List 조회
11. JSON 응답 리턴
```

### 2.4 로그인 JSON 응답 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| ok | boolean | 성공 여부 |
| userId | string | 사용자 ID |
| userName | string | 사용자명 (한글) |
| userNameEn | string | 영문명 |
| corpNm | string | 회사명 |
| crrId | string | 캐리어 ID |
| soId | string | SO ID |
| soNm | string | SO명 |
| mstSoId | string | 마스터 SO ID |
| telNo / telNo2 / telNo3 | string | 전화번호 |
| soYn | string | SO 여부 |
| deptCd / deptNm | string | 부서 코드/명 |
| empNo | string | 사번 |
| eml | string | 이메일 |
| partnerYn | string | 파트너 여부 |
| rno | string | RNO |
| position | string | 직급 |
| userRole | string | 역할 |
| LOGIN_DUP_YN | string | 동시접속 여부 (Y/N) |
| AUTH_SO_List | array | 권한 SO 목록 [{SO_ID, SO_NM, MST_SO_ID}] |

---

## 3. OTP 인증 플로우

### 3.1 현재 상태

```typescript
// components/layout/Login.tsx
const OTP_ENABLED = false;  // 현재 비활성화
```

OTP는 현재 **비활성화** 상태. `OTP_ENABLED = true`로 변경 시 활성화.

### 3.2 OTP 플로우 (활성화 시)

```
1. 사용자가 ID/PW/OTP 입력 → Submit
2. generateLoginTrxId(username) → LOGIN_TRX_ID 생성 (localStorage 저장)
3. loginApi1({P_LOGIN_TRX_ID, P_USER_ID, P_API_TYPE: 'LOGIN'})
4. login(username, password) → CONA 로그인 API 호출
5. loginApi2({P_LOGIN_TRX_ID, P_RESULT_CD: SUCCESS/FAIL})
6. 로그인 성공 시 → verifyOtp(username, otpCode)
   ├─ 성공 → loginApi3({P_FINAL_RESULT_CD: 'SUCCESS'}) → completeLogin
   └─ 실패 → loginApi3({P_FINAL_RESULT_CD: 'OTP_FAIL'}) → 에러 표시
```

### 3.3 OTP 에러 코드

| 코드 | 메시지 |
|------|--------|
| 6000 | OTP 인증에 실패했습니다. 다시 입력해주세요. |
| 6001 | 이미 사용된 OTP입니다. 새 코드를 입력해주세요. |
| 6010 | OTP는 숫자 6자리를 입력해주세요. |
| 6025 | 인증 실패 횟수를 초과했습니다. 관리자에게 문의하세요. |
| 6040 | OTP 서버에 연결할 수 없습니다. |
| 6041 | OTP 서버 통신 오류가 발생했습니다. |

### 3.4 OTP 백엔드 (api-proxy.js)

```
POST /api/auth/otp-verify
  → CONA /api/auth/otp-verify (TaskAuthController에서 처리)
```

---

## 4. 로그 시스템

### 4.1 DB 테이블

#### TSYMO_APP_ACTIVITY_LOG (활동 로그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| LOG_SEQ | NUMBER | PK (SEQ_TSYMO_APP_ACTIVITY_LOG) |
| LOG_TYPE | VARCHAR2(10) | LOGIN / LOGOUT / MENU_CLICK / WORK_COMPLETE |
| USR_ID | VARCHAR2(50) | 사용자 ID |
| USR_NM | VARCHAR2(100) | 사용자명 (한글) |
| SO_ID | VARCHAR2(10) | SO ID |
| CRR_ID | VARCHAR2(10) | 캐리어 ID |
| ACCESS_TYPE | VARCHAR2(10) | APP |
| FROM_VIEW | VARCHAR2(50) | 이전 화면 |
| TO_VIEW | VARCHAR2(50) | 이동 화면 |
| MENU_NM | VARCHAR2(100) | 메뉴명 (한글) |
| ORDER_ID | VARCHAR2(50) | 작업지시서 ID |
| IP_ADDR | VARCHAR2(50) | 접속 IP |
| USER_AGENT | VARCHAR2(500) | 브라우저/기기 정보 |
| CRT_DTTM | VARCHAR2(14) | 생성일시 (YYYYMMDDHHMMSS) |
| P_LOGIN_TRX_ID | VARCHAR2 | 로그인 트랜잭션 ID |
| P_NW_TYPE | VARCHAR2 | 네트워크 타입 (WIFI/4G/CELLULAR) |

#### TSYMO_APP_DEBUG_LOG (디버그 로그)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| LOG_SEQ | NUMBER | PK (SEQ_TSYMO_APP_DEBUG_LOG) |
| LOG_LEVEL | VARCHAR2(10) | ERROR / WARN / INFO |
| USR_ID | VARCHAR2(50) | 사용자 ID |
| SO_ID | VARCHAR2(10) | SO ID |
| API_PATH | VARCHAR2(200) | API 경로 |
| API_METHOD | VARCHAR2(10) | GET / POST |
| API_STATUS | NUMBER | HTTP 상태코드 |
| API_DURATION | NUMBER | 응답시간 (ms) |
| ERROR_MSG | VARCHAR2(4000) | 에러 메시지 |
| REQ_BODY | CLOB | 요청 파라미터 |
| RES_BODY | CLOB | 응답 데이터 |
| STACK_TRACE | VARCHAR2(4000) | JS 스택트레이스 |
| PAGE_VIEW | VARCHAR2(50) | 현재 화면 |
| CRT_DTTM | VARCHAR2(14) | 생성일시 |
| P_LOGIN_TRX_ID | VARCHAR2 | 로그인 트랜잭션 ID |
| P_NW_TYPE | VARCHAR2 | 네트워크 타입 |

### 4.2 iBatis SQL 매핑 (program-manage.xml)

```sql
-- insertActivityLog
INSERT INTO CONA.TSYMO_APP_ACTIVITY_LOG
(LOG_SEQ, LOG_TYPE, USR_ID, USR_NM, SO_ID, CRR_ID, ACCESS_TYPE,
 FROM_VIEW, TO_VIEW, MENU_NM, ORDER_ID, IP_ADDR, USER_AGENT,
 CRT_DTTM, P_LOGIN_TRX_ID, P_NW_TYPE)
VALUES(SEQ_TSYMO_APP_ACTIVITY_LOG.nextval,
 #LOG_TYPE#, #USR_ID#, #USR_NM#, #SO_ID#, #CRR_ID#, #ACCESS_TYPE#,
 #FROM_VIEW#, #TO_VIEW#, #MENU_NM#, #ORDER_ID#, #IP_ADDR#, #USER_AGENT#,
 #CRT_DTTM#, #P_LOGIN_TRX_ID#, #P_NW_TYPE#)

-- pmobileLoginApi_1 (Oracle 프로시저)
PMOBILE_LOGIN_API_1(
  #P_LOGIN_TRX_ID#, #P_USER_ID#, #P_NW_TYPE#,
  #P_CLIENT_IP#, #P_USER_AGENT#, #P_SERVER#,
  #P_API_TYPE#, #P_REQUEST_DATA#, OUT MSGCODE, OUT MESSAGE)

-- pmobileLoginApi_2
PMOBILE_LOGIN_API_2(
  #P_LOGIN_TRX_ID#, #P_API_TYPE#, #P_RESPONSE_DATA#,
  #P_RESULT_CD#, #P_RESULT_MSG#, OUT MSGCODE, OUT MESSAGE)

-- pmobileLoginApi_3
PMOBILE_LOGIN_API_3(
  #P_LOGIN_TRX_ID#, #P_FINAL_RESULT_CD#, #P_FINAL_RESULT_MSG#,
  OUT MSGCODE, OUT MESSAGE)
```

### 4.3 프론트엔드 로그 서비스 (logService.ts)

#### 배치 큐 메커니즘
- 로그 발생 → 내부 큐에 적재
- **10초 간격** 또는 **50건 누적** 시 flush
- `visibilitychange` (hidden) / `pagehide` 이벤트 시 flush
- `navigator.sendBeacon` 우선 사용 (페이지 종료 시에도 전송 보장)
- 전송 실패 시 silent (앱 동작에 영향 없음)

#### 개별 전송 (배치 아님)
- CONA `handleInsertLog`는 개별 JSON만 파싱 가능
- `sendLogs()`가 **로그 건별로 개별 HTTP 요청** 전송
- ~~이전: `{"logs":[...]}` 배치 형식 → CONA에서 파싱 불가~~ (수정 완료)

#### 공개 API

```typescript
// 활동 로그
logLogin()                              // LOGIN 로그
logLogout()                             // LOGOUT 로그
logNavigation(from, to, menuNm?)        // MENU_CLICK 로그
logWorkComplete(orderId)                // WORK_COMPLETE 로그
logActivity(entry: ActivityLogEntry)    // 커스텀 활동 로그

// 디버그 로그
logApiError(path, method, status, msg, duration?)  // API 에러
logSlowApi(path, method, status, duration)          // 느린 API (WARN)
logRuntimeError(msg, stackTrace?)                   // 런타임 에러

// 로그인 감사 로그 (즉시 전송, 큐 안 거침)
loginApi1({P_LOGIN_TRX_ID, P_USER_ID, P_API_TYPE})
loginApi2({P_LOGIN_TRX_ID, P_API_TYPE, P_RESULT_CD, ...})
loginApi3({P_LOGIN_TRX_ID, P_FINAL_RESULT_CD, ...})

// 유틸
generateLoginTrxId(userId)  // 트랜잭션 ID 생성 → localStorage
clearLoginTrxId()           // 로그아웃 시 삭제
flushAll()                  // 큐 즉시 전송
stopLogService()            // 타이머 정리 + flush
```

#### LOGIN_TRX_ID 형식
```
YYYYMMDDHHMMSS_USERID_RANDOM6
예: 20260312110000_A20130708_RLZWVP
```

#### NW_TYPE 감지
```typescript
navigator.connection.type       → WIFI, CELLULAR, ETHERNET
navigator.connection.effectiveType → 4G, 3G, 2G
없으면 → UNKNOWN
```

### 4.4 이벤트 트리거 연결

| 이벤트 | 위치 | 로그 타입 | 호출 함수 |
|--------|------|----------|----------|
| 로그인 성공 | Login.tsx completeLogin() | LOGIN | logLogin() |
| 로그아웃 | App.tsx handleLogout() | LOGOUT | logLogout() |
| 화면 이동 | App.tsx navigateToView() | MENU_CLICK | logNavigation(from, to) |
| 작업 완료 | (미연결) | WORK_COMPLETE | logWorkComplete(orderId) |
| API 에러 | apiService.ts | ERROR | logApiError() |
| 느린 API | apiService.ts | WARN | logSlowApi() |
| 런타임 오류 | (미연결) | ERROR | logRuntimeError() |
| 로그인 시작 | Login.tsx handleSubmit() | - | loginApi1() |
| 로그인 결과 | Login.tsx handleSubmit() | - | loginApi2() |
| 로그인 최종 | Login.tsx handleSubmit() | - | loginApi3() |

### 4.5 데이터 흐름

```
[Login.tsx]
  ├─ generateLoginTrxId(username) → localStorage('loginTrxId')
  ├─ loginApi1/2/3 → /api/system/pm/pmobileLoginApi_1/2/3
  └─ completeLogin → onLogin()
       ↓
[App.tsx handleLogin]
  ├─ localStorage('userInfo') = {userId, userName, crrId, soId, ...}
  └─ logLogin() → logActivity({LOG_TYPE:'LOGIN'})
       ↓
[logService.ts logActivity]
  ├─ getUserInfo() → localStorage('userInfo') 읽기
  │   → {USR_ID: user.userId, USR_NM: user.userName, SO_ID: user.soId, CRR_ID: user.crrId}
  ├─ getLoginTrxId() → localStorage('loginTrxId') 읽기
  ├─ getNetworkType() → navigator.connection
  └─ activityQueue.push(record) → 10초 후 flush
       ↓
[sendLogs → 개별 POST]
  → /api/system/pm/insertActivityLog (각 로그 건별)
       ↓
[Express api-proxy.js]
  → router.post('/system/pm/insertActivityLog', handleProxy)
  → http://58.143.140.222:8080/api/system/pm/insertActivityLog
       ↓
[CONA TaskAuthController.handleInsertLog]
  → parseJsonBodyAll(req) → params Map
  → programManagement.insertActivityLog(params)
       ↓
[iBatis program-manage.xml]
  → INSERT INTO CONA.TSYMO_APP_ACTIVITY_LOG ...
```

---

## 5. Express 프록시 라우트 (api-proxy.js)

### 로그 관련 라우트

```javascript
// 활동/디버그 로그
router.post('/system/pm/insertActivityLog', handleProxy);
router.post('/system/pm/insertDebugLog', handleProxy);

// 로그인 감사 로그 (브라우저 → Express → CONA)
router.post('/system/pm/pmobileLoginApi_1', handleProxy);
router.post('/system/pm/pmobileLoginApi_2', handleProxy);
router.post('/system/pm/pmobileLoginApi_3', handleProxy);
```

### 라우팅 경로
```
/api/system/pm/insertActivityLog
  → Express strips /api → /system/pm/insertActivityLog
  → handleProxy adds /api prefix → /api/system/pm/insertActivityLog
  → CONA: path.endsWith("/insertActivityLog") → handleInsertLog()
```

---

## 6. 수정 이력

### 프론트엔드 (main 브랜치 - 배포 완료)

| 날짜 | 파일 | 수정 내용 |
|------|------|----------|
| 03/12 | api-proxy.js | pmobileLoginApi_1/2/3 Express 라우트 추가 |
| 03/12 | services/logService.ts | sendLogs() 배치 → 개별 전송으로 변경 |
| 03/12 | App.tsx | LOGIN_TRX_ID 이중 생성 방지 (localStorage 체크) |
| 03/12 | services/apiService.ts | PASSWORD 키명 수정, DRM_VERSION="1000", LOGIN_VIEW="MOBILE" |
| 03/12 | services/apiService.ts | fetchWithRetry 4xx error response body parsing (wasName 추출) |
| 03/12 | services/apiService.ts | LoginResponse에 wasName 필드 추가 |
| 03/12 | components/layout/Login.tsx | loginApi2/3에 WAS 컨테이너명 포함 (성공/실패 모두) |

### 백엔드 (jsh 브랜치 - 관리자 빌드/배포 대기)

| 날짜 | 파일 | 수정 내용 |
|------|------|----------|
| 03/09 | TaskAuthController.java | pmobileLoginApi_1/2/3 엔드포인트 추가 |
| 03/09 | api-servlet.xml | pmobileLoginApi URL 매핑 추가 |
| 03/09 | TaskAuthController.java | LOCK 계정 감지 (423 응답) |
| 03/10 | TaskAuthController.java | insertActivityLog/insertDebugLog 엔드포인트 추가 |
| 03/10 | api-servlet.xml | insertActivityLog/insertDebugLog URL 매핑 추가 |
| 03/11 | TaskAuthController.java | req.setCharacterEncoding("UTF-8") 한글 인코딩 |
| 03/12 | TaskAuthController.java | P_LOGIN_TRX_ID/P_NW_TYPE 파라미터 키 매핑 수정 |
| 03/12 | TaskAuthController.java | 레거시 로그인 플로우 완전 매칭 (동시접속, modUsrLoginDt, addUsrConnLog) |
| 03/12 | TaskAuthController.java | WAS 컨테이너명 추가: getWasContainerName() (legacy getWasName 동일) |
| 03/12 | TaskAuthController.java | 로그인 응답에 wasName 포함 (성공/실패 모두) |
| 03/12 | TaskAuthController.java | pmobileLoginApi_1 P_SERVER에 WAS 컨테이너명 자동 설정 |
| 03/12 | TaskAuthController.java | pmobileLoginApi_2/3에 WAS 컨테이너명 자동 추가 |
| 03/12 | TaskAuthController.java | parseJsonBody/parseJsonBodyAll: InputStream + UTF-8 명시적 디코딩 (한글 깨짐 수정) |

---

## 7. 발견 및 수정한 버그

| # | 버그 | 원인 | 수정 |
|---|------|------|------|
| 1 | LOGIN_TRX_ID DB에 NULL | Java 키 `LOGIN_TRX_ID` ≠ iBatis `#P_LOGIN_TRX_ID#` | `P_LOGIN_TRX_ID`로 수정 |
| 2 | NW_TYPE DB에 NULL | Java 키 `NW_TYPE` ≠ iBatis `#P_NW_TYPE#` | `P_NW_TYPE`로 수정 |
| 3 | USR_NM 한글 깨짐 | WebSphere EUC-KR 기본 인코딩 | `req.setCharacterEncoding("UTF-8")` |
| 4 | Activity 로그 전체 빈값 | sendLogs()가 `{"logs":[...]}` 배치 전송 → CONA 파싱 불가 | 개별 전송으로 변경 |
| 5 | pmobileLoginApi 404 | Express에 라우트 미등록 | router.post 추가 |
| 6 | LOGIN_TRX_ID 불일치 | App.tsx에서 재생성하여 Login.tsx 것을 덮어씀 | localStorage 체크 후 조건부 생성 |
| 7 | DRM_VERSION 불일치 | "1.0" 전송 → DRM skip 아닌 사용자 INVALID_DRM | "1000"으로 수정 (레거시 동일) |
| 8 | LOGIN_VIEW 불일치 | "APP" 전송 → 레거시는 "MOBILE" | "MOBILE"로 수정 |
| 9 | PASSWORD 키명 | USR_PWD로 전송 (백엔드에서 둘 다 처리하긴 하나) | PASSWORD로 통일 |
| 10 | 동시접속 체크 누락 | getUsrSessionInfo 미호출 | 레거시와 동일하게 추가 |
| 11 | 로그인일자 미갱신 | modUsrLoginDt 미호출 | 추가 (LAST_LOGIN_DT 업데이트) |
| 12 | 접속로그 미저장 | addUsrConnLog 미호출 | 추가 (tsylm_usr_conn INSERT) |
| 13 | WAS 컨테이너명 미포함 | 레거시 fn_get_was_name 누락 | getWasContainerName() 구현, 로그인 응답+감사로그에 포함 |
| 14 | loginApi2 P_RESULT_CD에 에러코드 전송 | catch블록에서 errCode(INVALID_PASS 등) 직접 전송 | P_RESULT_CD='FAIL' 고정, 에러코드는 P_RESULT_MSG에 [CODE] 형태로 포함 |
| 15 | 한글 인코딩 깨짐 (UTF-8→EUC-KR) | req.getReader()가 WebSphere 기본 인코딩 사용 | req.getInputStream() + 명시적 UTF-8 바이트 디코딩으로 변경 |

---

## 8. 배포 상태

### 프론트엔드 (EC2 - GitHub Actions 자동 배포)

| 항목 | 상태 |
|------|------|
| logService.ts (개별 전송) | ✅ 배포 완료 |
| api-proxy.js (pmobileLoginApi 라우트) | ✅ 배포 완료 |
| apiService.ts (DRM_VERSION, LOGIN_VIEW, PASSWORD) | ✅ 배포 완료 |
| App.tsx (LOGIN_TRX_ID 조건부 생성) | ✅ 배포 완료 |
| Login.tsx (loginApi1/2/3 호출) | ✅ 배포 완료 |
| Login.tsx (WAS 컨테이너명 loginApi2/3 전달) | ✅ 배포 완료 |
| Login.tsx (P_RESULT_CD: FAIL 고정) | ✅ 배포 완료 |
| apiService.ts (401 에러 응답 body parsing) | ✅ 배포 완료 |

### 백엔드 (CONA WebSphere - 관리자 수동 배포)

| 항목 | 상태 |
|------|------|
| TaskAuthController.java (전체) | ⏳ jsh 브랜치 push 완료, 빌드/배포 대기 |
| api-servlet.xml (URL 매핑) | ⏳ jsh 브랜치 push 완료, 빌드/배포 대기 |

### 백엔드 배포 요청 정보

```
브랜치: jsh
최신 커밋: a361a82 (Fix Korean encoding: use InputStream with explicit UTF-8 decode)
수정 파일:
  - src/task/TaskAuthController.java
  - deployment-package/api-servlet.xml
```

---

## 9. 테스트 결과 (2026-03-12)

### API 응답 테스트 (EC2 → CONA)

| API | 상태 | 응답 |
|-----|------|------|
| POST /api/login | 200 OK | `{"ok":true, "userId":"A20130708", "userName":"[방판]유영무"}` |
| POST /api/system/pm/pmobileLoginApi_1 | 200 OK | `{"ok":true, "MSGCODE":"", "MESSAGE":""}` |
| POST /api/system/pm/pmobileLoginApi_2 | 200 OK | `{"ok":true, "MSGCODE":"", "MESSAGE":""}` |
| POST /api/system/pm/pmobileLoginApi_3 | 200 OK | `{"ok":true, "MSGCODE":"", "MESSAGE":""}` |
| POST /api/system/pm/insertActivityLog | 200 OK | `{"ok":true}` |
| POST /api/system/pm/insertDebugLog | 200 OK | `{"ok":true}` |

### 필드별 검증 (insertActivityLog)

| 필드 | 전송 값 | 결과 |
|------|---------|------|
| LOG_TYPE | LOGIN / MENU_CLICK / LOGOUT | ✅ |
| USR_ID | A20130708 | ✅ |
| USR_NM | [방판]유영무 (한글 UTF-8) | ✅ |
| SO_ID | (빈값 - 이 사용자는 SO_ID 없음) | ✅ 정상 |
| CRR_ID | 1055809 | ✅ |
| ACCESS_TYPE | APP | ✅ |
| FROM_VIEW | today-work | ✅ |
| TO_VIEW | work-management | ✅ |
| MENU_NM | 작업관리 (한글) | ✅ |
| CRT_DTTM | 20260312015825 | ✅ |
| LOGIN_TRX_ID | 20260312015755_A20130708_RLZWVP | ✅ (이전 NULL) |
| NW_TYPE | WIFI | ✅ (이전 NULL) |

> **주의**: LOGIN_TRX_ID와 NW_TYPE가 실제 DB에 저장되려면 백엔드 배포가 필요합니다.
> 현재 배포된 main에는 `LOGIN_TRX_ID`/`NW_TYPE` 키가 `P_LOGIN_TRX_ID`/`P_NW_TYPE`로 매핑 안 되어 있어 NULL이 들어갑니다.

---

## 10. WAS 컨테이너명 (fn_get_was_name)

### 레거시 구현 (BulletinManagementImpl.java)

```java
String str_comm = System.getProperty("sun.java.command").toString();
String[] str_comm_arr = str_comm.split(" ");
String nm_container = str_comm_arr[str_comm_arr.length - 1];
```

- 레거시 MiPlatform에서 `fn_get_was_name()` → `/system/bd/getWasName.req` 호출
- WAS 컨테이너명 = JVM 실행 커맨드의 마지막 인자 (WebSphere 컨테이너 식별자)

### 우리 구현 (TaskAuthController.java)

```java
private static String getWasContainerName() {
    String cmd = System.getProperty("sun.java.command");
    String[] parts = cmd.split(" ");
    return parts[parts.length - 1];  // WAS container name
}
```

### 적용 위치

| 위치 | 필드 | 내용 |
|------|------|------|
| 로그인 성공 응답 | `wasName` | 컨테이너명 직접 포함 |
| 로그인 실패 응답 (401/423) | `wasName` | 에러 JSON에 포함 |
| pmobileLoginApi_1 | `P_SERVER` | 컨테이너명으로 자동 설정 (프론트 값 무시) |
| pmobileLoginApi_2 | `P_RESPONSE_DATA` | `WAS=컨테이너명` 추가 |
| pmobileLoginApi_3 | `P_FINAL_RESULT_MSG` | `WAS=컨테이너명` 추가 |

### 프론트엔드 전달 흐름

```
[Login.tsx]
  ├─ loginApi1: P_SERVER → backend가 자동 설정
  ├─ login() 성공 → result.wasName
  │   ├─ loginApi2: P_RESPONSE_DATA = "WAS=컨테이너명"
  │   └─ loginApi3: P_FINAL_RESULT_MSG = "...,WAS=컨테이너명"
  └─ login() 실패 (401) → err.details.wasName
      ├─ loginApi2: P_RESPONSE_DATA = "WAS=컨테이너명"
      └─ loginApi3: P_FINAL_RESULT_MSG = "...,WAS=컨테이너명"
```
