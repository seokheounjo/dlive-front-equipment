# 📘 D-Live Equipment Management System - Complete Guide

> **목적**: 이 문서 하나로 새로운 Claude Code 인스턴스가 전체 프로젝트를 이해하고 즉시 작업 시작 가능
>
> **마지막 업데이트**: 2025-11-28
>
> **현재 진행상황**: Phase 1 장비관리 기능 구현 중

---

## 📑 목차

1. [시스템 아키텍처 개요](#시스템-아키텍처-개요)
2. [기술 스택 & 제약사항](#기술-스택--제약사항)
3. [프로젝트 구조](#프로젝트-구조)
4. [장비관리 기능 명세](#장비관리-기능-명세)
5. [API 연동 가이드](#api-연동-가이드)
6. [개발 워크플로우](#개발-워크플로우)
7. [배포 프로세스](#배포-프로세스)
8. [트러블슈팅](#트러블슈팅)

---

## 🏗️ 시스템 아키텍처 개요

### 3계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 19 + TypeScript)                           │
│  Port: 3000 (dev) / 80 (prod)                              │
│  Location: /mobile-cona-front                               │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP/JSON
                  │ (Express Proxy)
┌─────────────────▼───────────────────────────────────────────┐
│  Adapter (Java 6 + Spring 2.x)                              │
│  Port: 8080                                                 │
│  Function: JSON ↔ MiPlatform 변환                          │
│  Location: /adapter-build-deploy                            │
└─────────────────┬───────────────────────────────────────────┘
                  │ MiPlatform XML
                  │ (EUC-KR encoding)
┌─────────────────▼───────────────────────────────────────────┐
│  Legacy Server (Java 6 + iBATIS 2.x + Oracle)               │
│  Server: IBM WebSphere                                      │
│  Location: /legacy-server                                   │
│  IP: 58.143.140.222:8080                                    │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름 예시

```typescript
// Frontend Request
const result = await getEquipmentHistoryInfo({
  EQT_SERNO: 'AB123456',
  MAC_ADDRESS: '00:11:22:33:44:55'
});

// ↓ api-proxy.js (Express)
// POST /api/statistics/equipment/getEquipmentHistoryInfo
// → 58.143.140.222:8080/api/statistics/equipment/getEquipmentHistoryInfo

// ↓ Adapter (WorkApiController.java)
// JSON → MiPlatform Dataset 변환
// EUC-KR 인코딩 변환

// ↓ Legacy Server (EquipmentManagerDelegate.java)
// MiPlatform Dataset 파싱
// iBATIS SQL 실행 (equipment-manager.xml)

// ↓ Oracle Database
// SELECT * FROM TB_EQT_INFO WHERE EQT_SERNO = ?

// ← Response (역순)
// MiPlatform → JSON → React Component
```

---

## 🔧 기술 스택 & 제약사항

### Frontend Stack

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.1.1 | UI 프레임워크 |
| TypeScript | 5.8.2 | 타입 안전성 |
| Vite | 6.2.0 | 빌드 도구 |
| Tailwind CSS | 3.4.1 | 스타일링 |
| Express.js | 4.21.2 | API 프록시 서버 |
| PM2 | - | 프로덕션 프로세스 관리 |

**주요 디렉토리**:
```
mobile-cona-front/
├── components/          # React 컴포넌트 (57개)
├── services/           # API 서비스 (apiService.ts 3,253줄)
├── api-proxy.js        # Express 프록시 (66개 엔드포인트)
├── App.tsx             # 네비게이션 계층 구조
└── vite.config.ts      # Vite 설정
```

### Adapter Stack

| 기술 | 버전 | 제약사항 |
|------|------|----------|
| Java | 1.6 (JDK 6) | **절대적 제약** - Generic 사용 불가 |
| Spring | 2.x | Annotation 기반 설정 불가 |
| Apache Ant | 1.9.16 | 빌드 도구 (Maven 아님) |
| Docker | Azul Zulu OpenJDK 6 | Java 6 환경 구성 |

**주요 파일**:
```
adapter-build-deploy/
├── common-src/src/com/company/api/controller/
│   ├── WorkApiController.java      # 2,746줄, 66개 API
│   ├── CustomerApiController.java
│   └── StatisticsApiController.java
├── build.xml                       # Ant 빌드 스크립트
├── Dockerfile                      # Java 6 Docker 이미지
└── deploy.sh                       # 배포 스크립트
```

**Java 6 코딩 패턴** (반드시 준수):
```java
// ❌ 불가능 - Generics
List<String> list = new ArrayList<String>();

// ✅ 가능 - Raw Type
List list = new ArrayList();
for (Iterator it = list.iterator(); it.hasNext();) {
    String item = (String) it.next();
}

// ❌ 불가능 - Diamond Operator
Map<String, Object> map = new HashMap<>();

// ✅ 가능
Map map = new HashMap();

// ❌ 불가능 - Try-with-resources
try (InputStream is = new FileInputStream("file.txt")) { }

// ✅ 가능
InputStream is = null;
try {
    is = new FileInputStream("file.txt");
} finally {
    if (is != null) is.close();
}
```

### Legacy Server Stack

| 기술 | 버전 | 특징 |
|------|------|------|
| Java | 1.6 | 동일한 제약사항 |
| Spring | 2.x | XML 기반 설정 |
| iBATIS | 2.x | **MyBatis 아님** - 문법 다름 |
| Oracle | - | PL/SQL 프로시저 |
| WebSphere | - | IBM 애플리케이션 서버 |

**주요 파일**:
```
legacy-server/src/com/cona/
├── customer/equipment/
│   ├── web/EquipmentManagerDelegate.java          # 40+ API 핸들러
│   ├── service/impl/EquipmentManagerImpl.java     # 3,496줄, 314 메소드
│   └── dao/sqlmaps/maps/equipment-manager.xml     # iBATIS SQL 맵
├── system/cm/
│   └── web/CommonCodeManagementDelegate.java      # 공통코드 관리
└── statistics/equipment/
    └── web/EquipmentStatisticsDelegate.java       # 통계 조회
```

**iBATIS 2.x 문법** (MyBatis 3.x와 다름):
```xml
<!-- iBATIS 2.x -->
<sqlMap namespace="EquipmentManager">
  <select id="getEquipmentHistoryInfo" resultClass="HashMap" parameterClass="HashMap">
    SELECT * FROM TB_EQT_INFO
    WHERE 1=1
    <isNotEmpty property="EQT_SERNO">
      AND EQT_SERNO = #EQT_SERNO#
    </isNotEmpty>
    <isNotEmpty property="MAC_ADDRESS">
      AND MAC_ADDR = #MAC_ADDRESS#
    </isNotEmpty>
  </select>
</sqlMap>
```

### 인코딩 제약사항

**절대 규칙**: 모든 파일은 **EUC-KR 인코딩**

```bash
# 파일 인코딩 확인
file -I equipment-manager.xml
# 출력: charset=euc-kr

# UTF-8 → EUC-KR 변환 (필요시)
iconv -f UTF-8 -t EUC-KR input.xml > output.xml
```

**왜 EUC-KR?**
- 레거시 시스템이 2000년대 초반 구축
- Oracle DB도 EUC-KR 설정
- WebSphere 서버도 EUC-KR 기본값
- 변경 불가능 (시스템 전체 영향)

---

## 📁 프로젝트 구조

### 전체 디렉토리 구조

```
/Users/bottle/bottle1/delive/dlive-json-api/
│
├── mobile-cona-front/               # ✅ Frontend (React 19)
│   ├── components/                  # 57개 컴포넌트
│   │   ├── EquipmentStatusView.tsx  # ✅ 완료 (API 연동)
│   │   ├── EquipmentAssignment.tsx  # 🔄 진행중 (UI 완료, API 3개 필요)
│   │   ├── EquipmentMovement.tsx    # 🔄 진행중 (UI 완료, API 1개 필요)
│   │   └── EquipmentRecovery.tsx    # 🔄 진행중 (UI 완료, API 1개 필요)
│   ├── services/
│   │   └── apiService.ts            # 3,253줄, 모든 API 함수
│   ├── api-proxy.js                 # Express 프록시 서버
│   ├── App.tsx                      # 네비게이션 로직
│   └── package.json                 # 의존성 관리
│
├── adapter-build-deploy/            # ✅ Adapter (Java 6)
│   ├── common-src/src/              # Java 소스
│   ├── build.xml                    # Ant 빌드
│   └── Dockerfile                   # Java 6 Docker
│
├── legacy-server/                   # ✅ Legacy (Java 6 + iBATIS)
│   └── src/com/cona/                # 레거시 소스
│
├── 아카이브/                        # 📚 분석 자료
│   ├── TSYCM_CODE_DETAIL.xlsx       # 공통코드 1,280개
│   ├── 기능분해도_Ver0.7.xlsx         # 전체 기능 명세
│   ├── 사업수행계획서.docx            # 시스템 아키텍처
│   └── [분석 결과 문서들]
│
└── [6개 WBS CSV 파일]               # 📋 개발 계획
    ├── 딜라이브_통합개발계획_V9.xlsx - 📋 장비관리 WBS.csv
    ├── 딜라이브_통합개발계획_V9.xlsx - 📋 작업관리 WBS.csv
    ├── 딜라이브_통합개발계획_V9.xlsx - 📋 고객관리 WBS.csv
    ├── 딜라이브_통합개발계획_V9.xlsx - 📋 전자청약 WBS.csv
    ├── 딜라이브_통합개발계획_V9.xlsx - 📋 공통_기타 WBS.csv
    └── 딜라이브_통합개발계획_V9.xlsx - 📋 대시보드 WBS.csv
```

### 핵심 파일 설명

#### 1. mobile-cona-front/api-proxy.js (66줄)

**역할**: Express.js 기반 API 프록시 서버

```javascript
// 주요 기능
app.use('/api', createProxyMiddleware({
  target: 'http://58.143.140.222:8080',  // Legacy server
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    // Request logging
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
}));

// 66개 엔드포인트 자동 프록시
// 예: /api/customer/* → 58.143.140.222:8080/api/customer/*
```

#### 2. mobile-cona-front/App.tsx (200줄)

**역할**: 네비게이션 계층 구조 관리

**중요 코드** (라인 35-48):
```typescript
const NAVIGATION_HIERARCHY: Record<View, View | null> = {
  'today-work': null,              // 최상위
  'customer-management': 'today-work',
  'work-management': 'today-work',
  'equipment-management': 'today-work',  // 장비관리
  'signature-pad': 'work-management',
  'work-complete': 'work-management',
  'customer-detail': 'customer-management',
  // ... 총 15개 뷰
};

// 뒤로가기 로직
const handleBack = () => {
  const parentView = NAVIGATION_HIERARCHY[currentView];
  if (parentView) {
    setCurrentView(parentView);
  }
};
```

#### 3. mobile-cona-front/services/apiService.ts (3,253줄)

**역할**: 모든 API 함수 정의 및 에러 처리

**핵심 패턴**:
```typescript
// Circuit Breaker 패턴
let failureCount = 0;
const MAX_FAILURES = 3;
const CIRCUIT_TIMEOUT = 30000;

const fetchWithRetry = async (url: string, options: RequestInit) => {
  if (failureCount >= MAX_FAILURES) {
    throw new Error('서버 연결 실패. 잠시 후 다시 시도해주세요.');
  }

  try {
    const response = await fetch(url, options);
    failureCount = 0;  // 성공 시 카운트 리셋
    return response;
  } catch (error) {
    failureCount++;
    throw error;
  }
};

// Request Deduplication (중복 요청 방지)
const pendingRequests = new Map();

const deduplicateRequest = async (key: string, fn: () => Promise<any>) => {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const promise = fn();
  pendingRequests.set(key, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    pendingRequests.delete(key);
  }
};

// API 함수 예시
export const getEquipmentHistoryInfo = async (params: {
  EQT_SERNO?: string;
  MAC_ADDRESS?: string;
}): Promise<EquipmentInfo[]> => {
  const key = `getEquipmentHistoryInfo-${JSON.stringify(params)}`;

  return deduplicateRequest(key, async () => {
    const response = await fetchWithRetry(
      `${API_BASE}/statistics/equipment/getEquipmentHistoryInfo`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      }
    );
    return await response.json();
  });
};
```

#### 4. adapter-build-deploy/common-src/src/.../WorkApiController.java (2,746줄)

**역할**: JSON ↔ MiPlatform 변환 + API 라우팅

**핵심 패턴**:
```java
public class WorkApiController {
    // 66개 API 엔드포인트를 if-else로 라우팅

    public void service(HttpServletRequest request, HttpServletResponse response) {
        String uri = request.getRequestURI();

        // JSON → MiPlatform Dataset 변환
        if (uri.endsWith("/getEquipmentHistoryInfo")) {
            handleGetEquipmentHistoryInfo(request, response);
        } else if (uri.endsWith("/getEquipmentOutList")) {
            handleGetEquipmentOutList(request, response);
        }
        // ... 64개 더
    }

    private void handleGetEquipmentHistoryInfo(
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        try {
            // 1. Request Body 읽기 (JSON)
            String jsonBody = readRequestBody(request);
            JSONObject json = new JSONObject(jsonBody);

            // 2. MiPlatform Dataset 생성
            DataSet ds = new DataSet("ds_input");
            ds.addColumn("EQT_SERNO", DataTypes.STRING);
            ds.addColumn("MAC_ADDRESS", DataTypes.STRING);
            int row = ds.newRow();
            ds.set(row, "EQT_SERNO", json.optString("EQT_SERNO"));
            ds.set(row, "MAC_ADDRESS", json.optString("MAC_ADDRESS"));

            // 3. Legacy Server 호출
            VariableList inVl = new VariableList();
            DataSetList inDl = new DataSetList();
            inDl.add(ds);

            DataSetList outDl = new DataSetList();

            // Spring Bean 호출
            equipmentStatisticsDelegate.getEquipmentHistoryInfo(inVl, inDl, outDl);

            // 4. MiPlatform Dataset → JSON 변환
            DataSet outDs = outDl.get("ds_output");
            JSONArray result = new JSONArray();
            for (int i = 0; i < outDs.getRowCount(); i++) {
                JSONObject item = new JSONObject();
                for (int j = 0; j < outDs.getColumnCount(); j++) {
                    String colName = outDs.getColumnName(j);
                    item.put(colName, outDs.get(i, colName));
                }
                result.put(item);
            }

            // 5. Response 전송
            response.setContentType("application/json; charset=UTF-8");
            response.getWriter().write(result.toString());

        } catch (Exception e) {
            handleError(response, e);
        }
    }
}
```

#### 5. legacy-server/.../EquipmentManagerDelegate.java (1,200줄)

**역할**: MiPlatform 요청 처리 및 Service 호출

**핵심 패턴**:
```java
public class EquipmentManagerDelegate extends ConaDelegate {

    // Spring DI (XML 설정)
    private EquipmentManagerService equipmentManagerService;

    public void setEquipmentManagerService(EquipmentManagerService service) {
        this.equipmentManagerService = service;
    }

    // 장비 조회 핸들러 (40+ 메소드 중 하나)
    public void getEquipmentHistoryInfo(
        VariableList inVl,    // 입력 변수
        DataSetList inDl,     // 입력 Dataset
        DataSetList outDl     // 출력 Dataset
    ) throws Exception {

        // 1. Input Dataset 파싱
        DataSet ds_input = inDl.get("ds_input");
        Map params = new HashMap();

        if (ds_input != null && ds_input.getRowCount() > 0) {
            params.put("EQT_SERNO", ds_input.getString(0, "EQT_SERNO"));
            params.put("MAC_ADDRESS", ds_input.getString(0, "MAC_ADDRESS"));
        }

        // 2. Service 호출
        List resultList = equipmentManagerService.getEquipmentHistoryInfo(params);

        // 3. Output Dataset 생성
        DataSet ds_output = new DataSet("ds_output");

        // 75개 컬럼 정의 (장비 정보 필드)
        ds_output.addColumn("SO_ID", DataTypes.STRING);
        ds_output.addColumn("SO_NM", DataTypes.STRING);
        ds_output.addColumn("EQT_MDL_NM", DataTypes.STRING);
        // ... 72개 더

        // 4. 데이터 채우기
        for (int i = 0; i < resultList.size(); i++) {
            Map row = (Map) resultList.get(i);
            int newRow = ds_output.newRow();

            ds_output.set(newRow, "SO_ID", row.get("SO_ID"));
            ds_output.set(newRow, "SO_NM", row.get("SO_NM"));
            // ... 72개 더
        }

        // 5. Output에 추가
        outDl.add(ds_output);
    }
}
```

#### 6. legacy-server/.../equipment-manager.xml (5,000줄)

**역할**: iBATIS SQL 맵 정의

**핵심 패턴**:
```xml
<?xml version="1.0" encoding="EUC-KR"?>
<!DOCTYPE sqlMap PUBLIC "-//iBATIS.com//DTD SQL Map 2.0//EN"
  "http://www.ibatis.com/dtd/sql-map-2.dtd">

<sqlMap namespace="EquipmentManager">

  <!-- 장비 조회 쿼리 -->
  <select id="getEquipmentHistoryInfo" resultClass="HashMap" parameterClass="HashMap">
    SELECT
      A.SO_ID,
      (SELECT SO_NM FROM TB_SO_INFO WHERE SO_ID = A.SO_ID) AS SO_NM,
      A.EQT_SERNO,
      A.MAC_ADDR,
      A.EQT_MDL_CD,
      (SELECT CD_NM FROM TSYCM_CODE_DETAIL WHERE GRP_CD = 'EQT_MDL' AND CD = A.EQT_MDL_CD) AS EQT_MDL_NM,
      A.EQT_TYPE_CD,
      A.EQT_STS_CD,
      A.EQT_LOC_TYPE_CD,
      TO_CHAR(A.FRST_RCPT_DT, 'YYYY-MM-DD') AS FRST_RCPT_DT,
      A.USE_POSBL_YN,
      A.CUR_LOC_CD,
      A.BEF_LOC_CD
      -- ... 62개 컬럼 더
    FROM TB_EQT_INFO A
    WHERE 1=1
    <isNotEmpty property="EQT_SERNO">
      AND A.EQT_SERNO = #EQT_SERNO#
    </isNotEmpty>
    <isNotEmpty property="MAC_ADDRESS">
      AND A.MAC_ADDR = #MAC_ADDRESS#
    </isNotEmpty>
  </select>

  <!-- 장비 할당 조회 쿼리 -->
  <select id="getEquipmentOutList" resultClass="HashMap" parameterClass="HashMap">
    SELECT
      A.OUT_REQ_NO,
      A.OUT_DT,
      A.SO_ID,
      B.SO_NM,
      A.CORP_ID,
      C.CORP_NM,
      A.OUT_QTY,
      A.RCPT_QTY,
      (A.OUT_QTY - A.RCPT_QTY) AS REMAIN_QTY
    FROM TB_EQT_OUT_REQ A
    INNER JOIN TB_SO_INFO B ON A.SO_ID = B.SO_ID
    INNER JOIN TB_CORP_INFO C ON A.CORP_ID = C.CORP_ID
    WHERE 1=1
    <isNotEmpty property="OUT_DT">
      AND A.OUT_DT = #OUT_DT#
    </isNotEmpty>
    <isNotEmpty property="SO_ID">
      AND A.SO_ID = #SO_ID#
    </isNotEmpty>
    ORDER BY A.OUT_REQ_NO DESC
  </select>

</sqlMap>
```

---

## 📋 장비관리 기능 명세

### WBS 전체 목록 (16개 기능)

**출처**: `딜라이브_통합개발계획_V9.xlsx - 📋 장비관리 WBS.csv`

| ID | 기능명 | API 경로 | 담당자 | 상태 | Phase | UI 컴포넌트 | 공수(MD) |
|----|--------|----------|--------|------|-------|-------------|----------|
| EM-001 | 기사할당 장비 조회 | `/customer/equipment/getEquipmentOutList.req` | TBD | 진행중 | Phase 2 | - | 3 |
| EM-002 | 기사할당 장비 확인 | `/customer/equipment/getEquipmentProcYnCheck.req` | TBD | 진행중 | Phase 2 | - | 3 |
| EM-003 | 법인장비 할당량 추가 | `/customer/equipment/addCorporationEquipmentQuota.req` | TBD | 계획 | Phase 2 | - | 3 |
| **EM-004** | **기사 보유장비 조회** | `/customer/equipment/getEquipmentReturnRequestList.req` | **조석현** | **진행중** | **Phase 1** | **EquipmentAssignment.tsx (300줄)** | **3** |
| EM-005 | 반납요청 체크 | `/customer/equipment/getEquipmentReturnRequestCheck.req` | TBD | 계획 | Phase 2 | - | 3 |
| EM-006 | 반납요청 등록 | `/customer/equipment/addEquipmentReturnRequest.req` | TBD | 계획 | Phase 2 | - | 3 |
| EM-007 | 기사 보유장비 조회 (분실) | `/customer/equipment/getWrkrHaveEqtList.req` | TBD | 계획 | Phase 2 | - | 3 |
| EM-008 | 장비 분실처리 | `/customer/equipment/cmplEqtCustLossIndem.req` | TBD | 계획 | Phase 2 | - | 4 |
| EM-009 | 검사대기장비 상태변경 | `/customer/equipment/setEquipmentChkStndByY.req` | TBD | 계획 | Phase 2 | - | 3 |
| **EM-010** | **장비 이력 조회** | `/statistics/equipment/getEquipmentHistoryInfo.req` | **조석현** | **✅ 완료** | **Phase 1** | **EquipmentStatusModal.tsx** | **3** |
| **EM-011** | **장비 작업자 이관 (인수)** | `/customer/equipment/changeEqtWrkr_3.req` | **조석현** | **계획** | **Phase 1** | **EquipmentTransfer.tsx** | **4** |
| EM-012 | 타기사 조회 | `/system/cm/getFindUsrList3.req` | TBD | 계획 | Phase 2 | - | 3 |
| EM-013 | 타기사 보유장비 조회 | `/customer/equipment/getWrkrHaveEqtList.req` | TBD | 계획 | Phase 2 | - | 3 |
| EM-014 | 타기사에게 문자 발송 | `/customer/sigtrans/saveENSSendHist.req` | TBD | 계획 | Phase 2 | - | 3 |
| **EM-015** | **미회수 장비 조회** | `/customer/work/getEquipLossInfo.req` | **조석현** | **진행중** | **Phase 1** | **EquipmentRecovery.tsx (300줄)** | **3** |
| EM-016 | 미회수 장비 회수처리 | `/customer/work/modEquipLoss.req` | TBD | 계획 | Phase 2 | - | 3 |

### Phase 1 우선순위 (현재 집중)

#### ✅ EM-010: 장비 이력 조회 (완료)

**파일**: `mobile-cona-front/components/EquipmentStatusView.tsx`

**API**: `/statistics/equipment/getEquipmentHistoryInfo`

**구현 상태**:
- ✅ API 연동 완료
- ✅ 로딩 상태 추가
- ✅ 에러 처리 추가
- ✅ 입력 검증 추가
- ✅ EC2 배포 완료

**코드 위치**: `apiService.ts` 라인 3028-3060

```typescript
// 사용 예시
const result = await getEquipmentHistoryInfo({
  EQT_SERNO: 'AB123456',
  MAC_ADDRESS: '00:11:22:33:44:55'
});

// Response: 75개 필드 포함
// SO_NM, EQT_MDL_NM, EQT_TYPE_NM, EQT_STS_NM, ...
```

#### 🔄 EM-004: 기사 보유장비 조회 (진행중)

**파일**: `mobile-cona-front/components/EquipmentAssignment.tsx` (300줄)

**필요 API**: 3개

1. **getEquipmentOutList** (라인 97-100)
   - 출고일자/지점별 파트너사 출고현황 조회
   - Parameters: `OUT_DT`, `SO_ID`
   - Response: `OUT_REQ_NO`, `CORP_NM`, `OUT_QTY`, `REMAIN_QTY`

2. **getOutTargetEquipmentList** (라인 103-106)
   - 출고번호별 장비 리스트 조회
   - Parameters: `OUT_REQ_NO`
   - Response: `EQT_SERNO`, `MAC_ADDR`, `EQT_MDL_NM`, `RCPT_YN`

3. **processEquipmentReceive** (라인 108-111)
   - 선택된 장비 입고 처리
   - Parameters: `OUT_REQ_NO`, `EQT_SERNO_LIST[]`
   - Response: 성공/실패 메시지

**구현 방법**:
```typescript
// 1단계: apiService.ts에 함수 추가
export const getEquipmentOutList = async (params: {
  OUT_DT?: string;
  SO_ID?: string;
}): Promise<EquipmentOutInfo[]> => {
  const response = await fetchWithRetry(
    `${API_BASE}/customer/equipment/getEquipmentOutList`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }
  );
  return await response.json();
};

// 2단계: EquipmentAssignment.tsx에서 호출
const handleSearch = async () => {
  setIsLoading(true);
  try {
    const result = await getEquipmentOutList({
      OUT_DT: searchParams.outDate,
      SO_ID: userInfo?.SO_ID
    });
    setEqtOutList(result);
  } catch (error) {
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
};
```

#### 🔄 EM-011: 장비 작업자 이관 (계획)

**파일**: `mobile-cona-front/components/EquipmentTransfer.tsx`

**필요 API**: 1개 + 모달 컴포넌트

1. **getEquipmentTransferList** (라인 96-99)
   - 나에게 이관된 장비 조회
   - Parameters: `WRKR_ID` (나의 ID)
   - Response: `EQT_SERNO`, `FROM_WRKR_NM`, `TRNS_DT`, `TRNS_STS_CD`

2. **Worker Search Modal** (신규 필요)
   - 타기사 검색 팝업
   - API: `/system/cm/getFindUsrList3`
   - 기능: 기사 ID로 검색 → 선택

#### 🔄 EM-015: 미회수 장비 조회 (진행중)

**파일**: `mobile-cona-front/components/EquipmentRecovery.tsx` (147줄)

**필요 API**: 1개

1. **getUnreturnedEquipmentList** (라인 50-52)
   - 지점/S/N/계약ID별 미회수 장비 조회
   - Parameters: `SO_ID`, `EQT_SERNO`, `CNTR_ID`
   - Response: `CUST_NM`, `ADDR`, `PHONE`, `EQT_SERNO`, `UNRETURNED_DAYS`

**구현 우선순위**: EM-004 → EM-015 → EM-011

---

## 🔌 API 연동 가이드

### API 추가 체크리스트

새로운 API를 추가할 때 다음 순서로 작업:

#### Step 1: Legacy Server에서 API 확인

**파일**: `legacy-server/src/com/cona/customer/equipment/web/EquipmentManagerDelegate.java`

```java
// API 핸들러 메소드 찾기
public void getEquipmentOutList(
    VariableList inVl,
    DataSetList inDl,
    DataSetList outDl
) throws Exception {
    // 구현 확인
}
```

**확인사항**:
- ✅ 메소드 존재 여부
- ✅ Input Dataset 이름 (보통 `ds_input`)
- ✅ Output Dataset 이름 (보통 `ds_output`)
- ✅ 파라미터 필드명 확인

#### Step 2: iBATIS SQL 맵 확인

**파일**: `legacy-server/src/com/cona/customer/equipment/dao/sqlmaps/maps/equipment-manager.xml`

```xml
<!-- SQL ID 찾기 -->
<select id="getEquipmentOutList" resultClass="HashMap" parameterClass="HashMap">
  SELECT
    A.OUT_REQ_NO,
    A.OUT_DT,
    -- ... 필드 목록 확인
  FROM TB_EQT_OUT_REQ A
  WHERE 1=1
  <isNotEmpty property="OUT_DT">
    AND A.OUT_DT = #OUT_DT#
  </isNotEmpty>
</select>
```

**확인사항**:
- ✅ 파라미터 필드명 (property 값)
- ✅ 응답 필드 목록 (SELECT 절)
- ✅ 동적 조건 (`<isNotEmpty>`, `<isNotEqual>` 등)

#### Step 3: Adapter에 라우팅 추가

**파일**: `adapter-build-deploy/common-src/src/com/company/api/controller/WorkApiController.java`

```java
// service() 메소드에 if-else 추가
public void service(HttpServletRequest request, HttpServletResponse response) {
    String uri = request.getRequestURI();

    // 기존 코드...

    // 새로운 API 추가
    else if (uri.endsWith("/getEquipmentOutList")) {
        handleGetEquipmentOutList(request, response);
    }
}

// 핸들러 메소드 구현
private void handleGetEquipmentOutList(
    HttpServletRequest request,
    HttpServletResponse response
) {
    try {
        // 1. JSON → MiPlatform Dataset
        String jsonBody = readRequestBody(request);
        JSONObject json = new JSONObject(jsonBody);

        DataSet ds = new DataSet("ds_input");
        ds.addColumn("OUT_DT", DataTypes.STRING);
        ds.addColumn("SO_ID", DataTypes.STRING);
        int row = ds.newRow();
        ds.set(row, "OUT_DT", json.optString("OUT_DT"));
        ds.set(row, "SO_ID", json.optString("SO_ID"));

        // 2. Legacy 호출
        VariableList inVl = new VariableList();
        DataSetList inDl = new DataSetList();
        inDl.add(ds);
        DataSetList outDl = new DataSetList();

        equipmentManagerDelegate.getEquipmentOutList(inVl, inDl, outDl);

        // 3. MiPlatform Dataset → JSON
        DataSet outDs = outDl.get("ds_output");
        JSONArray result = datasetToJSON(outDs);  // 유틸 함수 사용

        // 4. Response
        response.setContentType("application/json; charset=UTF-8");
        response.getWriter().write(result.toString());

    } catch (Exception e) {
        handleError(response, e);
    }
}
```

**Java 6 주의사항**:
- ❌ `List<String>` 사용 불가 → `List` 사용
- ❌ Try-with-resources 불가 → finally 블록 사용
- ✅ EUC-KR 인코딩 유지

#### Step 4: Adapter 빌드 & 배포

```bash
cd /Users/bottle/bottle1/delive/dlive-json-api/adapter-build-deploy

# 1. Ant 빌드
ant clean build

# 2. Docker 이미지 빌드
docker build -t dlive-adapter:latest .

# 3. 컨테이너 재시작
docker-compose restart adapter

# 4. 로그 확인
docker logs -f dlive-adapter
```

#### Step 5: Frontend API 함수 추가

**파일**: `mobile-cona-front/services/apiService.ts`

```typescript
// TypeScript 인터페이스 정의
interface EquipmentOutInfo {
  OUT_REQ_NO: string;
  OUT_DT: string;
  SO_ID: string;
  SO_NM: string;
  CORP_ID: string;
  CORP_NM: string;
  OUT_QTY: number;
  RCPT_QTY: number;
  REMAIN_QTY: number;
}

// API 함수 추가 (파일 끝에)
export const getEquipmentOutList = async (params: {
  OUT_DT?: string;
  SO_ID?: string;
}): Promise<EquipmentOutInfo[]> => {
  const key = `getEquipmentOutList-${JSON.stringify(params)}`;

  return deduplicateRequest(key, async () => {
    const response = await fetchWithRetry(
      `${API_BASE}/customer/equipment/getEquipmentOutList`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      }
    );

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    return await response.json();
  });
};
```

#### Step 6: React 컴포넌트에서 사용

**파일**: `mobile-cona-front/components/EquipmentAssignment.tsx`

```typescript
import { getEquipmentOutList } from '../services/apiService';

const EquipmentAssignment = () => {
  const [eqtOutList, setEqtOutList] = useState<EquipmentOutInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchParams.outDate) {
      setError('출고일자를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getEquipmentOutList({
        OUT_DT: searchParams.outDate,
        SO_ID: userInfo?.SO_ID
      });

      setEqtOutList(result);

      if (result.length === 0) {
        setError('조회된 출고 내역이 없습니다.');
      }
    } catch (err: any) {
      setError(err.message || '장비 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      <button onClick={handleSearch} disabled={isLoading}>
        {isLoading ? '조회 중...' : '조회'}
      </button>

      {eqtOutList.map(item => (
        <div key={item.OUT_REQ_NO}>
          {item.CORP_NM} - {item.REMAIN_QTY}개 남음
        </div>
      ))}
    </div>
  );
};
```

### API 테스트 방법

#### 1. 브라우저 개발자 도구

```javascript
// Console에서 직접 테스트
const result = await fetch('http://localhost:3000/api/customer/equipment/getEquipmentOutList', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    OUT_DT: '20250128',
    SO_ID: 'SO001'
  })
});

const data = await result.json();
console.log(data);
```

#### 2. cURL 명령어

```bash
# Local 테스트
curl -X POST http://localhost:3000/api/customer/equipment/getEquipmentOutList \
  -H "Content-Type: application/json" \
  -d '{"OUT_DT":"20250128","SO_ID":"SO001"}'

# EC2 테스트
curl -X POST http://52.63.131.157/api/customer/equipment/getEquipmentOutList \
  -H "Content-Type: application/json" \
  -d '{"OUT_DT":"20250128","SO_ID":"SO001"}'
```

#### 3. Demo Mode 활용

```javascript
// localStorage에 더미 데이터 저장
localStorage.setItem('demoMode', 'true');
localStorage.setItem('demoData_getEquipmentOutList', JSON.stringify([
  {
    OUT_REQ_NO: 'OUT202501280001',
    OUT_DT: '20250128',
    SO_NM: '서울지점',
    CORP_NM: '파트너사A',
    OUT_QTY: 50,
    RCPT_QTY: 30,
    REMAIN_QTY: 20
  }
]));

// 이제 API 호출 시 더미 데이터 반환됨
```

### 공통 에러 처리 패턴

```typescript
// apiService.ts에 이미 구현된 패턴

// 1. Network 에러
try {
  const response = await fetch(url, options);
} catch (error) {
  if (error instanceof TypeError) {
    throw new Error('네트워크 연결을 확인해주세요.');
  }
  throw error;
}

// 2. HTTP 에러
if (!response.ok) {
  if (response.status === 404) {
    throw new Error('API를 찾을 수 없습니다.');
  } else if (response.status === 500) {
    throw new Error('서버 오류가 발생했습니다.');
  }
  throw new Error(`API 호출 실패: ${response.status}`);
}

// 3. JSON 파싱 에러
try {
  const data = await response.json();
  return data;
} catch (error) {
  throw new Error('응답 데이터 형식이 올바르지 않습니다.');
}

// 4. 비즈니스 로직 에러
if (data.ERROR_CODE) {
  throw new Error(data.ERROR_MESSAGE || '처리 중 오류가 발생했습니다.');
}
```

---

## 🚀 개발 워크플로우

### Git 브랜치 전략

```bash
# 1. Main 브랜치 최신화
git checkout main
git pull teamart main

# 2. Feature 브랜치 생성
git checkout -b jsh/equipment-feature-name
# 예: jsh/equipment-assignment-api

# 3. 작업 진행
# - 파일 수정
# - 테스트

# 4. Commit
git add .
git commit -m "feat: 장비 할당 API 연동 완료

- getEquipmentOutList API 추가
- EquipmentAssignment 컴포넌트 연동
- 로딩 상태 및 에러 처리 추가

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 5. Push
git push origin jsh/equipment-feature-name --force-with-lease

# 6. PR 생성
gh pr create --title "feat: 장비 할당 API 연동" --body "$(cat <<'EOF'
## 📋 작업 내용
장비 할당 조회 기능 구현

## ✨ 구현 기능
- getEquipmentOutList API 연동
- 출고일자/지점별 조회
- 로딩 스피너 추가
- 에러 메시지 표시

## 🧪 테스트 방법
1. 장비관리 > 장비할당/반납 탭
2. 출고일자 선택
3. 조회 버튼 클릭

## 📝 변경 파일
- services/apiService.ts (+50)
- components/EquipmentAssignment.tsx (+30, -10)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

# 7. PR Merge (GitHub 웹에서 승인 후)

# 8. Main 브랜치 업데이트
git checkout main
git pull teamart main

# 9. Feature 브랜치 삭제
git branch -d jsh/equipment-feature-name
git push origin --delete jsh/equipment-feature-name
```

### 로컬 개발 환경 설정

```bash
# 1. 프로젝트 클론 (이미 완료)
cd /Users/bottle/bottle1/delive/dlive-json-api/mobile-cona-front

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000

# 4. 별도 터미널에서 API 프록시 실행
node api-proxy.js
# → http://localhost:3000/api/* → 58.143.140.222:8080/api/*

# 5. 브라우저에서 확인
open http://localhost:3000
```

### Demo Mode 활용

```javascript
// 브라우저 Console에서 실행

// 1. Demo Mode 활성화
localStorage.setItem('demoMode', 'true');

// 2. 사용자 정보 설정
localStorage.setItem('userInfo', JSON.stringify({
  USR_ID: 'TEST_USER',
  USR_NM: '테스트기사',
  SO_ID: 'SO001',
  SO_NM: '서울지점',
  AUTH_SO_List: [
    { SO_ID: 'SO001', SO_NM: '서울지점' },
    { SO_ID: 'SO002', SO_NM: '부산지점' }
  ]
}));

// 3. 장비 조회 더미 데이터
localStorage.setItem('demoData_getEquipmentHistoryInfo', JSON.stringify([
  {
    EQT_SERNO: 'AB123456',
    MAC_ADDR: '00:11:22:33:44:55',
    SO_NM: '서울지점',
    EQT_MDL_NM: 'STB-2000',
    EQT_TYPE_NM: '셋톱박스',
    EQT_STS_NM: '정상',
    USE_POSBL_YN: 'Y',
    FRST_RCPT_DT: '2025-01-15',
    CUR_LOC_NM: '작업기사',
    BEF_LOC_NM: '창고'
    // ... 나머지 65개 필드
  }
]));

// 4. 페이지 새로고침
location.reload();
```

### 코드 품질 체크

```bash
# 1. TypeScript 타입 체크
npm run type-check

# 2. ESLint 검사
npm run lint

# 3. 빌드 테스트
npm run build

# 4. 빌드 결과 프리뷰
npm run preview
# → http://localhost:4173
```

---

## 🚢 배포 프로세스

### EC2 서버 정보

| 항목 | 값 |
|------|-----|
| IP | 52.63.131.157 |
| OS | Ubuntu 22.04 |
| SSH 사용자 | ubuntu |
| 배포 디렉토리 | /home/ubuntu/dlive-cona-client |
| PM2 프로세스명 | dlive |
| 접속 URL | http://52.63.131.157/ |

### 배포 순서

#### Step 1: PR Merge 확인

```bash
# GitHub에서 PR Merge 완료 확인
# → https://github.com/teemartbottle/dlive-cona-client/pulls

# 로컬 main 업데이트
git checkout main
git pull teamart main
```

#### Step 2: EC2 SSH 접속

```bash
# SSH 키 권한 설정 (최초 1회)
chmod 600 /path/to/ec2_key.pem

# SSH 접속
ssh -i /path/to/ec2_key.pem ubuntu@52.63.131.157

# 또는 키 등록 후
ssh ubuntu@52.63.131.157
```

#### Step 3: 배포 스크립트 실행

```bash
# 배포 디렉토리로 이동
cd /home/ubuntu/dlive-cona-client

# 배포 스크립트 실행
bash /tmp/ec2_deploy.sh

# 또는 수동 배포
git pull origin main
npm install  # 의존성 변경 시만
npm run build
pm2 restart dlive
pm2 logs dlive --lines 20
```

**배포 스크립트 내용** (`/tmp/ec2_deploy.sh`):
```bash
#!/bin/bash
echo "🚀 EC2 배포 시작..."

# 1. 최신 코드 가져오기
git pull origin main

# 2. 빌드
npm run build

# 3. PM2 재시작
pm2 restart dlive

# 4. 로그 확인
pm2 logs dlive --lines 20 --nostream

echo "✅ 배포 완료!"
echo "🌐 http://52.63.131.157/"
```

#### Step 4: 배포 검증

```bash
# 1. PM2 상태 확인
pm2 status
# dlive가 online 상태여야 함

# 2. 로그 확인
pm2 logs dlive --lines 50

# 3. 포트 확인
sudo netstat -tlnp | grep 80
# 0.0.0.0:80 LISTEN 상태여야 함
```

#### Step 5: 브라우저 테스트

```
1. http://52.63.131.157/ 접속
2. 장비관리 메뉴 클릭
3. 구현한 기능 테스트
   - 장비상태조회 탭
   - S/N 또는 MAC 입력
   - 조회 버튼 클릭
4. 결과 확인
   - ✅ 로딩 스피너 표시
   - ✅ 장비 정보 75개 필드 표시
   - ✅ 에러 시 빨간 메시지
```

### 배포 롤백 (문제 발생 시)

```bash
# 1. 이전 커밋으로 되돌리기
cd /home/ubuntu/dlive-cona-client
git log --oneline -5  # 최근 5개 커밋 확인
git reset --hard <이전_커밋_해시>

# 2. 재배포
npm run build
pm2 restart dlive

# 3. 확인
pm2 logs dlive --lines 20
```

### PM2 유용한 명령어

```bash
# 실시간 로그 보기
pm2 logs dlive

# 로그 초기화
pm2 flush

# 프로세스 재시작
pm2 restart dlive

# 프로세스 중지
pm2 stop dlive

# 프로세스 시작
pm2 start dlive

# 상태 확인
pm2 status

# 모니터링
pm2 monit

# 메모리 사용량 확인
pm2 show dlive
```

---

## 🔍 트러블슈팅

### 문제 1: API 호출 실패

**증상**:
```
Error: Failed to fetch
Network Error
```

**원인**:
1. API 프록시 서버 미실행
2. Legacy 서버 다운
3. CORS 에러

**해결**:
```bash
# 1. API 프록시 확인
ps aux | grep api-proxy
# 없으면 실행
node api-proxy.js &

# 2. Legacy 서버 ping 테스트
ping 58.143.140.222

# 3. cURL 테스트
curl -X POST http://localhost:3000/api/customer/equipment/getEquipmentHistoryInfo \
  -H "Content-Type: application/json" \
  -d '{"EQT_SERNO":"TEST"}'
```

### 문제 2: 빌드 실패

**증상**:
```
Type error: Property 'XXX' does not exist on type 'YYY'
```

**원인**: TypeScript 타입 불일치

**해결**:
```typescript
// 1. 인터페이스 정의 추가
interface EquipmentInfo {
  EQT_SERNO: string;
  MAC_ADDR: string;
  // ... 모든 필드 정의
}

// 2. Optional Chaining 사용
const value = data?.field ?? '기본값';

// 3. Type Assertion (최후 수단)
const typedData = data as EquipmentInfo;
```

### 문제 3: EC2 배포 후 빈 화면

**증상**: http://52.63.131.157/ 접속 시 빈 화면

**원인**:
1. 빌드 파일 미생성
2. PM2 프로세스 중지
3. Nginx/Express 설정 오류

**해결**:
```bash
# 1. 빌드 파일 확인
ls -la /home/ubuntu/dlive-cona-client/dist/
# index.html, assets/ 존재해야 함

# 2. PM2 상태 확인
pm2 status
pm2 logs dlive --lines 100

# 3. 포트 확인
sudo netstat -tlnp | grep 80

# 4. 재빌드 & 재시작
npm run build
pm2 restart dlive
pm2 logs dlive
```

### 문제 4: localStorage 데이터 유실

**증상**: 로그인 후 새로고침 시 로그아웃됨

**원인**: localStorage 저장 누락

**해결**:
```typescript
// Login.tsx에서 확인
const handleLogin = async () => {
  const response = await login(userId, password);

  // ✅ 반드시 저장
  localStorage.setItem('userInfo', JSON.stringify(response.data));
  localStorage.setItem('branchList', JSON.stringify(response.data.AUTH_SO_List));

  // ❌ 저장 안 하면 새로고침 시 유실됨
};

// App.tsx에서 복원
useEffect(() => {
  const storedUser = localStorage.getItem('userInfo');
  if (storedUser) {
    setUserInfo(JSON.parse(storedUser));
  }
}, []);
```

### 문제 5: Java 6 빌드 에러

**증상**:
```
error: cannot find symbol - class ArrayList<String>
```

**원인**: Generic 사용

**해결**:
```java
// ❌ 불가능
List<String> list = new ArrayList<String>();

// ✅ 수정
List list = new ArrayList();
String item = (String) list.get(0);

// ❌ 불가능
for (String item : list) { }

// ✅ 수정
for (Iterator it = list.iterator(); it.hasNext();) {
    String item = (String) it.next();
}
```

### 문제 6: EUC-KR 인코딩 깨짐

**증상**: 한글이 "??" 또는 "ㅁㅁㅁ"로 표시

**원인**: 파일 인코딩 불일치

**해결**:
```bash
# 1. 파일 인코딩 확인
file -I equipment-manager.xml

# 2. UTF-8 → EUC-KR 변환
iconv -f UTF-8 -t EUC-KR input.xml > output.xml

# 3. Ant 빌드 시 인코딩 지정
ant -Dfile.encoding=EUC-KR build
```

### 문제 7: iBATIS SQL 문법 에러

**증상**:
```
There is no parameter map named 'XXX'
```

**원인**: MyBatis 3.x 문법 사용

**해결**:
```xml
<!-- ❌ MyBatis 3.x 문법 -->
<select id="test" parameterType="HashMap" resultType="HashMap">
  SELECT * FROM TB WHERE ID = #{id}
</select>

<!-- ✅ iBATIS 2.x 문법 -->
<select id="test" parameterClass="HashMap" resultClass="HashMap">
  SELECT * FROM TB WHERE ID = #id#
</select>

<!-- ❌ <if test=""> -->
<if test="id != null">
  AND ID = #{id}
</if>

<!-- ✅ <isNotEmpty property=""> -->
<isNotEmpty property="id">
  AND ID = #id#
</isNotEmpty>
```

### 문제 8: 지점 목록 로드 실패

**증상**: 지점 선택 드롭다운 빈 상태

**해결**:
```typescript
// ❌ 잘못된 방법 - 별도 API 호출
const branchList = await getBranchList();

// ✅ 올바른 방법 - 로그인 응답에서 가져오기
const loginResponse = await login(userId, password);
const branchList = loginResponse.data.AUTH_SO_List;

// localStorage에 저장
localStorage.setItem('branchList', JSON.stringify(branchList));

// 컴포넌트에서 사용
const storedBranches = localStorage.getItem('branchList');
if (storedBranches) {
  setSoList(JSON.parse(storedBranches));
}
```

---

## 📚 참고 자료

### 공통 코드 (TSYCM_CODE_DETAIL)

**총 1,280개 코드 그룹** - 자주 사용하는 코드:

| 그룹 코드 | 그룹명 | 주요 코드 | 설명 |
|-----------|--------|-----------|------|
| EQT_MDL | 장비모델 | STB2000, MODEM500 | 장비 모델 구분 |
| EQT_TYPE | 장비유형 | 10(셋톱박스), 20(모뎀) | 장비 유형 |
| EQT_STS | 장비상태 | 10(재고), 20(사용중), 30(분실) | 장비 상태 |
| EQT_LOC_TYPE | 장비위치유형 | 1(창고), 2(지점), 3(작업기사) | 장비 위치 |
| WORK_TYPE | 작업유형 | 10(설치), 20(AS), 30(해지) | 작업 구분 |
| SO | 지점 | SO001, SO002 | 지점 코드 |

**사용 예시**:
```typescript
// 코드 → 명칭 변환
const getCodeName = (grpCd: string, cd: string): string => {
  // API: /system/cm/getCodeDetail
  // 또는 localStorage에 캐싱
  const codeMap = JSON.parse(localStorage.getItem('commonCodes') || '{}');
  return codeMap[grpCd]?.[cd] || cd;
};

// 장비 상태 표시
const statusName = getCodeName('EQT_STS', '10');  // "재고"
```

### 네비게이션 계층 구조

```
today-work (오늘 작업)
├── customer-management (고객 관리)
│   └── customer-detail (고객 상세)
├── work-management (작업 관리)
│   ├── signature-pad (서명)
│   └── work-complete (작업 완료)
└── equipment-management (장비 관리)  ← 현재 작업 중
    ├── equipment-status (장비 상태 조회)     ✅ 완료
    ├── equipment-assignment (장비 할당/반납)  🔄 진행중
    ├── equipment-movement (기사간 이동)       🔄 계획
    └── equipment-recovery (미회수 회수)       🔄 진행중
```

### 프로젝트 주요 마일스톤

| 날짜 | 내용 | 상태 |
|------|------|------|
| 2025-01-20 | 프로젝트 시작, 아키텍처 분석 | ✅ 완료 |
| 2025-01-25 | EM-010 장비 상태 조회 구현 | ✅ 완료 |
| 2025-01-28 | 아카이브 분석, COMPREHENSIVE_GUIDE 작성 | ✅ 완료 |
| 2025-01-30 (예정) | EM-004 장비 할당 API 연동 | 🔄 진행 예정 |
| 2025-02-05 (예정) | EM-015 미회수 장비 조회 | 🔄 계획 |
| 2025-02-10 (예정) | EM-011 장비 이관 기능 | 🔄 계획 |
| 2025-02-28 (예정) | Phase 1 완료 | 🎯 목표 |

---

## 🎯 즉시 시작 가능한 작업

### 우선순위 1: EM-004 장비 할당 API 연동

**예상 소요 시간**: 2-3시간

**작업 순서**:
1. ✅ Legacy Server 코드 확인 (이미 존재)
2. ✅ Adapter에 라우팅 추가 (템플릿 준비됨)
3. ✅ apiService.ts에 함수 3개 추가
4. ✅ EquipmentAssignment.tsx TODO 제거
5. ✅ 로컬 테스트
6. ✅ PR 생성 & Merge
7. ✅ EC2 배포
8. ✅ 브라우저 테스트

**필요 파일**:
- `adapter-build-deploy/common-src/src/.../WorkApiController.java`
- `mobile-cona-front/services/apiService.ts`
- `mobile-cona-front/components/EquipmentAssignment.tsx`

### 우선순위 2: EM-015 미회수 장비 조회

**예상 소요 시간**: 1시간

**작업 순서**:
1. ✅ API 함수 1개만 추가
2. ✅ EquipmentRecovery.tsx TODO 제거
3. ✅ 테스트 & 배포

### 우선순위 3: .claude/instructions.md 생성

**예상 소요 시간**: 30분

**목적**: 새로운 Claude Code 세션 시작 시 자동 로드

**내용**:
- 프로젝트 개요
- Java 6 제약사항
- 장비관리 중점
- 자주 사용하는 명령어

---

## 💡 유용한 명령어 모음

### Git 관련
```bash
# 현재 브랜치 확인
git branch

# Main 최신화
git checkout main && git pull teamart main

# Feature 브랜치 생성
git checkout -b jsh/feature-name

# 변경사항 확인
git status
git diff

# Commit
git add .
git commit -m "feat: 기능 설명"

# Push
git push origin jsh/feature-name --force-with-lease

# PR 생성
gh pr create --title "제목" --body "내용"

# Merge 후 정리
git checkout main && git pull teamart main && git branch -d jsh/feature-name
```

### NPM 관련
```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev

# 빌드
npm run build

# 타입 체크
npm run type-check

# Lint
npm run lint

# 프리뷰
npm run preview
```

### EC2 관련
```bash
# SSH 접속
ssh ubuntu@52.63.131.157

# 배포
cd /home/ubuntu/dlive-cona-client
git pull origin main
npm run build
pm2 restart dlive

# 로그 확인
pm2 logs dlive

# 상태 확인
pm2 status

# 포트 확인
sudo netstat -tlnp | grep 80
```

### Java/Adapter 빌드
```bash
# Adapter 빌드
cd /Users/bottle/bottle1/delive/dlive-json-api/adapter-build-deploy
ant clean build

# Docker 빌드 (필요 시)
docker build -t dlive-adapter:latest .

# 컨테이너 재시작
docker-compose restart adapter

# 로그 확인
docker logs -f dlive-adapter
```

---

## 📞 지원 및 문서

### GitHub Repository
- **Frontend**: https://github.com/teemartbottle/dlive-cona-client
- **Branch 전략**: main (production) / jsh/* (feature branches)

### 서버 정보
- **EC2 IP**: 52.63.131.157
- **Legacy Server**: 58.143.140.222:8080
- **Demo URL**: http://52.63.131.157/

### 담당자
- **장비관리 파트**: 조석현
- **Phase 1 기능**: EM-010, EM-004, EM-011, EM-015

---

## 🔄 문서 업데이트 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2025-01-28 | 1.0 | 초기 문서 생성 (전체 분석 통합) |

---

**이 문서로 새로운 Claude Code 인스턴스가 프로젝트 전체를 이해하고 즉시 개발 시작 가능해야 합니다.**

**질문이나 불명확한 부분이 있으면 이 문서를 먼저 참조하세요.**
