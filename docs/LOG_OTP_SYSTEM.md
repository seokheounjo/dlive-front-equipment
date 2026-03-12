# D'Live CONA 모바일 - 로그인/로그/OTP 시스템 종합 문서

> 최종 업데이트: 2026-03-12
> 상태: 프론트엔드 배포 완료 / 백엔드 배포 완료 (jsh → main 빌드/배포)

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
    ↓ iBatis SQL / Oracle Procedure
[Oracle DB]
    ↓ DB Link
[@CONATOMOBILE (원격 DB)]
```

### 인코딩 체인
- 브라우저 → Express: `Content-Type: application/json` (UTF-8)
- Express → CONA: `Content-Type: application/json; charset=utf-8`
- CONA: `req.getInputStream()` → `new String(bytes, "UTF-8")` 명시적 디코딩
- Oracle JDBC: Java String → DB charset 자동 변환

### 핵심 규칙
- **P_RESULT_CD 규칙**: loginApi2는 반드시 `SUCC` / `FAIL` 만 사용. 구체적 에러코드는 P_RESULT_MSG에 `[CODE] message` 형태로 포함
- **한글 인코딩**: WebSphere 기본 EUC-KR → `req.getInputStream()` + UTF-8 명시적 디코딩 필수
- **WAS 컨테이너명**: `System.getProperty("sun.java.command")` 마지막 인자 = container1/container2

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
   ├─ INVALID_PARAM → 401 "Required parameter missing" (wasName 포함)
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
11. JSON 응답 리턴 (wasName 포함)
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
| wasName | string | WAS 컨테이너명 (container1/container2) |

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
5. loginApi2({P_LOGIN_TRX_ID, P_RESULT_CD: SUCC/FAIL})
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

### 3.3.1 로그인 에러 팝업 모달 (Login.tsx)

| 에러 조건 | 팝업 종류 | 스타일 | 변수 |
|----------|----------|--------|------|
| 동시접속 (LOGIN_DUP_YN=Y) | 동시접속 확인 모달 | amber 경고 | `showDupConfirm` |
| 계정 잠금 (code=LOCK, 423) | 계정 잠금 모달 | red 에러 | `lockMessage` |
| Circuit Breaker (503) | 요청 차단 모달 | amber 경고 | `blockMessage` |
| 기타 에러 (401, 400 등) | 인라인 에러 텍스트 | red 텍스트 | `error` |

> Circuit Breaker: 동일 API에 5번 연속 실패 시 30초간 요청 차단. `fetchWithRetry`에서 503 throw → Login.tsx catch에서 `setBlockMessage()`.

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
| P_NW_TYPE | VARCHAR2 | 네트워크/기기 타입 |

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
| P_NW_TYPE | VARCHAR2 | 네트워크/기기 타입 |

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

#### 로그 전송 키명 (iBatis 매핑 일치)
```
프론트 전송 키       →  iBatis 파라미터     →  DB 컬럼
P_LOGIN_TRX_ID      →  #P_LOGIN_TRX_ID#    →  LOGIN_TRX_ID (= P_LOGIN_TRX_ID)
P_NW_TYPE           →  #P_NW_TYPE#         →  NW_TYPE (= P_NW_TYPE)
```
> 주의: 프론트에서 `LOGIN_TRX_ID`/`NW_TYPE`로 보내면 iBatis 매핑 불일치로 DB에 NULL 저장됨.
> 반드시 `P_LOGIN_TRX_ID`/`P_NW_TYPE` 키로 전송해야 함.

### 4.4 MENU_NM 자동 매핑 (logService.ts)

`logNavigation()` 호출 시 MENU_NM을 명시적으로 전달하지 않으면 toView의 한글 매핑명이 자동 입력됨.

#### VIEW_MENU_NAMES 매핑 테이블 (전체 14개 View)

| View ID | MENU_NM | 출처 |
|---------|---------|------|
| `today-work` | 오늘의 작업 | Header/SideDrawer |
| `menu` | 메인메뉴 | - |
| `work-management` | 작업관리 | Header/BottomNav/SideDrawer/MainMenu |
| `work-order-detail` | 작업상세 | Header |
| `work-complete-form` | 작업완료 | Header |
| `work-complete-detail` | 작업완료상세 | Header |
| `work-item-list` | 작업목록 | Header |
| `work-process-flow` | 작업진행 | Header |
| `customer-management` | 고객관리 | Header/BottomNav/SideDrawer/MainMenu |
| `equipment-management` | 장비관리 | Header/BottomNav/SideDrawer/MainMenu |
| `other-management` | 기타관리 | Header/BottomNav/SideDrawer/MainMenu |
| `settings` | 설정 | - |
| `api-explorer` | API탐색기 | - |
| `coming-soon` | 준비중 | Header |

> 매핑은 `type View` 유니온 타입 14개와 완전 일치 검증 완료.
> 매핑에 없는 viewId가 들어오면 viewId 문자열 그대로 MENU_NM에 저장됨.

### 4.5 NW_TYPE 기기/네트워크 분류 (logService.ts)

#### 기기 타입 분류 (UserAgent 기반)

| 코드 | 기기 | 판별 기준 |
|------|------|----------|
| PC_WIN | Windows PC | `/Windows/i` (Touch가 없거나 maxTouchPoints=0) |
| PC_MAC | Mac PC | `/Macintosh\|Mac OS/i` (maxTouchPoints ≤ 1) |
| PC_LINUX | Linux PC | `/Linux\|X11/i` (Android 아님) |
| PC_CHROMEBOOK | Chromebook | `/CrOS/i` |
| PC_TAB | Windows 태블릿 | `/Windows/i` + maxTouchPoints > 0 + `/Touch/i` |
| ANDROID | Android 폰 | `/Android/i` + `/Mobile/i` |
| ANDROID_TAB | Android 태블릿 | `/Android/i` + Mobile 없음 |
| IPHONE | iPhone | `/iPhone/i` |
| IPAD | iPad | `/iPad/i` 또는 (Macintosh + maxTouchPoints > 1) |

#### 네트워크 타입 분류 (navigator.connection API)

| 코드 | 네트워크 | 판별 기준 |
|------|---------|----------|
| WIFI | Wi-Fi | `conn.type === 'wifi'` |
| LTE | LTE/5G | `conn.type === 'cellular'` 또는 모바일 `effectiveType === '4g'` |
| 3G | 3G | 모바일 `effectiveType === '3g'` |
| 2G | 2G | 모바일 `effectiveType === '2g' \| 'slow-2g'` |
| ETHERNET | 유선 | `conn.type === 'ethernet'` |
| BT | 블루투스 | `conn.type === 'bluetooth'` |

#### 최종 NW_TYPE 출력 형식

```
{기기타입}_{네트워크타입}   (네트워크 감지 시)
{기기타입}                 (네트워크 감지 불가 시)
```

**출력 예시:**

| 접속 환경 | NW_TYPE 값 |
|----------|-----------|
| Windows PC + Wi-Fi | `PC_WIN_WIFI` |
| Windows PC + 유선 | `PC_WIN_ETHERNET` |
| Windows PC (네트워크 불명) | `PC_WIN` |
| Mac PC | `PC_MAC` |
| Android 폰 + LTE | `ANDROID_LTE` |
| Android 폰 + Wi-Fi | `ANDROID_WIFI` |
| Android 태블릿 + Wi-Fi | `ANDROID_TAB_WIFI` |
| iPhone + Wi-Fi | `IPHONE_WIFI` |
| iPhone (Safari - connection 미지원) | `IPHONE` |
| iPad + Wi-Fi | `IPAD_WIFI` |
| iPad (Safari - connection 미지원) | `IPAD` |

#### 브라우저 API 제한 사항
- **PC Chrome**: `effectiveType`이 항상 `'4g'` 반환 → PC에서는 effectiveType 무시
- **iPhone/iPad Safari**: `navigator.connection` API 미지원 → 기기명만 반환
- **5G vs LTE**: 브라우저 API로 구분 불가 → 둘 다 `LTE`로 분류

#### 구현 코드 (logService.ts)

```typescript
function getDeviceType(): string {
  try {
    const ua = navigator.userAgent || '';
    if (/iPad/i.test(ua)) return 'IPAD';
    if (/Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number'
        && navigator.maxTouchPoints > 1) return 'IPAD';
    if (/iPhone/i.test(ua)) return 'IPHONE';
    if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'ANDROID' : 'ANDROID_TAB';
    if (/Macintosh|Mac OS/i.test(ua)) return 'PC_MAC';
    if (/CrOS/i.test(ua)) return 'PC_CHROMEBOOK';
    if (/Windows/i.test(ua)) {
      if (typeof navigator.maxTouchPoints === 'number'
          && navigator.maxTouchPoints > 0 && /Touch/i.test(ua)) return 'PC_TAB';
      return 'PC_WIN';
    }
    if (/Linux|X11/i.test(ua)) return 'PC_LINUX';
    return 'PC_WIN';
  } catch { return 'PC_WIN'; }
}

