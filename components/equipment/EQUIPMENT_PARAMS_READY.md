# 장비처리 API 파라미터 준비

## 탭별 필수 파라미터

### 1. 보유장비 (OWNED)
```json
{
  "WRKR_ID": "A20117965",        // 로그인 사용자 ID (필수)
  "SO_ID": "402",                // 지점 ID (선택)
  "EQT_STAT_CD": "10",           // 장비상태: 양호 (고정)
  "EQT_LOC_TP_CD": "3",          // 장비위치: 작업기사 (고정)
  "ITEM_MID_CD": "",             // 장비종류 (선택)
  "EQT_SERNO": ""                // S/N 검색 (선택) - 보유장비만!
}
```

### 2. 반납요청 (RETURN_REQUESTED)
```json
{
  "WRKR_ID": "A20117965",        // 로그인 사용자 ID (필수)
  "SO_ID": "402",                // 지점 ID (선택)
  "EQT_STAT_CD": "40",           // 장비상태: 반납요청 (고정)
  "ITEM_MID_CD": ""              // 장비종류 (선택)
}
```
**주의**: S/N 검색 불가 (보유장비 아님)

### 3. 검사대기 (INSPECTION_WAITING)
```json
{
  "WRKR_ID": "A20117965",        // 로그인 사용자 ID (필수)
  "SO_ID": "402",                // 지점 ID (선택)
  "EQT_STAT_CD": "50",           // 장비상태: 검사대기 (고정)
  "ITEM_MID_CD": ""              // 장비종류 (선택)
}
```
**주의**: S/N 검색 불가 (보유장비 아님)

---

## 새 API 연동 준비사항

### 기대하는 새 API 형식
```
POST /api/customer/equipment/getWrkrHaveEqtListFull
```

### 예상 파라미터
```json
{
  "WRKR_ID": "A20117965",
  "SO_ID": "402",
  "EQT_STAT_CD": "10,40,50",     // 복수 상태 지원?
  "EQT_LOC_TP_CD": "1,2,3,4",    // 복수 위치 지원?
  "EQT_SERNO": "D1602A002249"    // S/N 검색
}
```

### 코드 수정 위치
- `EquipmentInquiry.tsx` line 256-330: handleSearch() 함수
- S/N 검색 시 탭 조건 추가 필요

---

## 코드 변경 계획

### 1. S/N 검색 제한 (보유장비만)
```typescript
// line 256 수정
if (eqtSerno && eqtSerno.trim().length > 0) {
  // 보유장비 탭이 아니면 S/N 검색 불가
  if (searchCondition !== 'OWNED') {
    showToast?.('S/N 검색은 보유장비 탭에서만 가능합니다.', 'warning');
    setIsLoading(false);
    return;
  }
  // ... 기존 코드
}
```

### 2. 새 API 연동 (API 제공 시)
```typescript
// 새 API 호출
const result = await apiRequest('/customer/equipment/getWrkrHaveEqtListFull', 'POST', {
  WRKR_ID: userInfo.userId,
  SO_ID: selectedSoId,
  EQT_STAT_CD: getStatCodeByCondition(searchCondition),
  EQT_LOC_TP_CD: getLocCodeByCondition(searchCondition),
  EQT_SERNO: eqtSerno
});
```

### 3. 조회 버튼 UI 변경
- 현재: 조회 버튼 (전체 너비)
- 변경: 조회 버튼 (50%) + 바코드 버튼 (50%)

---

## 바코드 스캐너 구현 계획

### 라이브러리: html5-qrcode

### 설치
```bash
npm install html5-qrcode
```

### 컴포넌트 구조
```tsx
// BarcodeScanner.tsx
import { Html5QrcodeScanner } from 'html5-qrcode';

const BarcodeScanner = ({ onScan, onClose }) => {
  // 카메라 스캔 UI
  // 스캔 성공 시 onScan(barcode) 호출
};
```

### UI 변경
```tsx
{/* 조회 + 바코드 버튼 */}
<div className="flex gap-2 mt-4">
  <button onClick={handleSearch} className="flex-1 ...">
    조회
  </button>
  <button onClick={() => setShowScanner(true)} className="flex-1 ...">
    <BarcodeIcon /> 바코드
  </button>
</div>
```
