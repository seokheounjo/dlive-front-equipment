# Compare APIs Test
Write-Host "=== API Comparison Test ===" -ForegroundColor Cyan

# Login
$loginBody = @{ USR_ID = "A20117965"; USR_PW = "dlive12!@#" } | ConvertTo-Json
$loginResult = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/login' -Method Post -ContentType 'application/json' -Body $loginBody -SessionVariable session
Write-Host "Login OK!" -ForegroundColor Green

# Test 1: getCustProdInfo
Write-Host "`n=== Test 1: getCustProdInfo ===" -ForegroundColor Yellow
$body1 = @{ WRKR_ID = "A20117965"; CRR_TSK_CL = "01"; EQT_SEL = "0"; EQT_CL = "ALL" } | ConvertTo-Json
$r1 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getCustProdInfo' -Method Post -ContentType 'application/json' -Body $body1 -WebSession $session
Write-Host "   output3 (Technician): $($r1.output3.Count)"

# Test 2: getWrkrHaveEqtList_All
Write-Host "`n=== Test 2: getWrkrHaveEqtList_All ===" -ForegroundColor Yellow
$body2 = @{ WRKR_ID = "A20117965"; CRR_ID = "A20117965" } | ConvertTo-Json
try {
    $r2 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/equipment/getWrkrHaveEqtList_All' -Method Post -ContentType 'application/json' -Body $body2 -WebSession $session
    if ($r2 -is [array]) {
        Write-Host "   Result (array): $($r2.Count)"
    } elseif ($r2.data) {
        Write-Host "   Result (data): $($r2.data.Count)"
    } else {
        Write-Host "   Result: $r2"
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: getEquipmentChkStndByA_All
Write-Host "`n=== Test 3: getEquipmentChkStndByA_All ===" -ForegroundColor Yellow
$body3 = @{ WRKR_ID = "A20117965" } | ConvertTo-Json
try {
    $r3 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/equipment/getEquipmentChkStndByA_All' -Method Post -ContentType 'application/json' -Body $body3 -WebSession $session
    if ($r3 -is [array]) {
        Write-Host "   Result (array): $($r3.Count)"
        if ($r3.Count -gt 0) {
            Write-Host "   Sample: S/N=$($r3[0].EQT_SERNO)"
        }
    } elseif ($r3.data) {
        Write-Host "   Result (data): $($r3.data.Count)"
    } else {
        Write-Host "   Result: $r3"
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Complete ===" -ForegroundColor Cyan