function getConnectionType(): string {
  try {
    const conn = (navigator as any).connection
      || (navigator as any).mozConnection
      || (navigator as any).webkitConnection;
    if (!conn) return '';
    if (conn.type && conn.type !== 'unknown' && conn.type !== 'none'
        && conn.type !== 'other') {
      const t = conn.type.toLowerCase();
      if (t === 'wifi') return 'WIFI';
      if (t === 'cellular') return 'LTE';
      if (t === 'ethernet') return 'ETHERNET';
      if (t === 'bluetooth') return 'BT';
      return conn.type.toUpperCase();
    }
    if (conn.effectiveType) {
      const e = conn.effectiveType.toLowerCase();
      if (!/Mobi|Android/i.test(navigator.userAgent || '')) return '';
      if (e === '4g') return 'LTE';
      if (e === '3g') return '3G';
      if (e === '2g' || e === 'slow-2g') return '2G';
    }
    return '';
  } catch { return ''; }
}

function getNetworkType(): string {
  const device = getDeviceType();
  const conn = getConnectionType();
  if (conn) return device + '_' + conn;
  return device;
}
```

### 4.6 이벤트 트리거 연결

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

### 4.7 데이터 흐름

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
  │   → {USR_ID, USR_NM, SO_ID, CRR_ID}
  ├─ getLoginTrxId() → localStorage('loginTrxId') 읽기
  ├─ getNetworkType() → 기기+네트워크 분류
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

## 6. WAS 컨테이너명 (fn_get_was_name)

### 레거시 구현 (BulletinManagementImpl.java)

```java
String str_comm = System.getProperty("sun.java.command").toString();
String[] str_comm_arr = str_comm.split(" ");
String nm_container = str_comm_arr[str_comm_arr.length - 1];
```

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
| INVALID_PARAM 에러 (401) | `wasName` | codeMsgWithWas()로 포함 |
| pmobileLoginApi_1 | `P_SERVER` | 컨테이너명으로 자동 설정 (프론트 값 무시) |
| pmobileLoginApi_2 | `P_RESPONSE_DATA` | `WAS=컨테이너명` 추가 |
| pmobileLoginApi_3 | `P_FINAL_RESULT_MSG` | `WAS=컨테이너명` 추가 |

### 프론트엔드 전달 흐름

```
[Login.tsx]
  ├─ loginApi1: P_SERVER → backend가 자동 설정
  ├─ login() 성공 → result.wasName
  │   ├─ loginApi2: P_RESULT_CD='SUCC', P_RESPONSE_DATA="WAS=컨테이너명"
  │   └─ loginApi3: P_FINAL_RESULT_MSG="...,WAS=컨테이너명"
  └─ login() 실패 (401) → err.details.wasName
      ├─ loginApi2: P_RESULT_CD='FAIL', P_RESULT_MSG="[에러코드] 메시지"
      │             P_RESPONSE_DATA="WAS=컨테이너명"
      └─ loginApi3: P_FINAL_RESULT_MSG="에러코드,WAS=컨테이너명"
