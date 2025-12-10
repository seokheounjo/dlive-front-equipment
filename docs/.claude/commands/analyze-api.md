---
description: 레거시 API 엔드포인트 분석 및 Frontend 연동 방법 출력
---

# API 분석 및 연동 가이드

사용자가 제공한 API 경로를 분석하고, Frontend에서 연동하는 방법을 단계별로 안내합니다.

## 작업 순서

1. **Legacy Server 확인**
   - 파일: `legacy-server/src/com/cona/customer/equipment/web/EquipmentManagerDelegate.java`
   - 또는: `legacy-server/src/com/cona/customer/work/web/WorkmanAssignManagementDelegate.java`
   - 메소드 시그니처 확인 (VariableList, DataSetList 파라미터)

2. **iBATIS SQL 맵 확인**
   - 파일: `legacy-server/src/com/cona/customer/equipment/dao/sqlmaps/maps/equipment-manager.xml`
   - 또는: `legacy-server/src/com/cona/customer/work/dao/sqlmaps/maps/workman-assign-manager.xml`
   - SQL ID, 파라미터 필드명, 응답 필드 목록 확인

3. **Adapter 라우팅 코드 생성**
   - 파일: `adapter-build-deploy/common-src/src/com/company/api/controller/WorkApiController.java`
   - Java 6 호환 코드 생성 (Generic 사용 불가)
   - JSON → MiPlatform → JSON 변환 로직

4. **Frontend API 함수 생성**
   - 파일: `mobile-cona-front/services/apiService.ts`
   - TypeScript 인터페이스 정의
   - Circuit Breaker 패턴 적용
   - Request Deduplication 적용

5. **컴포넌트 연동 예시**
   - 해당 React 컴포넌트에서 사용 방법
   - 로딩 상태, 에러 처리 패턴

## 출력 형식

사용자가 API 경로를 제공하면, 다음 정보를 출력:

```
📋 API: <API_경로>

✅ 1단계: Legacy Server 메소드
- 파일: <경로>
- 메소드명: <메소드명>
- Input Dataset: ds_input
- Output Dataset: ds_output

✅ 2단계: iBATIS SQL
- SQL ID: <SQL_ID>
- 파라미터:
  - <PARAM1>: <타입> (<설명>)
  - <PARAM2>: <타입> (<설명>)
- 응답 필드:
  - <FIELD1>: <타입> (<설명>)
  - <FIELD2>: <타입> (<설명>)

✅ 3단계: Adapter 코드 (Java 6)
```java
// WorkApiController.java에 추가
else if (uri.endsWith("/<API_경로>")) {
    handle<메소드명>(request, response);
}

private void handle<메소드명>(HttpServletRequest request, HttpServletResponse response) {
    // ... 구현 코드
}
```

✅ 4단계: Frontend API 함수
```typescript
// apiService.ts에 추가
export const <함수명> = async (params: {
  <PARAM1>?: string;
  <PARAM2>?: string;
}): Promise<<응답타입>[]> => {
  // ... 구현 코드
};
```

✅ 5단계: 컴포넌트 사용 예시
```typescript
const handleSearch = async () => {
  setIsLoading(true);
  try {
    const result = await <함수명>({ ... });
    setData(result);
  } catch (error) {
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
};
```

## 주의사항

- Java 6 제약사항 준수 (Generic 불가)
- EUC-KR 인코딩 유지
- iBATIS 2.x 문법 사용 (MyBatis 3.x 아님)
- Circuit Breaker 패턴 적용
- 에러 처리 반드시 포함
```

## 예시

사용자 입력: `/customer/equipment/getEquipmentOutList`

위 형식에 맞춰 분석 결과 출력
