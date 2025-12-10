---
description: 장비관리 기능 테스트 시나리오 실행 및 검증
---

# 장비관리 기능 테스트

장비관리 파트의 특정 기능을 테스트하고 결과를 검증합니다.

## 테스트 대상 기능

1. **EM-010: 장비 이력 조회** (✅ 완료)
2. **EM-004: 기사 보유장비 조회** (🔄 진행중)
3. **EM-011: 장비 작업자 이관** (🔄 계획)
4. **EM-015: 미회수 장비 조회** (🔄 진행중)

## 작업 순서

1. **로컬 환경 확인**
   ```bash
   # Frontend 개발 서버 실행 확인
   ps aux | grep "vite"

   # API 프록시 서버 실행 확인
   ps aux | grep "api-proxy"

   # 실행 안 되어 있으면 시작
   cd mobile-cona-front
   npm run dev &
   node api-proxy.js &
   ```

2. **Demo Mode 설정**
   ```javascript
   // 브라우저 Console에서 실행
   localStorage.setItem('demoMode', 'true');

   // 사용자 정보 설정
   localStorage.setItem('userInfo', JSON.stringify({
     USR_ID: 'TEST_USER',
     USR_NM: '테스트기사',
     SO_ID: 'SO001',
     SO_NM: '서울지점'
   }));

   location.reload();
   ```

3. **기능별 테스트**

   ### EM-010: 장비 이력 조회
   ```bash
   # API 테스트
   curl -X POST http://localhost:3000/api/statistics/equipment/getEquipmentHistoryInfo \
     -H "Content-Type: application/json" \
     -d '{"EQT_SERNO":"AB123456"}'
   ```

   **예상 결과**:
   - ✅ HTTP 200 응답
   - ✅ JSON 배열 반환 (75개 필드)
   - ✅ SO_NM, EQT_MDL_NM, EQT_STS_NM 포함

   **UI 테스트**:
   1. http://localhost:3000 접속
   2. 장비관리 메뉴 클릭
   3. "장비상태조회" 탭 선택
   4. S/N: AB123456 입력
   5. "조회" 버튼 클릭
   6. 장비 정보 75개 필드 표시 확인

   ### EM-004: 기사 보유장비 조회
   ```bash
   # API 테스트 (구현 후)
   curl -X POST http://localhost:3000/api/customer/equipment/getEquipmentOutList \
     -H "Content-Type: application/json" \
     -d '{"OUT_DT":"20250128","SO_ID":"SO001"}'
   ```

   **예상 결과**:
   - ✅ HTTP 200 응답
   - ✅ 출고 리스트 배열 반환
   - ✅ OUT_REQ_NO, CORP_NM, REMAIN_QTY 포함

   **UI 테스트**:
   1. 장비관리 > "장비할당/반납" 탭
   2. 출고일자 선택: 2025-01-28
   3. "조회" 버튼 클릭
   4. 파트너사별 출고 현황 표시 확인

   ### EM-015: 미회수 장비 조회
   ```bash
   # API 테스트 (구현 후)
   curl -X POST http://localhost:3000/api/customer/work/getEquipLossInfo \
     -H "Content-Type: application/json" \
     -d '{"SO_ID":"SO001","EQT_SERNO":"AB123456"}'
   ```

   **예상 결과**:
   - ✅ HTTP 200 응답
   - ✅ 미회수 장비 배열 반환
   - ✅ CUST_NM, ADDR, UNRETURNED_DAYS 포함

4. **에러 케이스 테스트**

   ```bash
   # 잘못된 파라미터
   curl -X POST http://localhost:3000/api/statistics/equipment/getEquipmentHistoryInfo \
     -H "Content-Type: application/json" \
     -d '{}'

   # 예상: 에러 메시지 또는 빈 배열
   ```

5. **성능 테스트**

   ```bash
   # 응답 시간 측정
   time curl -X POST http://localhost:3000/api/statistics/equipment/getEquipmentHistoryInfo \
     -H "Content-Type: application/json" \
     -d '{"EQT_SERNO":"AB123456"}'

   # 예상: 2초 이내 응답
   ```

## 테스트 체크리스트

사용자가 특정 기능을 지정하면, 다음 항목을 순서대로 검증:

- [ ] API 엔드포인트 응답 (200 OK)
- [ ] 응답 데이터 형식 (JSON 배열/객체)
- [ ] 필수 필드 존재 여부
- [ ] 로딩 스피너 표시
- [ ] 에러 메시지 표시 (에러 발생 시)
- [ ] 데이터 정상 렌더링
- [ ] 빈 결과 처리
- [ ] 입력 검증 (필수 파라미터)

## 출력 형식

```
🧪 테스트: <기능명>

✅ 1. API 테스트
- Endpoint: <경로>
- Method: POST
- Parameters: { ... }
- Response: <결과>
- Status: ✅ 성공 / ❌ 실패

✅ 2. UI 테스트
- 컴포넌트: <컴포넌트명>
- 경로: <파일경로>
- 상태:
  - 로딩: ✅ 정상
  - 에러 처리: ✅ 정상
  - 데이터 표시: ✅ 정상

✅ 3. 검증 결과
- 응답 시간: <ms>
- 필드 개수: <개수>
- 에러 케이스: ✅ 처리됨

📋 종합 평가: ✅ 통과 / ⚠️ 부분 통과 / ❌ 실패
```

## 자동화 스크립트 (선택)

```bash
#!/bin/bash
# test-equipment.sh

echo "🧪 장비관리 기능 테스트 시작..."

# EM-010 테스트
echo "1. EM-010: 장비 이력 조회"
RESULT=$(curl -s -X POST http://localhost:3000/api/statistics/equipment/getEquipmentHistoryInfo \
  -H "Content-Type: application/json" \
  -d '{"EQT_SERNO":"AB123456"}')

if [ $? -eq 0 ]; then
  echo "✅ 성공"
else
  echo "❌ 실패"
fi

# EM-004 테스트 (구현 후)
# ...

echo "✅ 테스트 완료"
```

## 주의사항

- 실제 Legacy 서버가 다운되어 있으면 Demo Mode 사용
- EC2 테스트는 배포 후에만 가능
- 네트워크 에러는 API 프록시 서버 재시작으로 해결