```

---

## 7. 한글 인코딩 (UTF-8 / EUC-KR)

### 문제
WebSphere 기본 인코딩이 EUC-KR이므로 `req.getReader()`가 UTF-8 바이트를 EUC-KR로 해석하여 한글 깨짐 발생.

### 해결 (TaskAuthController.java)

**수정 전:**
```java
BufferedReader r = req.getReader();
char[] buf = new char[4096];
```

**수정 후:**
```java
java.io.InputStream is = req.getInputStream();
java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
byte[] buf = new byte[4096];
int n;
while ((n = is.read(buf)) != -1) { baos.write(buf, 0, n); }
String body = new String(baos.toByteArray(), "UTF-8");
```

### 적용 메서드
- `parseJsonBody(req)` — 단일 JSON 파싱
- `parseJsonBodyAll(req)` — 전체 필드 추출 (insertLog 등)

---

## 8. 커밋 이력

### 프론트엔드 (main 브랜치 - GitHub Actions 자동 배포)

| 커밋 | 파일 | 수정 내용 |
|------|------|----------|
| - | api-proxy.js | pmobileLoginApi_1/2/3 Express 라우트 추가 |
| - | services/logService.ts | sendLogs() 배치 → 개별 전송으로 변경 |
| - | App.tsx | LOGIN_TRX_ID 이중 생성 방지 (localStorage 체크) |
| - | services/apiService.ts | PASSWORD 키명 수정, DRM_VERSION="1000", LOGIN_VIEW="MOBILE" |
| - | services/apiService.ts | fetchWithRetry 4xx error response body parsing (wasName 추출) |
| - | services/apiService.ts | LoginResponse에 wasName 필드 추가 |
| - | components/layout/Login.tsx | loginApi2/3에 WAS 컨테이너명 포함 (성공/실패 모두) |
| e13a1f9 | components/layout/Login.tsx | P_RESULT_CD: SUCCESS→SUCC (성공 시), errCode→FAIL (실패 시) |
| 14a0399 | components/layout/Login.tsx | handleForceLogin에서도 P_RESULT_CD 동일 수정 |
| 531450e | services/logService.ts | NW_TYPE 기기 분류 (getDeviceType) 구현 |
| 188ea3d | services/logService.ts | PC effectiveType='4g' 무시 로직 추가 |
| 2cf1b5d | services/logService.ts | ANDROID_TAB 추가 |
| c1f0a06 | services/logService.ts | PC_MAC, PC_LINUX 추가 |
| 1388a98 | services/logService.ts | PC_CHROMEBOOK, PC_TAB 추가 |
| d03e4c9 | services/logService.ts | LOGIN_TRX_ID→P_LOGIN_TRX_ID, NW_TYPE→P_NW_TYPE 키명 수정 (iBatis 일치) |
| d03e4c9 | services/logService.ts | VIEW_MENU_NAMES 매핑 추가 (14개 View→한글 MENU_NM 자동 입력) |
| d03e4c9 | components/layout/Login.tsx | Circuit Breaker 503 차단 팝업 모달 추가 |

### 백엔드 (jsh 브랜치 → 관리자 빌드/배포)

| 커밋 | 파일 | 수정 내용 |
|------|------|----------|
| - | TaskAuthController.java | pmobileLoginApi_1/2/3 엔드포인트 추가 |
| - | api-servlet.xml | pmobileLoginApi URL 매핑 추가 |
| - | TaskAuthController.java | LOCK 계정 감지 (423 응답) |
| - | TaskAuthController.java | insertActivityLog/insertDebugLog 엔드포인트 추가 |
| - | api-servlet.xml | insertActivityLog/insertDebugLog URL 매핑 추가 |
| - | TaskAuthController.java | P_LOGIN_TRX_ID/P_NW_TYPE 파라미터 키 매핑 수정 |
| - | TaskAuthController.java | 레거시 로그인 플로우 완전 매칭 (동시접속, modUsrLoginDt, addUsrConnLog) |
| - | TaskAuthController.java | getWasContainerName() 구현 + 로그인 응답/감사로그에 포함 |
| - | TaskAuthController.java | pmobileLoginApi_1 P_SERVER에 WAS 컨테이너명 자동 설정 |
| - | TaskAuthController.java | INVALID_PARAM에 codeMsgWithWas() 적용 (wasName 포함) |
| 64a162e | TaskAuthController.java | INVALID_PARAM wasName 포함 수정 (codeMsgWithWas) |
| a361a82 | TaskAuthController.java | 한글 인코딩 수정: getInputStream + UTF-8 명시적 디코딩 |

### api-servlet.xml URL 매핑 (전체)

```xml
<prop key="/api/system/pm/pmobileLoginApi_1">authController</prop>
<prop key="/api/system/pm/pmobileLoginApi_2">authController</prop>
<prop key="/api/system/pm/pmobileLoginApi_3">authController</prop>
<prop key="/api/system/pm/insertActivityLog">authController</prop>
<prop key="/api/system/pm/insertDebugLog">authController</prop>
<prop key="/api/system/pm/saveDliveAttendance">authController</prop>
```

---

## 9. 발견 및 수정한 버그 (총 18건)

| # | 버그 | 원인 | 수정 |
|---|------|------|------|
| 1 | LOGIN_TRX_ID DB에 NULL | Java 키 `LOGIN_TRX_ID` ≠ iBatis `#P_LOGIN_TRX_ID#` | `P_LOGIN_TRX_ID`로 수정 |
| 2 | NW_TYPE DB에 NULL | Java 키 `NW_TYPE` ≠ iBatis `#P_NW_TYPE#` | `P_NW_TYPE`로 수정 |
| 3 | USR_NM 한글 깨짐 | WebSphere EUC-KR + `req.getReader()` | `req.getInputStream()` + UTF-8 명시적 디코딩 |
| 4 | Activity 로그 전체 빈값 | `{"logs":[...]}` 배치 전송 → CONA 파싱 불가 | 개별 전송으로 변경 |
| 5 | pmobileLoginApi 404 | Express에 라우트 미등록 | router.post 추가 |
| 6 | LOGIN_TRX_ID 불일치 | App.tsx에서 재생성하여 Login.tsx 것을 덮어씀 | localStorage 체크 후 조건부 생성 |
| 7 | DRM_VERSION 불일치 | "1.0" 전송 → INVALID_DRM | "1000"으로 수정 (레거시 동일) |
| 8 | LOGIN_VIEW 불일치 | "APP" 전송 → 레거시는 "MOBILE" | "MOBILE"로 수정 |
| 9 | PASSWORD 키명 | USR_PWD로 전송 | PASSWORD로 통일 |
| 10 | 동시접속 체크 누락 | getUsrSessionInfo 미호출 | 레거시와 동일하게 추가 |
| 11 | 로그인일자 미갱신 | modUsrLoginDt 미호출 | 추가 (LAST_LOGIN_DT 업데이트) |
| 12 | 접속로그 미저장 | addUsrConnLog 미호출 | 추가 (tsylm_usr_conn INSERT) |
| 13 | WAS 컨테이너명 미포함 | 레거시 fn_get_was_name 누락 | getWasContainerName() 구현, 응답+감사로그에 포함 |
| 14 | loginApi2 P_RESULT_CD에 에러코드 전송 | catch에서 errCode(INVALID_PASS 등) 직접 전송 | P_RESULT_CD='FAIL' 고정, 에러코드는 P_RESULT_MSG에 `[CODE] msg` 형태 |
| 15 | 한글 인코딩 깨짐 (UTF-8→EUC-KR) | `req.getReader()`가 WebSphere 기본 인코딩 사용 | `req.getInputStream()` + 명시적 UTF-8 바이트 디코딩 |
| 16 | P_LOGIN_TRX_ID/P_NW_TYPE DB에 여전히 NULL | 프론트에서 `LOGIN_TRX_ID`/`NW_TYPE` 키로 전송 → iBatis `#P_LOGIN_TRX_ID#` 불일치 | 프론트 키명을 `P_LOGIN_TRX_ID`/`P_NW_TYPE`로 수정 |
| 17 | MENU_NM 항상 NULL | `logNavigation()` 호출 시 menuNm 파라미터 미전달 | VIEW_MENU_NAMES 매핑 테이블 추가, toView→한글 자동 변환 |
| 18 | Circuit Breaker 503 에러 시 팝업 없음 | 차단 에러가 일반 에러 메시지로만 표시 | blockMessage 모달 팝업 추가 (amber 경고 스타일) |

