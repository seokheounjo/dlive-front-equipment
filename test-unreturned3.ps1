# Unreturned Equipment Detail Test
Write-Host "=== Unreturned Equipment Detail Test ===" -ForegroundColor Cyan

# Login
$loginBody = @{ USR_ID = "A20117965"; USR_PW = "dlive12!@#" } | ConvertTo-Json
$loginResult = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/login' -Method Post -ContentType 'application/json' -Body $loginBody -SessionVariable session
Write-Host "Login OK!" -ForegroundColor Green

# Test S/N search with detail output
Write-Host "`n=== S/N Search Detail ===" -ForegroundColor Yellow
$body = @{ EQT_SERNO = "S81Q444902" } | ConvertTo-Json
try {
    $r = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getEquipLossInfo' -Method Post -ContentType 'application/json' -Body $body -WebSession $session

    Write-Host "   Response type: $($r.GetType().Name)"

    if ($r.data) {
        Write-Host "   data count: $($r.data.Count)" -ForegroundColor Green
        if ($r.data.Count -gt 0) {
            Write-Host "`n   === Data Items ===" -ForegroundColor Cyan
            $r.data | ForEach-Object {
                Write-Host "   S/N: $($_.EQT_SERNO)"
                Write-Host "   EQT_NO: $($_.EQT_NO)"
                Write-Host "   CUST_NM: $($_.CUST_NM)"
                Write-Host "   EQT_NM: $($_.EQT_NM)"
                Write-Host "   LOSS_AMT: $($_.LOSS_AMT)"
                Write-Host "   LOSS_STAT: $($_.LOSS_STAT)"
                Write-Host "   ---"
            }
        } else {
            Write-Host "   Equipment NOT in unreturned list (data is empty)" -ForegroundColor Yellow
        }
    }

    if ($r.debugLogs) {
        Write-Host "`n   === Debug Logs (Last 5) ===" -ForegroundColor Magenta
        $r.debugLogs | Select-Object -Last 5 | ForEach-Object {
            Write-Host "   $_"
        }
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test another S/N
Write-Host "`n=== Test S81Q889679 ===" -ForegroundColor Yellow
$body2 = @{ EQT_SERNO = "S81Q889679" } | ConvertTo-Json
try {
    $r2 = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getEquipLossInfo' -Method Post -ContentType 'application/json' -Body $body2 -WebSession $session
    Write-Host "   data count: $($r2.data.Count)"
    if ($r2.data.Count -eq 0) {
        Write-Host "   This equipment is NOT unreturned" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Complete ===" -ForegroundColor Cyan
