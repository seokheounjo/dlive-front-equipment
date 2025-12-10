---
description: 작업관리 기능 테스트 시나리오 실행 및 검증
---

# 작업관리 기능 테스트

작업관리 파트의 특정 기능을 테스트하고 결과를 검증합니다.

## 테스트 대상 기능 (54개)

### ✅ 완료된 기능 (Phase 1)
- **WM-001**: 작업 목록 조회 (WorkOrderList.tsx - 500줄)
- **WM-003**: 작업 상세 조회 (WorkOrderDetail.tsx - 400줄)
- **WM-011**: 장비구성정보 조회 (EquipmentManagement.tsx - 450줄)
- **WM-012**: 장비구성정보 변경 (EquipmentModelChangeModal.tsx - 880줄)
- **WM-017**: 기사 보유장비 조회

### 🔄 진행 중 기능
- **WM-005**: 문자발송내역 조회 (SMSHistory.tsx - 200줄)
- **WM-009**: 작업자 조회 (WorkerAdjustment.tsx - 250줄)
- **WM-010**: 작업자 변경 등록
- **WM-019**: 장비 작업자 이관 (EquipmentTransfer.tsx)
- **WM-020**: LGU LDAP 등록 (LGULdapRegistration.tsx)
- **WM-021**: LGU LDAP 결과 조회
- **WM-022**: LGU 계약정보 조회

### 📋 계획 중 기능 (Phase 2+)
- WM-004 ~ WM-054 (나머지 40개 기능)

---

## 카테고리별 테스트

### 1. 작업조회 (WM-001 ~ WM-003)

#### WM-001: 작업 목록 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/work/getWorkdrctnList \
  -H "Content-Type: application/json" \
  -d '{
    "WRKR_ID": "TEST_USER",
    "WORK_DT_FROM": "20250101",
    "WORK_DT_TO": "20250131",
    "WORK_STS_CD": "10"
  }'
```

**예상 결과**:
- ✅ HTTP 200 응답
- ✅ 작업 리스트 배열 반환
- ✅ 필드: WORK_DRCTN_NO, CNTR_ID, CUST_NM, ADDR, WORK_TYPE_NM, WORK_STS_NM

**UI 테스트**:
1. 오늘 작업 메뉴 클릭
2. 날짜 범위 선택
3. 상태 필터 선택
4. 작업 리스트 표시 확인
5. 작업 항목 클릭 → 상세 화면 이동

#### WM-003: 작업 상세 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/work/getWorkReceiptList \
  -H "Content-Type: application/json" \
  -d '{
    "WORK_DRCTN_NO": "WD202501280001"
  }'
```

**예상 결과**:
- ✅ 계약 정보 (CNTR_ID, PROD_NM, CUST_NM)
- ✅ 접수 정보 (RCPT_DT, RCPT_TYPE, MEMO)
- ✅ 장비 정보 (EQT_LIST 배열)

---

### 2. 작업상세 (WM-004 ~ WM-008)

#### WM-005: 문자발송내역 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/sigtrans/getENSSendHist \
  -H "Content-Type: application/json" \
  -d '{
    "CNTR_ID": "CNTR123456",
    "SEND_DT_FROM": "20250101",
    "SEND_DT_TO": "20250131"
  }'
```

**예상 결과**:
- ✅ ENS 문자 발송 이력 배열
- ✅ 필드: SEND_DT, RECV_TEL_NO, MSG_CONTENT, SEND_STS

**UI 테스트**:
1. 작업 상세 화면
2. "문자이력" 탭 클릭
3. 날짜 범위 선택
4. 발송 이력 리스트 표시 확인

---

### 3. 작업자보정 (WM-009 ~ WM-010)

#### WM-009: 작업자 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/system/cm/getFindUsrList \
  -H "Content-Type: application/json" \
  -d '{
    "USR_NM": "김",
    "SO_ID": "SO001"
  }'
```

**예상 결과**:
- ✅ 작업자 리스트 배열
- ✅ 필드: USR_ID, USR_NM, SO_NM, MOBILE_NO

**UI 테스트**:
1. 작업 상세 화면
2. "작업자 변경" 버튼 클릭
3. 작업자 검색 (이름/지점)
4. 작업자 선택
5. 변경 사유 입력
6. 저장 버튼 클릭

#### WM-010: 작업자 변경 등록
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/work/modWorkDivision \
  -H "Content-Type: application/json" \
  -d '{
    "WORK_DRCTN_NO": "WD202501280001",
    "NEW_WRKR_ID": "WORKER002",
    "CHG_RSN_CD": "10",
    "CHG_MEMO": "작업 재할당"
  }'
