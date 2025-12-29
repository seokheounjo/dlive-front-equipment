# Unreturned Equipment API Test
Write-Host "=== Unreturned Equipment API Test ===" -ForegroundColor Cyan

# Login
$loginBody = @{ USR_ID = "A20117965"; USR_PW = "dlive12!@#" } | ConvertTo-Json
$loginResult = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/login' -Method Post -ContentType 'application/json' -Body $loginBody -SessionVariable session
Write-Host "Login OK!" -ForegroundColor Green

# Test 1: Search by date range (last 3 months)
Write-Host "`n=== Test 1: Date Range Search ===" -ForegroundColor Yellow
$fromDt = (Get-Date).AddMonths(-3).ToString("yyyyMMdd")
$toDt = (Get-Date).ToString("yyyyMMdd")
$body1 = @{ FROM_DT = $fromDt; TO_DT = $toDt } | ConvertTo-Json
try {
    $r1 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/equipment/getUnreturnedEquipmentList' -Method Post -ContentType 'application/json' -Body $body1 -WebSession $session
    Write-Host "   Result count: $($r1.Count)" -ForegroundColor Green
    if ($r1.Count -gt 0) {
        Write-Host "   First item: S/N=$($r1[0].EQT_SERNO), CUST_NM=$($r1[0].CUST_NM)"
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Search by S/N (barcode) - using a known S/N from previous tests
Write-Host "`n=== Test 2: S/N (Barcode) Search ===" -ForegroundColor Yellow
$body2 = @{ EQT_SERNO = "S81Q444902" } | ConvertTo-Json
try {
    $r2 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/equipment/getUnreturnedEquipmentList' -Method Post -ContentType 'application/json' -Body $body2 -WebSession $session
    Write-Host "   Result count: $($r2.Count)" -ForegroundColor Green
    if ($r2.Count -gt 0) {
        $r2 | ForEach-Object {
            Write-Host "   S/N: $($_.EQT_SERNO), Status: $($_.RETN_REQ_YN), CUST: $($_.CUST_NM)"
        }
    } else {
        Write-Host "   This equipment is NOT unreturned (or does not exist)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Search another S/N
Write-Host "`n=== Test 3: Another S/N Search ===" -ForegroundColor Yellow
$body3 = @{ EQT_SERNO = "S81Q889679" } | ConvertTo-Json
try {
    $r3 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/equipment/getUnreturnedEquipmentList' -Method Post -ContentType 'application/json' -Body $body3 -WebSession $session
    Write-Host "   Result count: $($r3.Count)" -ForegroundColor Green
    if ($r3.Count -gt 0) {
        $r3 | ForEach-Object {
            Write-Host "   S/N: $($_.EQT_SERNO), Status: $($_.RETN_REQ_YN), CUST: $($_.CUST_NM)"
        }
    } else {
        Write-Host "   This equipment is NOT unreturned" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Complete ===" -ForegroundColor Cyan