---

## 10. 테스트 결과 (2026-03-12)

### API 테스트 (15건 전체 통과)

| # | 테스트 | 상태 | 결과 |
|---|--------|------|------|
| 1 | 로그인 성공 | 200 OK | ok=true, userId/userName/crrId/wasName 정상 |
| 2 | 로그인 실패 (wrong password) | 401 | code=INVALID_PASS, message/wasName 정상 |
| 3 | 로그인 실패 (빈값) | 401 | code=INVALID_PARAM, wasName 포함 정상 |
| 4 | pmobileLoginApi_1 | 200 OK | ok=true |
| 5 | pmobileLoginApi_2 (SUCC) | 200 OK | ok=true |
| 6 | pmobileLoginApi_2 (FAIL) | 200 OK | ok=true |
| 7 | pmobileLoginApi_3 (SUCCESS) | 200 OK | ok=true |
| 8 | pmobileLoginApi_3 (FAIL) | 200 OK | ok=true |
| 9 | insertActivityLog (LOGIN) | 200 OK | ok=true |
| 10 | insertActivityLog (MENU_CLICK) | 200 OK | ok=true |
| 11 | insertActivityLog (WORK_COMPLETE) | 200 OK | ok=true |
| 12 | insertActivityLog (LOGOUT) | 200 OK | ok=true |
| 13 | insertDebugLog (ERROR) | 200 OK | ok=true |
| 14 | insertDebugLog (WARN) | 200 OK | ok=true |
| 15 | insertActivityLog (한글 테스트) | 200 OK | ok=true, 한글 정상 저장 |

