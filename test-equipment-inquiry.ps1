# Test EquipmentInquiry - Simulating Frontend Behavior
Write-Host "=== EquipmentInquiry Simulation Test ===" -ForegroundColor Cyan

# Login
$loginBody = @{ USR_ID = "A20117965"; USR_PW = "dlive12!@#" } | ConvertTo-Json
$loginResult = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/login' -Method Post -ContentType 'application/json' -Body $loginBody -SessionVariable session
Write-Host "Login OK!" -ForegroundColor Green

# Test 1: "보유" checked - getCustProdInfo (output3)
Write-Host "`n=== Test 1: 보유장비 조회 (getCustProdInfo) ===" -ForegroundColor Yellow
$body1 = @{
    WRKR_ID = "A20117965"
    CRR_TSK_CL = "01"
    EQT_SEL = "0"
    EQT_CL = "ALL"
} | ConvertTo-Json
$r1 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getCustProdInfo' -Method Post -ContentType 'application/json' -Body $body1 -WebSession $session

$ownedCount = $r1.output3.Count
Write-Host "   보유장비 (output3): $ownedCount 건" -ForegroundColor $(if($ownedCount -gt 0){"Green"}else{"Red"})
if ($ownedCount -gt 0) {
    $r1.output3 | ForEach-Object {
        Write-Host "   - S/N: $($_.EQT_SERNO), Model: $($_.EQT_CL_NM), Loc: $($_.EQT_LOC_TP_CD)"
    }
}

# Test 2: "검사대기" checked - getEquipmentChkStndByA_All
Write-Host "`n=== Test 2: 검사대기 조회 ===" -ForegroundColor Yellow
$body2 = @{ WRKR_ID = "A20117965" } | ConvertTo-Json
$r2 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/equipment/getEquipmentChkStndByA_All' -Method Post -ContentType 'application/json' -Body $body2 -WebSession $session

$inspectionCount = if($r2.data) { $r2.data.Count } else { 0 }
Write-Host "   검사대기: $inspectionCount 건" -ForegroundColor $(if($inspectionCount -gt 0){"Green"}else{"Yellow"})
if ($inspectionCount -gt 0) {
    $r2.data | ForEach-Object {
        Write-Host "   - S/N: $($_.EQT_SERNO), Model: $($_.EQT_CL_NM)"
    }
}

# Test 3: S/N Filter Test (should find in owned list)
Write-Host "`n=== Test 3: S/N Filter Test ===" -ForegroundColor Yellow
$testSN = "S81Q444902"
$filtered = $r1.output3 | Where-Object { $_.EQT_SERNO -like "*$testSN*" }
Write-Host "   S/N '$testSN' in 보유장비: $($filtered.Count) 건" -ForegroundColor $(if($filtered.Count -gt 0){"Green"}else{"Red"})

# Test 4: S/N that is NOT in owned list
$testSN2 = "705KVQS022868"
$filtered2 = $r1.output3 | Where-Object { $_.EQT_SERNO -like "*$testSN2*" }
Write-Host "   S/N '$testSN2' in 보유장비: $($filtered2.Count) 건 (should be 0)" -ForegroundColor $(if($filtered2.Count -eq 0){"Green"}else{"Red"})

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "   Total when '보유' checked: $ownedCount" -ForegroundColor White
Write-Host "   Total when '검사대기' checked: $inspectionCount" -ForegroundColor White
Write-Host "   Total when both checked: $($ownedCount + $inspectionCount)" -ForegroundColor White

Write-Host "`n=== Expected Behavior ===" -ForegroundColor Cyan
Write-Host "   장비처리 > 보유 체크 > 조회 = $ownedCount 건 표시" -ForegroundColor Green
Write-Host "   장비처리 > S/N '705KVQS022868' 입력 > 조회 = 0건 (보유장비 아님)" -ForegroundColor Green

Write-Host "`n=== Complete ===" -ForegroundColor Cyan
