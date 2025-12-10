---
description: 공통/기타 기능 테스트 시나리오 실행 및 검증
---

# 공통/기타 기능 테스트

공통 모듈 및 기타 기능을 테스트하고 결과를 검증합니다.

## 테스트 대상 기능 (30+ 개)

### ✅ 완료된 기능 (Phase 1)

#### 1. 인증 (CO-001 ~ CO-003)
- **CO-001**: 로그인 (Login.tsx - 300줄) ✅
- **CO-002**: 로그아웃 ✅
- **CO-003**: 토큰 갱신 ✅

#### 2. 공통코드 (CO-004 ~ CO-006)
- **CO-004**: 공통코드 단일 조회 ✅
- **CO-005**: 공통코드 다중 조회 ✅
- **CO-006**: 사용자 목록 조회 (WorkerAdjustment.tsx) ✅

#### 3. 계약 (CO-007 ~ CO-009)
- **CO-007**: 계약 장비 리스트 (ContractInfo.tsx - 300줄) ✅
- **CO-008**: 상품별 장비명 리스트 (ReceptionInfo.tsx - 250줄) ✅

#### 4. 신호체크 (CO-015 ~ CO-016)
- **CO-015**: STB 서버 연결 체크 (SignalCheck.tsx - 400줄) ✅
- **CO-016**: ENS 발송 이력 (WorkResultSignalList.tsx - 200줄) ✅

#### 5. UI컴포넌트 (CO-018 ~ CO-019)
- **CO-018**: Header (Header.tsx - 200줄) ✅
- **CO-019**: Toast 알림 (Toast.tsx - 150줄) ✅

### 🔄 진행 중 기능 (Phase 1)

#### 6. LGU+연동 (CO-011 ~ CO-014)
- **CO-011**: LGU 포트증설 요청 (LGUConstructionRequest.tsx - 400줄) 🔄
- **CO-012**: LGU 계약정보 조회 (LGUNetworkFault.tsx - 350줄) 🔄
- **CO-013**: LGU LDAP 조회 🔄
- **CO-014**: LGU 망장애 신고 🔄

#### 7. 연동이력 (CO-017)
- **CO-017**: LGU+ 연동 이력 조회 (IntegrationHistoryModal.tsx - 300줄) 🔄

### 📋 계획 중 기능 (Phase 2+)
- CO-009: 장비 리스트 (기본)
- CO-010: LGU 포트현황 조회 (CL02)

---

## 카테고리별 테스트

### 1. 인증 (CO-001 ~ CO-003)

#### CO-001: 로그인
```bash
# API 테스트
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "TEST_USER",
    "password": "test1234"
  }'
```

**예상 결과**:
- ✅ HTTP 200 응답
- ✅ JWT 토큰 반환
- ✅ 사용자 정보 반환
- ✅ 필드:
  - accessToken: "eyJhbGciOiJIUzI1NiIs..."
  - refreshToken: "eyJhbGciOiJIUzI1NiIs..."
  - user: { userId, userName, userRole, soId }
  - AUTH_SO_List: 지점 목록 배열

**UI 테스트**:
1. 로그인 화면
2. 사용자 ID 입력: TEST_USER
3. 비밀번호 입력: test1234
4. "로그인" 버튼 클릭
5. 로딩 스피너 표시
6. 로그인 성공
7. localStorage에 저장 확인:
   - userInfo
   - accessToken
   - branchList (AUTH_SO_List)
8. 메인 화면으로 이동

**에러 케이스**:
```bash
# 잘못된 비밀번호
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"TEST_USER","password":"wrong"}'

# 예상: HTTP 401, "아이디 또는 비밀번호가 올바르지 않습니다."
```

#### CO-002: 로그아웃
```bash
# API 테스트
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>"
```

**예상 결과**:
- ✅ HTTP 200 응답
- ✅ 세션 종료 확인

**UI 테스트**:
1. 메인 화면
2. 사이드바 열기
3. "로그아웃" 버튼 클릭
4. 확인 다이얼로그 표시
5. "확인" 클릭
6. localStorage 초기화 확인
7. 로그인 화면으로 이동

#### CO-003: 토큰 갱신
```bash
# API 테스트
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refreshToken>"
  }'
```

**예상 결과**:
- ✅ 새로운 accessToken 반환
- ✅ refreshToken 유지 또는 갱신

**자동 테스트**:
- accessToken 만료 시 자동 갱신
- 401 에러 발생 시 자동 리프레시 시도
- 리프레시 실패 시 로그인 화면 이동

---

### 2. 공통코드 (CO-004 ~ CO-006)

