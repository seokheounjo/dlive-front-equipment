# 완료된 작업 API 테스트 가이드

## 📋 방법 1: 스크립트 실행

### 1. 스크립트 파일 수정
`test_completed_work_api.sh` 파일을 열어서 다음 변수들을 실제 값으로 변경하세요:

```bash
WORK_ID="YOUR_COMPLETED_WORK_ID"    # 완료된 작업 ID
CTRT_ID="YOUR_CONTRACT_ID"          # 계약 ID
CUST_ID="YOUR_CUSTOMER_ID"          # 고객 ID
SO_ID="YOUR_SO_ID"                  # 지점 ID
PROD_CD="YOUR_PROD_CD"              # 상품 코드
```

### 2. 스크립트 실행
```bash
cd /Users/hanseungsu/Desktop/poby/딜라이브/dlive-json-api/mobile-cona-front
./test_completed_work_api.sh
```

---

## 📋 방법 2: 직접 curl 명령어 실행

### 기본 템플릿 (EC2 서버)
```bash
curl -X POST 'http://52.63.131.157/api/customer/work/getCustProdInfo' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://52.63.131.157' \
  --cookie-jar cookies.txt \
  --cookie cookies.txt \
  -d '{
    "WRKR_ID": "A20130708",
    "SO_ID": "YOUR_SO_ID",
    "WORK_ID": "YOUR_COMPLETED_WORK_ID",
    "CUST_ID": "YOUR_CUSTOMER_ID",
    "CTRT_ID": "YOUR_CONTRACT_ID",
    "WRK_CD": "01",
    "WRK_STAT_CD": "4",
    "PROD_CD": "YOUR_PROD_CD",
    "EQT_SEL": "0",
    "EQT_CL": "ALL"
  }' | jq '.'
```

### 예시 (실제 데이터로 변경 필요)
```bash
curl -X POST 'http://52.63.131.157/api/customer/work/getCustProdInfo' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://52.63.131.157' \
  -d '{
    "WRKR_ID": "A20130708",
    "SO_ID": "S001",
    "WORK_ID": "W202501150001",
    "CUST_ID": "C001",
    "CTRT_ID": "CTRT001",
    "WRK_CD": "01",
    "WRK_STAT_CD": "4",
    "PROD_CD": "P001",
    "EQT_SEL": "0",
    "EQT_CL": "ALL"
  }' | jq '.'
```

---

## 🔍 확인할 항목

응답에서 다음 필드들이 있는지 확인:

### 1. 작업완료 기본 정보
- ✅ `CUST_REL` - 고객관계
- ✅ `INSTL_LOC` - 설치위치
- ✅ `UP_CTRL_CL` - 상향제어
- ✅ `MEMO` - 작업비고

### 2. 설치정보
- ✅ `installInfo` 객체
  - `NET_CL` - 망구분 코드
  - `NET_CL_NM` - 망구분 이름
  - `INSTL_TP` - 설치유형
  - `WRNG_TP` - 배선유형
  - 기타 설치정보 필드들...

### 3. 서비스 이용구분
- ✅ `INTERNET_USE` - 인터넷 이용
- ✅ `VOIP_USE` - VoIP 이용
- ✅ `DTV_USE` - 디지털방송 이용

### 4. 장비 정보 (이미 확인됨)
- ✅ `contractEquipments` (output2)
- ✅ `technicianEquipments` (output3)
- ✅ `customerEquipments` (output4) ← 이미 사용 중
- ✅ `removedEquipments` (output5)

---

## 📊 응답 예시 (예상)

### 만약 작업완료 정보가 포함되어 있다면:
```json
{
  "contractEquipments": [...],
  "technicianEquipments": [...],
  "customerEquipments": [...],
  "removedEquipments": [...],
  "kpiProdGrpCd": "V",
  "prodGrp": "V",
  "workCompleteInfo": {
    "CUST_REL": "10",
    "INSTL_LOC": "거실",
    "UP_CTRL_CL": "Y",
    "MEMO": "정상 설치 완료",
    "INTERNET_USE": "Y",
    "VOIP_USE": "N",
    "DTV_USE": "Y"
  },
  "installInfo": {
    "NET_CL": "01",
    "NET_CL_NM": "HFC",
    "INSTL_TP": "10",
    "WRNG_TP": "20",
    ...
  }
}
```

### 만약 작업완료 정보가 없다면:
```json
{
  "contractEquipments": [...],
  "technicianEquipments": [...],
  "customerEquipments": [...],
  "removedEquipments": [...],
  "kpiProdGrpCd": "V",
  "prodGrp": "V"
  // workCompleteInfo 없음
  // installInfo 없음
}
```

---

## 💡 다음 단계

### ✅ 작업완료 정보가 포함되어 있다면
→ **방법 1 진행**: `WorkCompleteForm`에서 `getTechnicianEquipments` API 응답 활용

### ❌ 작업완료 정보가 없다면
→ **방법 2 진행**: 별도 `getWorkCompleteInfo` API 구현 필요

---

## 🛠️ 브라우저 개발자 도구로 확인하기

1. 완료된 작업 상세 페이지 접속
2. F12 → Network 탭 열기
3. `/customer/work/getCustProdInfo` 요청 찾기
4. Response 탭에서 응답 데이터 확인

---

## 📝 테스트 결과 기록

테스트 후 이 섹션에 결과를 기록하세요:

```
테스트 일시:
작업 ID:
작업 상태: 완료 (WRK_STAT_CD=4)

결과:
[ ] workCompleteInfo 있음
[ ] installInfo 있음
[ ] CUST_REL 있음
[ ] NET_CL 있음
[ ] 서비스 이용구분 있음

결론:
[ ] 방법 1 진행 가능
[ ] 방법 2 필요
```
