# getCustProdInfo API 테스트 스크립트
# 작업관리에서 82개 장비 조회하는 API

Write-Host "=== getCustProdInfo API 테스트 ===" -ForegroundColor Cyan

# 1. 로그인
Write-Host "`n1. 로그인 중..." -ForegroundColor Yellow
try {
    $loginBody = @{
        USR_ID = "A20117965"
        USR_PW = "dlive12!@#"
    } | ConvertTo-Json

    $loginResult = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/login' `
        -Method Post `
        -ContentType 'application/json' `
        -Body $loginBody `
        -SessionVariable session

    Write-Host "   로그인 성공!" -ForegroundColor Green
} catch {
    Write-Host "   로그인 실패: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. getCustProdInfo API 호출
Write-Host "`n2. getCustProdInfo API 호출 중..." -ForegroundColor Yellow
try {
    $apiBody = @{
        WRKR_ID = "A20117965"
        CRR_TSK_CL = "01"
        EQT_SEL = "0"
        EQT_CL = "ALL"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri 'http://52.63.232.141:8080/api/customer/work/getCustProdInfo' `
        -Method Post `
        -ContentType 'application/json' `
        -Body $apiBody `
        -WebSession $session

    Write-Host "   API 호출 성공!" -ForegroundColor Green

    # 결과 출력
    Write-Host "`n=== 응답 결과 ===" -ForegroundColor Cyan
    Write-Host "   output1 (프로모션): $($result.output1.Count) 개"
    Write-Host "   output2 (계약장비): $($result.output2.Count) 개"
    Write-Host "   output3 (기사장비): $($result.output3.Count) 개" -ForegroundColor Green
    Write-Host "   output4 (고객장비): $($result.output4.Count) 개"
    Write-Host "   output5 (회수장비): $($result.output5.Count) 개"

    # output3 샘플 데이터 출력
    if ($result.output3.Count -gt 0) {
        Write-Host "`n=== output3 (기사장비) 샘플 3건 ===" -ForegroundColor Cyan
        $result.output3 | Select-Object -First 3 | ForEach-Object {
            Write-Host "   S/N: $($_.EQT_SERNO), 품목: $($_.ITEM_MID_NM), 모델: $($_.EQT_CL_NM)"
        }
    }

} catch {
    Write-Host "   API 호출 실패: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== 테스트 완료 ===" -ForegroundColor Cyan
