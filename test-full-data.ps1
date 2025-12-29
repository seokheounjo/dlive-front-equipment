# Full Data Test - Show actual returned data
Write-Host "=== Full Data API Test ===" -ForegroundColor Cyan

# Login
$loginBody = @{ USR_ID = "A20117965"; USR_PW = "dlive12!@#" } | ConvertTo-Json
$loginResult = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/login' -Method Post -ContentType 'application/json' -Body $loginBody -SessionVariable session
Write-Host "Login OK!" -ForegroundColor Green

# Test 1: getCustProdInfo - ALL outputs
Write-Host "`n=== getCustProdInfo - All Outputs ===" -ForegroundColor Yellow
$body1 = @{ WRKR_ID = "A20117965"; CRR_TSK_CL = "01"; EQT_SEL = "0"; EQT_CL = "ALL" } | ConvertTo-Json
$r1 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getCustProdInfo' -Method Post -ContentType 'application/json' -Body $body1 -WebSession $session

Write-Host "   output1 (Promotion): $($r1.output1.Count)"
Write-Host "   output2 (Contract): $($r1.output2.Count)"
Write-Host "   output3 (Technician): $($r1.output3.Count)" -ForegroundColor Green
Write-Host "   output4 (Customer): $($r1.output4.Count)"
Write-Host "   output5 (Removed): $($r1.output5.Count)"

# Show output3 details if exists
if ($r1.output3.Count -gt 0) {
    Write-Host "`n   === output3 Details ===" -ForegroundColor Green
    $r1.output3 | ForEach-Object {
        Write-Host "   S/N: $($_.EQT_SERNO), Model: $($_.EQT_CL_NM), Status: $($_.EQT_STAT_CD), Loc: $($_.EQT_LOC_TP_CD)"
    }
}

# Show output2 details if exists
if ($r1.output2.Count -gt 0) {
    Write-Host "`n   === output2 Details (First 5) ===" -ForegroundColor Cyan
    $r1.output2 | Select-Object -First 5 | ForEach-Object {
        Write-Host "   S/N: $($_.EQT_SERNO), Model: $($_.EQT_CL_NM)"
    }
}

# Test 2: getEquipmentChkStndByA_All details
Write-Host "`n=== getEquipmentChkStndByA_All Details ===" -ForegroundColor Yellow
$body2 = @{ WRKR_ID = "A20117965" } | ConvertTo-Json
$r2 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/equipment/getEquipmentChkStndByA_All' -Method Post -ContentType 'application/json' -Body $body2 -WebSession $session

if ($r2.data.Count -gt 0) {
    $r2.data | ForEach-Object {
        Write-Host "   S/N: $($_.EQT_SERNO), Model: $($_.EQT_CL_NM), Status: $($_.EQT_STAT_CD)"
    }
} else {
    Write-Host "   No data"
}

# Test 3: Total Equipment Summary
Write-Host "`n=== Equipment Summary ===" -ForegroundColor Cyan
$total = $r1.output2.Count + $r1.output3.Count + $r1.output4.Count
Write-Host "   Total from getCustProdInfo: $total"
Write-Host "   - output2 (Contract): $($r1.output2.Count)"
Write-Host "   - output3 (Technician): $($r1.output3.Count)"
Write-Host "   - output4 (Customer): $($r1.output4.Count)"

Write-Host "`n=== Complete ===" -ForegroundColor Cyan
