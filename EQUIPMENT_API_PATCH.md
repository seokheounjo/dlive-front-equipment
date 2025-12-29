# Equipment API Patch Instructions

## Test Results (2025-12-26)

| API | Result | Status |
|-----|--------|--------|
| `getCustProdInfo` (output3) | 1 item (S81Q444902) | WORKING |
| `getWrkrHaveEqtList_All` | 0 items | SQL FILTER ISSUE |
| `getEquipmentChkStndByA_All` | 1 item (S81Q889679) | WORKING |

## Changes Required for EquipmentInquiry.tsx

### 1. Add Import (after line 14)

```typescript
// getCustProdInfo API (tested: returns technician equipment)
import { getTechnicianEquipmentFromWork } from '../../services/equipmentWorkApi';
```

### 2. Replace OWNED equipment query (lines 318-341)

**BEFORE:**
```typescript
// 보유장비 체크 시 - getWrkrHaveEqtList_All API 사용
if (searchConditions.OWNED) {
  const ownedParams = {
    WRKR_ID: userInfo.userId,
    CRR_ID: userInfo.userId,
    SO_ID: selectedSoId || userInfo.soId || undefined,
    ITEM_MID_CD: selectedItemMidCd || undefined,
    EQT_CL_CD: selectedCategory || undefined,
  };
  try {
    const ownedResult = await debugApiCall(
      'EquipmentInquiry',
      'getWrkrHaveEqtListAll (보유)',
      () => getWrkrHaveEqtListAll(ownedParams),
      ownedParams
    );
    if (Array.isArray(ownedResult)) {
      allResults.push(...ownedResult.map(item => ({ ...item, _category: 'OWNED' })));
    }
  } catch (e) {
    console.log('보유장비 조회 실패:', e);
  }
}
```

**AFTER:**
```typescript
// 보유장비 체크 시 - getCustProdInfo API 사용 (테스트 완료)
if (searchConditions.OWNED) {
  try {
    const ownedResult = await debugApiCall(
      'EquipmentInquiry',
      'getTechnicianEquipmentFromWork (보유-getCustProdInfo)',
      () => getTechnicianEquipmentFromWork({
        WRKR_ID: userInfo.userId,
        SO_ID: selectedSoId || userInfo.soId || undefined,
        CRR_ID: userInfo.userId,
      }),
      { WRKR_ID: userInfo.userId }
    );
    if (Array.isArray(ownedResult)) {
      // ITEM_MID_CD 필터 적용 (프론트엔드에서)
      let filtered = ownedResult;
      if (selectedItemMidCd) {
        filtered = ownedResult.filter((item: any) => item.ITEM_MID_CD === selectedItemMidCd);
      }
      allResults.push(...filtered.map((item: any) => ({ ...item, _category: 'OWNED' })));
    }
  } catch (e) {
    console.log('보유장비 조회 실패 (getCustProdInfo):', e);
  }
}
```

## Why This Change?

1. `getWrkrHaveEqtList_All` returns 0 items due to hardcoded SQL filter: `EQT_USE_ARR_YN='Y'`
2. `getCustProdInfo` (output3) uses `workmanAssignDao.getWrkrEqtInfo()` which has NO filter
3. Test confirmed: getCustProdInfo returns 1 item, getWrkrHaveEqtList_All returns 0 items

## Created Files

- `frontend/services/equipmentWorkApi.ts` - New API service using getCustProdInfo
- `frontend/test-api.ps1` - API test script
- `frontend/test-compare.ps1` - API comparison test
- `frontend/test-detail.ps1` - Detailed API test
- `frontend/test-full-data.ps1` - Full data test
