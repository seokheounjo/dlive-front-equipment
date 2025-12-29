# Detailed API Test
Write-Host "=== Detailed API Test ===" -ForegroundColor Cyan

# Login
$loginBody = @{ USR_ID = "A20117965"; USR_PW = "dlive12!@#" } | ConvertTo-Json
$loginResult = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/login' -Method Post -ContentType 'application/json' -Body $loginBody -SessionVariable session
Write-Host "Login OK!" -ForegroundColor Green

# Test getWrkrHaveEqtList_All with detail
Write-Host "`n=== getWrkrHaveEqtList_All Detail ===" -ForegroundColor Yellow
$body = @{ WRKR_ID = "A20117965"; CRR_ID = "A20117965" } | ConvertTo-Json
$result = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/equipment/getWrkrHaveEqtList_All' -Method Post -ContentType 'application/json' -Body $body -WebSession $session

Write-Host "   data count: $($result.data.Count)"
Write-Host "   debugLogs count: $($result.debugLogs.Count)"

if ($result.data.Count -gt 0) {
    Write-Host "`n   === Data Sample (First 3) ===" -ForegroundColor Green
    $result.data | Select-Object -First 3 | ForEach-Object {
        Write-Host "   S/N: $($_.EQT_SERNO), Model: $($_.EQT_CL_NM), Status: $($_.EQT_STAT_CD)"
    }
} else {
    Write-Host "   No data returned" -ForegroundColor Red
}

# Show debugLogs
if ($result.debugLogs.Count -gt 0) {
    Write-Host "`n   === Debug Logs (Last 10) ===" -ForegroundColor Magenta
    $result.debugLogs | Select-Object -Last 10 | ForEach-Object {
        Write-Host "   $_"
    }
}

Write-Host "`n=== Complete ===" -ForegroundColor Cyan