#### CO-004: 공통코드 단일 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/common/getCommonCodeList \
  -H "Content-Type: application/json" \
  -d '{
    "grpCd": "EQT_STS"
  }'
```

**예상 결과**:
- ✅ 코드 리스트 배열 반환
- ✅ 필드:
  - cd: "10"
  - cdNm: "재고"
  - sortSeq: 1
  - useYn: "Y"

**사용 예시**:
```javascript
// 장비 상태 코드 조회
const eqtStsCodes = await getCommonCodeList('EQT_STS');
// [
//   { cd: '10', cdNm: '재고' },
//   { cd: '20', cdNm: '사용중' },
//   { cd: '30', cdNm: '분실' }
// ]

// Select Box에 바인딩
<select>
  {eqtStsCodes.map(code => (
    <option key={code.cd} value={code.cd}>
      {code.cdNm}
    </option>
  ))}
</select>
```

#### CO-005: 공통코드 다중 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/common/getCommonCodes \
  -H "Content-Type: application/json" \
  -d '{
    "grpCds": ["EQT_STS", "EQT_TYPE", "WORK_TYPE"]
  }'
```

**예상 결과**:
- ✅ 그룹별 코드 맵 반환
- ✅ 형식:
```json
{
  "EQT_STS": [
    { "cd": "10", "cdNm": "재고" },
    { "cd": "20", "cdNm": "사용중" }
  ],
  "EQT_TYPE": [
    { "cd": "10", "cdNm": "셋톱박스" },
    { "cd": "20", "cdNm": "모뎀" }
  ],
  "WORK_TYPE": [
    { "cd": "10", "cdNm": "설치" },
    { "cd": "20", "cdNm": "AS" }
  ]
}
```

**사용 예시**:
```javascript
// 여러 공통코드 한번에 조회
const codes = await getCommonCodes(['EQT_STS', 'EQT_TYPE', 'WORK_TYPE']);

// localStorage에 캐싱
localStorage.setItem('commonCodes', JSON.stringify(codes));

// 코드명 변환 함수
const getCodeName = (grpCd, cd) => {
  const code = codes[grpCd]?.find(c => c.cd === cd);
  return code?.cdNm || cd;
};

// 사용
const statusName = getCodeName('EQT_STS', '10'); // "재고"
```

#### CO-006: 사용자 목록 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/system/user-list \
  -H "Content-Type: application/json" \
  -d '{
    "soId": "SO001",
    "userNm": "김"
  }'
```

**예상 결과**:
- ✅ 사용자 리스트 배열
- ✅ 필드: USR_ID, USR_NM, SO_ID, SO_NM, MOBILE_NO, USR_ROLE

---

### 3. 계약 (CO-007 ~ CO-009)

#### CO-007: 계약 장비 리스트
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/receipt/contract/getContractEqtList \
  -H "Content-Type: application/json" \
  -d '{
    "cntrId": "CNTR123456"
  }'
```

**예상 결과**:
- ✅ 계약 장비 리스트 배열
- ✅ 필드:
  - EQT_TYPE_CD, EQT_TYPE_NM
  - EQT_MDL_CD, EQT_MDL_NM
  - EQT_SERNO, MAC_ADDR
  - RENT_TYPE_CD (1:임대, 2:고객소유)

**UI 테스트**:
1. 계약 상세 화면
2. "장비 정보" 탭 클릭
3. 계약 장비 리스트 표시
   - STB: STB-2000 (임대)
   - Modem: MODEM-500 (임대)
4. 각 장비의 S/N, MAC 주소 표시
5. "장비 추가" 버튼 (설치 전 상태만)

#### CO-008: 상품별 장비명 리스트
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/receipt/contract/getEquipmentNmListOfProd \
  -H "Content-Type: application/json" \
  -d '{
    "prodId": "PROD_INTERNET_100M",
    "rentTypeCd": "1"
  }'
```

**예상 결과**:
- ✅ 편성 가능한 장비 리스트
- ✅ 필드: EQT_MDL_CD, EQT_MDL_NM, EQT_TYPE_CD

**사용 시나리오**:
```
1. 장비 변경 화면
2. 상품: 인터넷 100M
3. 임대 구분: 임대
4. API 호출 → 선택 가능한 모델 리스트
   - STB-2000
   - STB-3000
   - STB-4K