```

**예상 결과**:
- ✅ 성공 메시지 반환
- ✅ RESULT_CODE: "0000"

---

### 4. 장비설치 (WM-011 ~ WM-019)

#### WM-011: 장비구성정보 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/work/getCustProdInfo \
  -H "Content-Type: application/json" \
  -d '{
    "CNTR_ID": "CNTR123456"
  }'
```

**예상 결과**:
- ✅ 계약 장비 리스트 배열
- ✅ 필드: EQT_TYPE_CD, EQT_MDL_NM, EQT_SERNO, MAC_ADDR, RENT_TYPE_CD

**UI 테스트**:
1. 작업 프로세스 플로우 > 1단계 (도착)
2. "장비관리" 탭 클릭
3. 계약 장비 리스트 표시 확인
4. 장비 추가/변경/삭제 버튼 확인

#### WM-012: 장비구성정보 변경
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/work/eqtCmpsInfoChg \
  -H "Content-Type: application/json" \
  -d '{
    "CNTR_ID": "CNTR123456",
    "EQT_TYPE_CD": "10",
    "OLD_EQT_MDL_CD": "STB2000",
    "NEW_EQT_MDL_CD": "STB3000",
    "RENT_TYPE_CD": "1"
  }'
```

**예상 결과**:
- ✅ 성공 메시지
- ✅ 변경된 장비 정보 반환

---

### 5. 집선 (WM-020 ~ WM-028)

#### WM-020: LGU LDAP 등록
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/etc/reqUplsHspdLdap \
  -H "Content-Type: application/json" \
  -d '{
    "CNTR_ID": "CNTR123456",
    "EQT_SERNO": "AB123456",
    "MAC_ADDR": "00:11:22:33:44:55"
  }'
```

**예상 결과**:
- ✅ LDAP 등록 성공
- ✅ LDAP_NO 반환
- ✅ CONF API 자동 호출 성공

**UI 테스트**:
1. 작업 프로세스 플로우 > 2단계 (설치)
2. "집선" 탭 클릭
3. LDAP 등록 버튼 클릭
4. 장비 정보 입력
5. 등록 버튼 클릭
6. 로딩 스피너 표시 (LDAP → CONF 연속 호출)
7. 성공 메시지 확인

#### WM-022: LGU 계약정보 조회
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/etc/getUplsCtrtInfo \
  -H "Content-Type: application/json" \
  -d '{
    "CNTR_ID": "CNTR123456"
  }'
```

**예상 결과**:
- ✅ LGU 계약 정보 반환
- ✅ 필드: LDAP_ID, LDAP_PW, L2_EQIP_NM, RN_EQIP_NM, PORT_NO

---

### 6. 완료처리 (WM-029 ~ WM-040)

#### WM-029: 설치정보 등록
```bash
# API 테스트
curl -X POST http://localhost:3000/api/customer/work/modNetInfo \
  -H "Content-Type: application/json" \
  -d '{
    "CNTR_ID": "CNTR123456",
    "L2_EQIP_ID": "L2001",
    "RN_EQIP_ID": "RN001",
    "PORT_NO": "1-1-1-1",
    "INSTALL_DT": "20250128"
  }'
```

**예상 결과**:
- ✅ 망정보 등록 성공
- ✅ TCMCT_NET_INFO 테이블 INSERT/UPDATE

---

## 테스트 체크리스트

각 기능별로 다음 항목을 검증:

### API 테스트
- [ ] HTTP 200 응답
- [ ] 응답 데이터 형식 (JSON)
- [ ] 필수 필드 존재 여부
- [ ] 응답 시간 (< 3초)
- [ ] 에러 케이스 처리

### UI 테스트
- [ ] 페이지 로드 성공
- [ ] 로딩 스피너 표시
- [ ] 데이터 정상 렌더링
- [ ] 입력 검증 (필수 필드)
- [ ] 에러 메시지 표시
- [ ] 성공 메시지 표시

### 통합 테스트
- [ ] 작업 목록 → 상세 → 프로세스 플로우
- [ ] 장비 조회 → 변경 → 등록
- [ ] LDAP 등록 → 결과 조회
- [ ] 완료 처리 → 서명 → 작업 완료

---

## 테스트 시나리오

### 시나리오 1: 작업 조회 ~ 완료 처리 (End-to-End)

```
1. 작업 목록 조회 (WM-001)
   → 오늘 날짜, 미완료 작업 필터링
   → 작업 10건 표시 확인

2. 작업 상세 조회 (WM-003)
   → 작업 항목 클릭
   → 계약/접수/장비 정보 표시 확인

3. 작업 프로세스 시작
   → "작업 시작" 버튼 클릭
   → 4단계 플로우 진입

4. 1단계: 도착
   → "도착" 버튼 클릭
   → 현재 위치 확인 (GPS)

