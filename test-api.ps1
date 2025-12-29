# getCustProdInfo API Test Script
Write-Host "=== getCustProdInfo API Test ===" -ForegroundColor Cyan

# 1. Login
Write-Host "1. Login..." -ForegroundColor Yellow
try {
    $loginBody = @{
        USR_ID = "A20117965"
        USR_PW = "dlive12!@#"
    } | ConvertTo-Json

    $loginResult = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/login' -Method Post -ContentType 'application/json' -Body $loginBody -SessionVariable session
    Write-Host "   Login OK!" -ForegroundColor Green
} catch {
    Write-Host "   Login FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Call getCustProdInfo API
Write-Host "2. Calling getCustProdInfo API..." -ForegroundColor Yellow
try {
    $apiBody = @{
        WRKR_ID = "A20117965"
        CRR_TSK_CL = "01"
        EQT_SEL = "0"
        EQT_CL = "ALL"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getCustProdInfo' -Method Post -ContentType 'application/json' -Body $apiBody -WebSession $session
    Write-Host "   API Call OK!" -ForegroundColor Green

    # Print results
    Write-Host "=== Response Results ===" -ForegroundColor Cyan
    Write-Host "   output1 (Promotion): $($result.output1.Count)"
    Write-Host "   output2 (Contract): $($result.output2.Count)"
    Write-Host "   output3 (Technician): $($result.output3.Count)" -ForegroundColor Green
    Write-Host "   output4 (Customer): $($result.output4.Count)"
    Write-Host "   output5 (Removed): $($result.output5.Count)"

    # Sample data from output3
    if ($result.output3.Count -gt 0) {
        Write-Host "=== output3 Sample (First 3) ===" -ForegroundColor Cyan
        $result.output3 | Select-Object -First 3 | ForEach-Object {
            Write-Host "   S/N: $($_.EQT_SERNO), Item: $($_.ITEM_MID_NM), Model: $($_.EQT_CL_NM)"
        }
    }
} catch {
    Write-Host "   API Call FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "=== Test Complete ===" -ForegroundColor Cyan