5. 모델 선택
6. 장비 변경 처리
```

---

### 4. LGU+연동 (CO-011 ~ CO-014)

#### CO-011: LGU 포트증설 요청
```bash
# API 테스트
curl -X POST http://localhost:3000/api/lgu/construction-request \
  -H "Content-Type: application/json" \
  -d '{
    "cntrId": "CNTR123456",
    "reqType": "PORT_EXP",
    "l2EqipId": "L2001",
    "rnEqipId": "RN001",
    "portCnt": 4
  }'
```

**예상 결과**:
- ✅ 증설 요청 접수 성공
- ✅ REQ_NO: 요청 번호
- ✅ RESULT_MSG: "포트 증설 요청이 접수되었습니다."

**UI 테스트**:
1. 작업 프로세스 > 설치 단계
2. "집선" 탭 클릭
3. "포트 증설 요청" 버튼 클릭
4. L2 장비 선택
5. RN 장비 선택
6. 증설 포트 수: 4개
7. "요청" 버튼 클릭
8. 확인 다이얼로그
9. LGU+ API 호출 (실시간)
10. 성공 메시지 + 요청번호 표시

#### CO-012: LGU 계약정보 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/lgu/contract-info \
  -H "Content-Type: application/json" \
  -d '{
    "cntrId": "CNTR123456"
  }'
```

**예상 결과**:
- ✅ LGU 계약 정보 반환
- ✅ 필드:
  - LDAP_ID, LDAP_PW
  - L2_EQIP_NM, RN_EQIP_NM
  - PORT_NO
  - INSTALL_ADDR

**UI 테스트**:
1. 작업 상세 화면
2. "LGU+ 정보" 탭 클릭
3. 계약 정보 표시
   - LDAP ID/PW
   - L2 장비명
   - RN 장비명
   - 포트번호
4. "새로고침" 버튼 (실시간 조회)

#### CO-013: LGU LDAP 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/lgu/ldap-info \
  -H "Content-Type: application/json" \
  -d '{
    "ldapId": "LDAP123456"
  }'
```

**예상 결과**:
- ✅ LDAP 정보 반환
- ✅ 필드: LDAP_STS, LDAP_DT, MAC_ADDR, IP_ADDR

#### CO-014: LGU 망장애 신고
```bash
# API 테스트
curl -X POST http://localhost:3000/api/lgu/network-fault \
  -H "Content-Type: application/json" \
  -d '{
    "cntrId": "CNTR123456",
    "faultType": "INTERNET",
    "faultDesc": "인터넷 불통",
    "l2EqipId": "L2001"
  }'
```

**예상 결과**:
- ✅ 망장애 신고 접수
- ✅ FAULT_NO: 장애 접수 번호

**UI 테스트**:
1. 작업 상세 화면
2. "망장애 신고" 버튼 클릭
3. 장애 유형 선택: 인터넷 불통
4. 증상 입력
5. L2 장비 정보 자동 입력
6. "신고" 버튼 클릭
7. LGU+ API 호출
8. 접수 완료 메시지 + 접수번호

---

### 5. 신호체크 (CO-015 ~ CO-016)

#### CO-015: STB 서버 연결 체크
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/work/checkStbServerConnection \
  -H "Content-Type: application/json" \
  -d '{
    "eqtSerno": "STB123456",
    "macAddr": "00:11:22:33:44:55"
  }'
```

**예상 결과**:
- ✅ 연결 상태 반환
- ✅ 필드:
  - TV_CONN_STS: "Y" / "N"
  - INTERNET_CONN_STS: "Y" / "N"
  - LAST_CONN_DT: 최종 연결 시간

**UI 테스트**:
1. 작업 프로세스 > 확인 단계
2. "신호 체크" 탭 클릭
3. "STB 연결 확인" 버튼 클릭
4. 로딩 스피너 (3초)
5. 연결 상태 표시
   - TV: ✅ 정상
   - 인터넷: ✅ 정상
   - 최종 연결: 2025-01-28 10:30:00
6. "재확인" 버튼 (다시 체크)

#### CO-016: ENS 발송 이력
```bash
# API 테스트
curl -X POST http://localhost:3000/api/signal/ens-history \
  -H "Content-Type: application/json" \
  -d '{
    "cntrId": "CNTR123456",
    "sendDtFrom": "20250101",
    "sendDtTo": "20250131"
  }'
```

**예상 결과**:
- ✅ ENS 발송 이력 배열
- ✅ 필드:
  - SEND_DT: 발송 일시
  - RECV_TEL_NO: 수신 번호
  - MSG_CONTENT: 메시지 내용
  - SEND_STS: "Y" / "N"

**UI 테스트**:
1. 작업 상세 화면
2. "문자 이력" 탭 클릭
3. 날짜 범위 선택
4. ENS 발송 이력 리스트 표시
5. 메시지 내용 클릭 → 전체 내용 모달