5. 2단계: 설치
   → 장비 조회 (WM-017)
   → 장비 변경 (WM-012)
   → LDAP 등록 (WM-020)

6. 3단계: 확인
   → 신호 체크
   → 고객 확인

7. 4단계: 완료
   → 서명 받기
   → 사진 촬영
   → 완료 처리 (WM-029)
   → 문자 발송 (WM-005)

8. 작업 완료 확인
   → 작업 목록으로 돌아가기
   → 완료된 작업 상태 확인
```

### 시나리오 2: 작업자 변경

```
1. 작업 상세 화면
2. "작업자 변경" 버튼 클릭
3. 작업자 검색 (WM-009)
   → 이름: "김"
   → 지점: "서울지점"
   → 검색 결과 5명 표시
4. 작업자 선택: "김철수"
5. 변경 사유 선택: "업무 과다"
6. 메모 입력: "긴급 작업 발생으로 재할당"
7. 저장 (WM-010)
8. 성공 메시지 확인
9. 작업 상세 화면에서 변경된 작업자 확인
```

### 시나리오 3: 장비 교체

```
1. 작업 프로세스 > 설치 단계
2. "장비관리" 탭
3. 현재 장비 리스트 확인 (WM-011)
   → STB: STB-2000 (임대)
   → Modem: MODEM-500 (임대)
4. STB 변경 버튼 클릭
5. 새 모델 선택: STB-3000
6. 변경 사유: "고객 요청"
7. 저장 (WM-012)
8. 성공 메시지 확인
9. 업데이트된 장비 리스트 확인
```

---

## 자동화 테스트 스크립트

```bash
#!/bin/bash
# test-work-features.sh

echo "🧪 작업관리 기능 테스트 시작..."

# WM-001: 작업 목록 조회
echo ""
echo "1. WM-001: 작업 목록 조회"
RESULT=$(curl -s -X POST http://localhost:3000/api/customer/work/getWorkdrctnList \
  -H "Content-Type: application/json" \
  -d '{"WRKR_ID":"TEST_USER","WORK_DT_FROM":"20250101","WORK_DT_TO":"20250131"}')

if [ $? -eq 0 ]; then
  echo "✅ 성공: $(echo $RESULT | jq 'length') 건"
else
  echo "❌ 실패"
fi

# WM-003: 작업 상세 조회
echo ""
echo "2. WM-003: 작업 상세 조회"
RESULT=$(curl -s -X POST http://localhost:3000/api/customer/work/getWorkReceiptList \
  -H "Content-Type: application/json" \
  -d '{"WORK_DRCTN_NO":"WD202501280001"}')

if [ $? -eq 0 ]; then
  echo "✅ 성공"
else
  echo "❌ 실패"
fi

# WM-011: 장비구성정보 조회
echo ""
echo "3. WM-011: 장비구성정보 조회"
RESULT=$(curl -s -X POST http://localhost:3000/api/customer/work/getCustProdInfo \
  -H "Content-Type: application/json" \
  -d '{"CNTR_ID":"CNTR123456"}')

if [ $? -eq 0 ]; then
  echo "✅ 성공: $(echo $RESULT | jq 'length') 개 장비"
else
  echo "❌ 실패"
fi

echo ""
echo "✅ 작업관리 테스트 완료"
```

---

## 출력 형식

```
🧪 테스트: WM-001 작업 목록 조회

✅ 1. API 테스트
- Endpoint: /customer/work/getWorkdrctnList
- Method: POST
- Parameters: {
    WRKR_ID: "TEST_USER",
    WORK_DT_FROM: "20250101",
    WORK_DT_TO: "20250131"
  }
- Response: 10건
- Status: ✅ 성공 (200 OK, 1,234ms)

✅ 2. UI 테스트
- 컴포넌트: WorkOrderList.tsx (500줄)
- 경로: mobile-cona-front/components/WorkOrderList.tsx
- 상태:
  - 로딩: ✅ 정상 (스피너 표시)
  - 데이터 표시: ✅ 정상 (10건 렌더링)
  - 필터링: ✅ 정상 (날짜/상태)
  - 클릭 이벤트: ✅ 정상 (상세 화면 이동)

✅ 3. 검증 결과
- 응답 시간: 1,234ms
- 필드 개수: 15개
- 필수 필드: ✅ 모두 존재
- 에러 케이스: ✅ 처리됨

📋 종합 평가: ✅ 통과
```

---

## 주의사항

- 실제 Legacy 서버 다운 시 Demo Mode 사용
- LGU+ API는 실제 환경에서만 테스트 가능
- 작업 완료 처리는 테스트 데이터로만 진행
- 서명/사진은 실제 디바이스에서만 테스트
- 망정보 등록은 신중하게 (실제 DB 변경됨)