### EC2 배포 코드 검증 (SSH)

```bash
# Login.tsx에서 P_RESULT_CD 검증
$ grep -c "SUCC" Login.tsx    → 2건 (성공 2곳)
$ grep -c "INVALID_PASS" Login.tsx → 0건 (에러코드 직접 사용 없음)
$ grep -c "'FAIL'" Login.tsx  → 8건 (실패 처리 정상)
```

---

## 11. 배포 상태

### 프론트엔드 (EC2 - GitHub Actions 자동 배포) ✅ 완료

| 항목 | 상태 |
|------|------|
| logService.ts (개별 전송 + NW_TYPE 기기/네트워크 분류) | ✅ 배포 완료 |
| logService.ts (P_LOGIN_TRX_ID/P_NW_TYPE 키명 수정) | ✅ 배포 완료 |
| logService.ts (VIEW_MENU_NAMES 매핑 - MENU_NM 자동 입력) | ✅ 배포 완료 |
| api-proxy.js (pmobileLoginApi 라우트) | ✅ 배포 완료 |
| apiService.ts (DRM_VERSION, LOGIN_VIEW, PASSWORD, wasName) | ✅ 배포 완료 |
| App.tsx (LOGIN_TRX_ID 조건부 생성) | ✅ 배포 완료 |
| Login.tsx (loginApi1/2/3 + P_RESULT_CD SUCC/FAIL) | ✅ 배포 완료 |
| Login.tsx (Circuit Breaker 503 차단 팝업) | ✅ 배포 완료 |

### 백엔드 (CONA WebSphere - 관리자 수동 배포) ✅ 완료

| 항목 | 상태 |
|------|------|
| TaskAuthController.java (전체 - 로그인/로그/한글/WAS) | ✅ 배포 완료 |
| api-servlet.xml (6개 URL 매핑) | ✅ 배포 완료 |

---

## 12. 수정 파일 목록

### 프론트엔드

| 파일 경로 | 역할 |
|----------|------|
| `api-proxy.js` | Express 프록시 라우트 (pmobileLoginApi, insertLog) |
| `services/logService.ts` | 로그 서비스 (배치 큐, NW_TYPE 분류, loginApi1/2/3) |
| `services/apiService.ts` | API 호출 (login, fetchWithRetry, wasName 파싱) |
| `components/layout/Login.tsx` | 로그인 UI + loginApi1/2/3 호출 + P_RESULT_CD |
| `App.tsx` | LOGIN_TRX_ID 생성, logLogin/logLogout 호출 |

### 백엔드

| 파일 경로 | 역할 |
|----------|------|
| `src/task/TaskAuthController.java` | 로그인/로그 엔드포인트, 한글 인코딩, WAS 컨테이너명 |
| `deployment-package/api-servlet.xml` | URL → Controller 매핑 |
