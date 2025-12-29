# Unreturned Equipment API Test (Correct Endpoint)
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
    $r1 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getEquipLossInfo' -Method Post -ContentType 'application/json' -Body $body1 -WebSession $session
    if ($r1 -is [array]) {
        Write-Host "   Result count: $($r1.Count)" -ForegroundColor Green
        if ($r1.Count -gt 0) {
            Write-Host "   First item: S/N=$($r1[0].EQT_SERNO), CUST=$($r1[0].CUST_NM)"
        }
    } elseif ($r1.output1) {
        Write-Host "   output1 count: $($r1.output1.Count)" -ForegroundColor Green
        if ($r1.output1.Count -gt 0) {
            Write-Host "   First: S/N=$($r1.output1[0].EQT_SERNO)"
        }
    } else {
        Write-Host "   Result: $r1" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Search by S/N (barcode)
Write-Host "`n=== Test 2: S/N (Barcode) Search ===" -ForegroundColor Yellow
$body2 = @{ EQT_SERNO = "S81Q444902" } | ConvertTo-Json
try {
    $r2 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getEquipLossInfo' -Method Post -ContentType 'application/json' -Body $body2 -WebSession $session
    if ($r2 -is [array]) {
        Write-Host "   Result count: $($r2.Count)" -ForegroundColor Green
    } elseif ($r2.output1) {
        Write-Host "   output1 count: $($r2.output1.Count)" -ForegroundColor Green
    } else {
        Write-Host "   Result: $r2" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Complete ===" -ForegroundColor Cyan