---

### 6. 연동이력 (CO-017)

#### CO-017: LGU+ 연동 이력 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/integration/history \
  -H "Content-Type: application/json" \
  -d '{
    "cntrId": "CNTR123456",
    "apiType": "LDAP",
    "callDtFrom": "20250101",
    "callDtTo": "20250131"
  }'
```

**예상 결과**:
- ✅ 연동 이력 배열
- ✅ 필드:
  - CALL_DT: 호출 일시
  - API_TYPE: "LDAP" / "CONF" / "entrInfo"
  - REQ_DATA: 요청 데이터
  - RES_DATA: 응답 데이터
  - RESULT_CD: "0000" / "E001"

**UI 테스트**:
1. 작업 상세 화면
2. "LGU+ 연동 이력" 버튼 클릭
3. 연동 이력 모달 표시
4. API 타입 필터: LDAP
5. 날짜 범위 선택
6. 이력 리스트 표시
7. 이력 클릭 → 요청/응답 데이터 표시

---

## 테스트 시나리오

### 시나리오 1: 로그인 → 공통코드 로드 → 작업 조회

```
1. 로그인 (CO-001)
   → ID/PW 입력
   → JWT 토큰 발급
   → localStorage 저장

2. 공통코드 다중 조회 (CO-005)
   → 자동 실행 (앱 시작 시)
   → EQT_STS, EQT_TYPE, WORK_TYPE 등 20개 그룹
   → localStorage에 캐싱

3. 사용자 정보 확인
   → 지점 목록 (AUTH_SO_List)
   → 사용자 권한

4. 작업 목록 조회
   → 공통코드로 상태명 변환
   → 지점명 표시
```

### 시나리오 2: 장비 변경 (공통코드 활용)

```
1. 작업 프로세스 > 설치 단계
2. 장비 구성 조회 (CO-007)
   → 현재 장비: STB-2000
3. "장비 변경" 버튼 클릭
4. 상품별 장비 리스트 조회 (CO-008)
   → 임대 구분: "1" (임대)
   → 선택 가능: STB-3000, STB-4K
5. 새 모델 선택: STB-3000
6. 장비 변경 저장
7. 업데이트된 장비 정보 확인
```

### 시나리오 3: LGU+ 집선 (연동 이력 확인)

```
1. LDAP 등록 (WM-020)
   → LGU+ API 호출
   → LDAP_NO 반환
2. LDAP 결과 조회 (CO-013)
   → LDAP 상태 확인
3. LGU 계약정보 조회 (CO-012)
   → L2/RN 정보 표시
4. LGU+ 연동 이력 조회 (CO-017)
   → LDAP API 호출 이력 확인
   → 요청/응답 데이터 확인
```

---

## 자동화 테스트 스크립트

```bash
#!/bin/bash
# test-common-features.sh

echo "🧪 공통/기타 기능 테스트 시작..."

# CO-001: 로그인
echo ""
echo "1. CO-001: 로그인"
RESULT=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"TEST_USER","password":"test1234"}')

if [ $? -eq 0 ]; then
  TOKEN=$(echo $RESULT | jq -r '.accessToken')
  echo "✅ 성공: 토큰 발급됨"
else
  echo "❌ 실패"
  exit 1
fi

# CO-004: 공통코드 조회
echo ""
echo "2. CO-004: 공통코드 조회"
RESULT=$(curl -s -X POST http://localhost:3000/api/common/getCommonCodeList \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"grpCd":"EQT_STS"}')

if [ $? -eq 0 ]; then
  echo "✅ 성공: $(echo $RESULT | jq 'length') 개 코드"
else
  echo "❌ 실패"
fi

# CO-007: 계약 장비 리스트
echo ""
echo "3. CO-007: 계약 장비 리스트"
RESULT=$(curl -s -X POST http://localhost:3000/api/customer/receipt/contract/getContractEqtList \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cntrId":"CNTR123456"}')

if [ $? -eq 0 ]; then
  echo "✅ 성공: $(echo $RESULT | jq 'length') 개 장비"
else
  echo "❌ 실패"
fi

echo ""
echo "✅ 공통/기타 테스트 완료"
```

---

## 주의사항

- 로그인 토큰은 1시간 후 만료 (리프레시 필요)
- 공통코드는 앱 시작 시 로드 후 localStorage 캐싱
- LGU+ API는 실제 환경에서만 동작 (개발 환경 Mock 데이터)
- STB 신호 체크는 실제 장비 필요
- 연동 이력은 실제 API 호출 시에만 기록됨
