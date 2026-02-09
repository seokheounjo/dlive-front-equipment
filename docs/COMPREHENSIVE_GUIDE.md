# ?뱲 D-Live Equipment Management System - Complete Guide

> **紐⑹쟻**: ??臾몄꽌 ?섎굹濡??덈줈??Claude Code ?몄뒪?댁뒪媛 ?꾩껜 ?꾨줈?앺듃瑜??댄빐?섍퀬 利됱떆 ?묒뾽 ?쒖옉 媛??
>
> **留덉?留??낅뜲?댄듃**: 2025-11-28
>
> **?꾩옱 吏꾪뻾?곹솴**: Phase 1 ?λ퉬愿由?湲곕뒫 援ы쁽 以?

---

## ?뱫 紐⑹감

1. [?쒖뒪???꾪궎?띿쿂 媛쒖슂](#?쒖뒪???꾪궎?띿쿂-媛쒖슂)
2. [湲곗닠 ?ㅽ깮 & ?쒖빟?ы빆](#湲곗닠-?ㅽ깮--?쒖빟?ы빆)
3. [?꾨줈?앺듃 援ъ“](#?꾨줈?앺듃-援ъ“)
4. [?λ퉬愿由?湲곕뒫 紐낆꽭](#?λ퉬愿由?湲곕뒫-紐낆꽭)
5. [API ?곕룞 媛?대뱶](#api-?곕룞-媛?대뱶)
6. [媛쒕컻 ?뚰겕?뚮줈??(#媛쒕컻-?뚰겕?뚮줈??
7. [諛고룷 ?꾨줈?몄뒪](#諛고룷-?꾨줈?몄뒪)
8. [?몃윭釉붿뒋??(#?몃윭釉붿뒋??

---

## ?룛截??쒖뒪???꾪궎?띿쿂 媛쒖슂

### 3怨꾩링 援ъ“

```
?뚢???????????????????????????????????????????????????????????????
?? Frontend (React 19 + TypeScript)                           ??
?? Port: 3000 (dev) / 80 (prod)                              ??
?? Location: /mobile-cona-front                               ??
?붴??????????????????р?????????????????????????????????????????????
                  ??HTTP/JSON
                  ??(Express Proxy)
?뚢??????????????????쇄?????????????????????????????????????????????
?? Adapter (Java 6 + Spring 2.x)                              ??
?? Port: 8080                                                 ??
?? Function: JSON ??MiPlatform 蹂??                         ??
?? Location: /adapter-build-deploy                            ??
?붴??????????????????р?????????????????????????????????????????????
                  ??MiPlatform XML
                  ??(EUC-KR encoding)
?뚢??????????????????쇄?????????????????????????????????????????????
?? Legacy Server (Java 6 + iBATIS 2.x + Oracle)               ??
?? Server: IBM WebSphere                                      ??
?? Location: /legacy-server                                   ??
?? IP: 58.143.140.222:8080                                    ??
?붴???????????????????????????????????????????????????????????????
```

### ?곗씠???먮쫫 ?덉떆

```typescript
// Frontend Request
const result = await getEquipmentHistoryInfo({
  EQT_SERNO: 'AB123456',
  MAC_ADDRESS: '00:11:22:33:44:55'
});

// ??api-proxy.js (Express)
// POST /api/statistics/equipment/getEquipmentHistoryInfo
// ??58.143.140.222:8080/api/statistics/equipment/getEquipmentHistoryInfo

// ??Adapter (WorkApiController.java)
// JSON ??MiPlatform Dataset 蹂??
// EUC-KR ?몄퐫??蹂??

// ??Legacy Server (EquipmentManagerDelegate.java)
// MiPlatform Dataset ?뚯떛
// iBATIS SQL ?ㅽ뻾 (equipment-manager.xml)

// ??Oracle Database
// SELECT * FROM TB_EQT_INFO WHERE EQT_SERNO = ?

// ??Response (??닚)
// MiPlatform ??JSON ??React Component
```

---

## ?뵩 湲곗닠 ?ㅽ깮 & ?쒖빟?ы빆

### Frontend Stack

| 湲곗닠 | 踰꾩쟾 | ?⑸룄 |
|------|------|------|
| React | 19.1.1 | UI ?꾨젅?꾩썙??|
| TypeScript | 5.8.2 | ????덉쟾??|
| Vite | 6.2.0 | 鍮뚮뱶 ?꾧뎄 |
| Tailwind CSS | 3.4.1 | ?ㅽ??쇰쭅 |
| Express.js | 4.21.2 | API ?꾨줉???쒕쾭 |
| PM2 | - | ?꾨줈?뺤뀡 ?꾨줈?몄뒪 愿由?|

**二쇱슂 ?붾젆?좊━**:
```
mobile-cona-front/
?쒋?? components/          # React 而댄룷?뚰듃 (57媛?
?쒋?? services/           # API ?쒕퉬??(apiService.ts 3,253以?
?쒋?? api-proxy.js        # Express ?꾨줉??(66媛??붾뱶?ъ씤??
?쒋?? App.tsx             # ?ㅻ퉬寃뚯씠??怨꾩링 援ъ“
?붴?? vite.config.ts      # Vite ?ㅼ젙
```

### Adapter Stack

| 湲곗닠 | 踰꾩쟾 | ?쒖빟?ы빆 |
|------|------|----------|
| Java | 1.6 (JDK 6) | **?덈????쒖빟** - Generic ?ъ슜 遺덇? |
| Spring | 2.x | Annotation 湲곕컲 ?ㅼ젙 遺덇? |
| Apache Ant | 1.9.16 | 鍮뚮뱶 ?꾧뎄 (Maven ?꾨떂) |
| Docker | Azul Zulu OpenJDK 6 | Java 6 ?섍꼍 援ъ꽦 |

**二쇱슂 ?뚯씪**:
```
adapter-build-deploy/
?쒋?? common-src/src/com/company/api/controller/
??  ?쒋?? WorkApiController.java      # 2,746以? 66媛?API
??  ?쒋?? CustomerApiController.java
??  ?붴?? StatisticsApiController.java
?쒋?? build.xml                       # Ant 鍮뚮뱶 ?ㅽ겕由쏀듃
?쒋?? Dockerfile                      # Java 6 Docker ?대?吏
?붴?? deploy.sh                       # 諛고룷 ?ㅽ겕由쏀듃
```

**Java 6 肄붾뵫 ?⑦꽩** (諛섎뱶??以??:
```java
// ??遺덇???- Generics
List<String> list = new ArrayList<String>();

// ??媛??- Raw Type
List list = new ArrayList();
for (Iterator it = list.iterator(); it.hasNext();) {
    String item = (String) it.next();
}

// ??遺덇???- Diamond Operator
Map<String, Object> map = new HashMap<>();

// ??媛??
Map map = new HashMap();

// ??遺덇???- Try-with-resources
try (InputStream is = new FileInputStream("file.txt")) { }

// ??媛??
InputStream is = null;
try {
    is = new FileInputStream("file.txt");
} finally {
    if (is != null) is.close();
}
```

### Legacy Server Stack

| 湲곗닠 | 踰꾩쟾 | ?뱀쭠 |
|------|------|------|
| Java | 1.6 | ?숈씪???쒖빟?ы빆 |
| Spring | 2.x | XML 湲곕컲 ?ㅼ젙 |
| iBATIS | 2.x | **MyBatis ?꾨떂** - 臾몃쾿 ?ㅻ쫫 |
| Oracle | - | PL/SQL ?꾨줈?쒖? |
| WebSphere | - | IBM ?좏뵆由ъ??댁뀡 ?쒕쾭 |

**二쇱슂 ?뚯씪**:
```
legacy-server/src/com/cona/
?쒋?? customer/equipment/
??  ?쒋?? web/EquipmentManagerDelegate.java          # 40+ API ?몃뱾??
??  ?쒋?? service/impl/EquipmentManagerImpl.java     # 3,496以? 314 硫붿냼??
??  ?붴?? dao/sqlmaps/maps/equipment-manager.xml     # iBATIS SQL 留?
?쒋?? system/cm/
??  ?붴?? web/CommonCodeManagementDelegate.java      # 怨듯넻肄붾뱶 愿由?
?붴?? statistics/equipment/
    ?붴?? web/EquipmentStatisticsDelegate.java       # ?듦퀎 議고쉶
```

**iBATIS 2.x 臾몃쾿** (MyBatis 3.x? ?ㅻ쫫):
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

### ?몄퐫???쒖빟?ы빆

**?덈? 洹쒖튃**: 紐⑤뱺 ?뚯씪? **EUC-KR ?몄퐫??*

```bash
# ?뚯씪 ?몄퐫???뺤씤
file -I equipment-manager.xml
# 異쒕젰: charset=euc-kr

# UTF-8 ??EUC-KR 蹂??(?꾩슂??
iconv -f UTF-8 -t EUC-KR input.xml > output.xml
```

**??EUC-KR?**
- ?덇굅???쒖뒪?쒖씠 2000?꾨? 珥덈컲 援ъ텞
- Oracle DB??EUC-KR ?ㅼ젙
- WebSphere ?쒕쾭??EUC-KR 湲곕낯媛?
- 蹂寃?遺덇???(?쒖뒪???꾩껜 ?곹뼢)

---

## ?뱚 ?꾨줈?앺듃 援ъ“

### ?꾩껜 ?붾젆?좊━ 援ъ“

```
/Users/bottle/bottle1/delive/dlive-json-api/
??
?쒋?? mobile-cona-front/               # ??Frontend (React 19)
??  ?쒋?? components/                  # 57媛?而댄룷?뚰듃
??  ??  ?쒋?? EquipmentStatusView.tsx  # ???꾨즺 (API ?곕룞)
??  ??  ?쒋?? EquipmentAssignment.tsx  # ?봽 吏꾪뻾以?(UI ?꾨즺, API 3媛??꾩슂)
??  ??  ?쒋?? EquipmentMovement.tsx    # ?봽 吏꾪뻾以?(UI ?꾨즺, API 1媛??꾩슂)
??  ??  ?붴?? EquipmentRecovery.tsx    # ?봽 吏꾪뻾以?(UI ?꾨즺, API 1媛??꾩슂)
??  ?쒋?? services/
??  ??  ?붴?? apiService.ts            # 3,253以? 紐⑤뱺 API ?⑥닔
??  ?쒋?? api-proxy.js                 # Express ?꾨줉???쒕쾭
??  ?쒋?? App.tsx                      # ?ㅻ퉬寃뚯씠??濡쒖쭅
??  ?붴?? package.json                 # ?섏〈??愿由?
??
?쒋?? adapter-build-deploy/            # ??Adapter (Java 6)
??  ?쒋?? common-src/src/              # Java ?뚯뒪
??  ?쒋?? build.xml                    # Ant 鍮뚮뱶
??  ?붴?? Dockerfile                   # Java 6 Docker
??
?쒋?? legacy-server/                   # ??Legacy (Java 6 + iBATIS)
??  ?붴?? src/com/cona/                # ?덇굅???뚯뒪
??
?쒋?? ?꾩뭅?대툕/                        # ?뱴 遺꾩꽍 ?먮즺
??  ?쒋?? TSYCM_CODE_DETAIL.xlsx       # 怨듯넻肄붾뱶 1,280媛?
??  ?쒋?? 湲곕뒫遺꾪빐??Ver0.7.xlsx         # ?꾩껜 湲곕뒫 紐낆꽭
??  ?쒋?? ?ъ뾽?섑뻾怨꾪쉷??docx            # ?쒖뒪???꾪궎?띿쿂
??  ?붴?? [遺꾩꽍 寃곌낵 臾몄꽌??
??
?붴?? [6媛?WBS CSV ?뚯씪]               # ?뱥 媛쒕컻 怨꾪쉷
    ?쒋?? ?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 ?λ퉬愿由?WBS.csv
    ?쒋?? ?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 ?묒뾽愿由?WBS.csv
    ?쒋?? ?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 怨좉컼愿由?WBS.csv
    ?쒋?? ?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 ?꾩옄泥?빟 WBS.csv
    ?쒋?? ?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 怨듯넻_湲고? WBS.csv
    ?붴?? ?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 ??쒕낫??WBS.csv
```

### ?듭떖 ?뚯씪 ?ㅻ챸

#### 1. mobile-cona-front/api-proxy.js (66以?

**??븷**: Express.js 湲곕컲 API ?꾨줉???쒕쾭

```javascript
// 二쇱슂 湲곕뒫
app.use('/api', createProxyMiddleware({
  target: 'http://58.143.140.222:8080',  // Legacy server
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    // Request logging
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
}));

// 66媛??붾뱶?ъ씤???먮룞 ?꾨줉??
// ?? /api/customer/* ??58.143.140.222:8080/api/customer/*
```

#### 2. mobile-cona-front/App.tsx (200以?

**??븷**: ?ㅻ퉬寃뚯씠??怨꾩링 援ъ“ 愿由?

**以묒슂 肄붾뱶** (?쇱씤 35-48):
```typescript
const NAVIGATION_HIERARCHY: Record<View, View | null> = {
  'today-work': null,              // 理쒖긽??
  'customer-management': 'today-work',
  'work-management': 'today-work',
  'equipment-management': 'today-work',  // ?λ퉬愿由?
  'signature-pad': 'work-management',
  'work-complete': 'work-management',
  'customer-detail': 'customer-management',
  // ... 珥?15媛?酉?
};

// ?ㅻ줈媛湲?濡쒖쭅
const handleBack = () => {
  const parentView = NAVIGATION_HIERARCHY[currentView];
  if (parentView) {
    setCurrentView(parentView);
  }
};
```

#### 3. mobile-cona-front/services/apiService.ts (3,253以?

**??븷**: 紐⑤뱺 API ?⑥닔 ?뺤쓽 諛??먮윭 泥섎━

**?듭떖 ?⑦꽩**:
```typescript
// Circuit Breaker ?⑦꽩
let failureCount = 0;
const MAX_FAILURES = 3;
const CIRCUIT_TIMEOUT = 30000;

const fetchWithRetry = async (url: string, options: RequestInit) => {
  if (failureCount >= MAX_FAILURES) {
    throw new Error('?쒕쾭 ?곌껐 ?ㅽ뙣. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.');
  }

  try {
    const response = await fetch(url, options);
    failureCount = 0;  // ?깃났 ??移댁슫??由ъ뀑
    return response;
  } catch (error) {
    failureCount++;
    throw error;
  }
};

// Request Deduplication (以묐났 ?붿껌 諛⑹?)
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

// API ?⑥닔 ?덉떆
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

#### 4. adapter-build-deploy/common-src/src/.../WorkApiController.java (2,746以?

**??븷**: JSON ??MiPlatform 蹂??+ API ?쇱슦??

**?듭떖 ?⑦꽩**:
```java
public class WorkApiController {
    // 66媛?API ?붾뱶?ъ씤?몃? if-else濡??쇱슦??

    public void service(HttpServletRequest request, HttpServletResponse response) {
        String uri = request.getRequestURI();

        // JSON ??MiPlatform Dataset 蹂??
        if (uri.endsWith("/getEquipmentHistoryInfo")) {
            handleGetEquipmentHistoryInfo(request, response);
        } else if (uri.endsWith("/getEquipmentOutList")) {
            handleGetEquipmentOutList(request, response);
        }
        // ... 64媛???
    }

    private void handleGetEquipmentHistoryInfo(
        HttpServletRequest request,
        HttpServletResponse response
    ) {
        try {
            // 1. Request Body ?쎄린 (JSON)
            String jsonBody = readRequestBody(request);
            JSONObject json = new JSONObject(jsonBody);

            // 2. MiPlatform Dataset ?앹꽦
            DataSet ds = new DataSet("ds_input");
            ds.addColumn("EQT_SERNO", DataTypes.STRING);
            ds.addColumn("MAC_ADDRESS", DataTypes.STRING);
            int row = ds.newRow();
            ds.set(row, "EQT_SERNO", json.optString("EQT_SERNO"));
            ds.set(row, "MAC_ADDRESS", json.optString("MAC_ADDRESS"));

            // 3. Legacy Server ?몄텧
            VariableList inVl = new VariableList();
            DataSetList inDl = new DataSetList();
            inDl.add(ds);

            DataSetList outDl = new DataSetList();

            // Spring Bean ?몄텧
            equipmentStatisticsDelegate.getEquipmentHistoryInfo(inVl, inDl, outDl);

            // 4. MiPlatform Dataset ??JSON 蹂??
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

            // 5. Response ?꾩넚
            response.setContentType("application/json; charset=UTF-8");
            response.getWriter().write(result.toString());

        } catch (Exception e) {
            handleError(response, e);
        }
    }
}
```

#### 5. legacy-server/.../EquipmentManagerDelegate.java (1,200以?

**??븷**: MiPlatform ?붿껌 泥섎━ 諛?Service ?몄텧

**?듭떖 ?⑦꽩**:
```java
public class EquipmentManagerDelegate extends ConaDelegate {

    // Spring DI (XML ?ㅼ젙)
    private EquipmentManagerService equipmentManagerService;

    public void setEquipmentManagerService(EquipmentManagerService service) {
        this.equipmentManagerService = service;
    }

    // ?λ퉬 議고쉶 ?몃뱾??(40+ 硫붿냼??以??섎굹)
    public void getEquipmentHistoryInfo(
        VariableList inVl,    // ?낅젰 蹂??
        DataSetList inDl,     // ?낅젰 Dataset
        DataSetList outDl     // 異쒕젰 Dataset
    ) throws Exception {

        // 1. Input Dataset ?뚯떛
        DataSet ds_input = inDl.get("ds_input");
        Map params = new HashMap();

        if (ds_input != null && ds_input.getRowCount() > 0) {
            params.put("EQT_SERNO", ds_input.getString(0, "EQT_SERNO"));
            params.put("MAC_ADDRESS", ds_input.getString(0, "MAC_ADDRESS"));
        }

        // 2. Service ?몄텧
        List resultList = equipmentManagerService.getEquipmentHistoryInfo(params);

        // 3. Output Dataset ?앹꽦
        DataSet ds_output = new DataSet("ds_output");

        // 75媛?而щ읆 ?뺤쓽 (?λ퉬 ?뺣낫 ?꾨뱶)
        ds_output.addColumn("SO_ID", DataTypes.STRING);
        ds_output.addColumn("SO_NM", DataTypes.STRING);
        ds_output.addColumn("EQT_MDL_NM", DataTypes.STRING);
        // ... 72媛???

        // 4. ?곗씠??梨꾩슦湲?
        for (int i = 0; i < resultList.size(); i++) {
            Map row = (Map) resultList.get(i);
            int newRow = ds_output.newRow();

            ds_output.set(newRow, "SO_ID", row.get("SO_ID"));
            ds_output.set(newRow, "SO_NM", row.get("SO_NM"));
            // ... 72媛???
        }

        // 5. Output??異붽?
        outDl.add(ds_output);
    }
}
```

#### 6. legacy-server/.../equipment-manager.xml (5,000以?

**??븷**: iBATIS SQL 留??뺤쓽

**?듭떖 ?⑦꽩**:
```xml
<?xml version="1.0" encoding="EUC-KR"?>
<!DOCTYPE sqlMap PUBLIC "-//iBATIS.com//DTD SQL Map 2.0//EN"
  "http://www.ibatis.com/dtd/sql-map-2.dtd">

<sqlMap namespace="EquipmentManager">

  <!-- ?λ퉬 議고쉶 荑쇰━ -->
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
      -- ... 62媛?而щ읆 ??
    FROM TB_EQT_INFO A
    WHERE 1=1
    <isNotEmpty property="EQT_SERNO">
      AND A.EQT_SERNO = #EQT_SERNO#
    </isNotEmpty>
    <isNotEmpty property="MAC_ADDRESS">
      AND A.MAC_ADDR = #MAC_ADDRESS#
    </isNotEmpty>
  </select>

  <!-- ?λ퉬 ?좊떦 議고쉶 荑쇰━ -->
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

## ?뱥 ?λ퉬愿由?湲곕뒫 紐낆꽭

### WBS ?꾩껜 紐⑸줉 (16媛?湲곕뒫)

**異쒖쿂**: `?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 ?λ퉬愿由?WBS.csv`

| ID | 湲곕뒫紐?| API 寃쎈줈 | ?대떦??| ?곹깭 | Phase | UI 而댄룷?뚰듃 | 怨듭닔(MD) |
|----|--------|----------|--------|------|-------|-------------|----------|
| EM-001 | 湲곗궗?좊떦 ?λ퉬 議고쉶 | `/customer/equipment/getEquipmentOutList.req` | TBD | 吏꾪뻾以?| Phase 2 | - | 3 |
| EM-002 | 湲곗궗?좊떦 ?λ퉬 ?뺤씤 | `/customer/equipment/getEquipmentProcYnCheck.req` | TBD | 吏꾪뻾以?| Phase 2 | - | 3 |
| EM-003 | 踰뺤씤?λ퉬 ?좊떦??異붽? | `/customer/equipment/addCorporationEquipmentQuota.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |
| **EM-004** | **湲곗궗 蹂댁쑀?λ퉬 議고쉶** | `/customer/equipment/getEquipmentReturnRequestList.req` | **議곗꽍??* | **吏꾪뻾以?* | **Phase 1** | **EquipmentAssignment.tsx (300以?** | **3** |
| EM-005 | 諛섎궔?붿껌 泥댄겕 | `/customer/equipment/getEquipmentReturnRequestCheck.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |
| EM-006 | 諛섎궔?붿껌 ?깅줉 | `/customer/equipment/addEquipmentReturnRequest.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |
| EM-007 | 湲곗궗 蹂댁쑀?λ퉬 議고쉶 (遺꾩떎) | `/customer/equipment/getWrkrHaveEqtList.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |
| EM-008 | ?λ퉬 遺꾩떎泥섎━ | `/customer/equipment/cmplEqtCustLossIndem.req` | TBD | 怨꾪쉷 | Phase 2 | - | 4 |
| EM-009 | 寃?щ?湲곗옣鍮??곹깭蹂寃?| `/customer/equipment/setEquipmentChkStndByY.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |
| **EM-010** | **?λ퉬 ?대젰 議고쉶** | `/statistics/equipment/getEquipmentHistoryInfo.req` | **議곗꽍??* | **???꾨즺** | **Phase 1** | **EquipmentStatusModal.tsx** | **3** |
| **EM-011** | **?λ퉬 ?묒뾽???닿? (?몄닔)** | `/customer/equipment/changeEqtWrkr_3.req` | **議곗꽍??* | **怨꾪쉷** | **Phase 1** | **EquipmentTransfer.tsx** | **4** |
| EM-012 | ?湲곗궗 議고쉶 | `/system/cm/getFindUsrList3.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |
| EM-013 | ?湲곗궗 蹂댁쑀?λ퉬 議고쉶 | `/customer/equipment/getWrkrHaveEqtList.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |
| EM-014 | ?湲곗궗?먭쾶 臾몄옄 諛쒖넚 | `/customer/sigtrans/saveENSSendHist.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |
| **EM-015** | **誘명쉶???λ퉬 議고쉶** | `/customer/work/getEquipLossInfo.req` | **議곗꽍??* | **吏꾪뻾以?* | **Phase 1** | **EquipmentRecovery.tsx (300以?** | **3** |
| EM-016 | 誘명쉶???λ퉬 ?뚯닔泥섎━ | `/customer/work/modEquipLoss.req` | TBD | 怨꾪쉷 | Phase 2 | - | 3 |

### Phase 1 ?곗꽑?쒖쐞 (?꾩옱 吏묒쨷)

#### ??EM-010: ?λ퉬 ?대젰 議고쉶 (?꾨즺)

**?뚯씪**: `mobile-cona-front/components/EquipmentStatusView.tsx`

**API**: `/statistics/equipment/getEquipmentHistoryInfo`

**援ы쁽 ?곹깭**:
- ??API ?곕룞 ?꾨즺
- ??濡쒕뵫 ?곹깭 異붽?
- ???먮윭 泥섎━ 異붽?
- ???낅젰 寃利?異붽?
- ??EC2 諛고룷 ?꾨즺

**肄붾뱶 ?꾩튂**: `apiService.ts` ?쇱씤 3028-3060

```typescript
// ?ъ슜 ?덉떆
const result = await getEquipmentHistoryInfo({
  EQT_SERNO: 'AB123456',
  MAC_ADDRESS: '00:11:22:33:44:55'
});

// Response: 75媛??꾨뱶 ?ы븿
// SO_NM, EQT_MDL_NM, EQT_TYPE_NM, EQT_STS_NM, ...
```

#### ?봽 EM-004: 湲곗궗 蹂댁쑀?λ퉬 議고쉶 (吏꾪뻾以?

**?뚯씪**: `mobile-cona-front/components/EquipmentAssignment.tsx` (300以?

**?꾩슂 API**: 3媛?

1. **getEquipmentOutList** (?쇱씤 97-100)
   - 異쒓퀬?쇱옄/吏?먮퀎 ?뚰듃?덉궗 異쒓퀬?꾪솴 議고쉶
   - Parameters: `OUT_DT`, `SO_ID`
   - Response: `OUT_REQ_NO`, `CORP_NM`, `OUT_QTY`, `REMAIN_QTY`

2. **getOutTargetEquipmentList** (?쇱씤 103-106)
   - 異쒓퀬踰덊샇蹂??λ퉬 由ъ뒪??議고쉶
   - Parameters: `OUT_REQ_NO`
   - Response: `EQT_SERNO`, `MAC_ADDR`, `EQT_MDL_NM`, `RCPT_YN`

3. **processEquipmentReceive** (?쇱씤 108-111)
   - ?좏깮???λ퉬 ?낃퀬 泥섎━
   - Parameters: `OUT_REQ_NO`, `EQT_SERNO_LIST[]`
   - Response: ?깃났/?ㅽ뙣 硫붿떆吏

**援ы쁽 諛⑸쾿**:
```typescript
// 1?④퀎: apiService.ts???⑥닔 異붽?
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

// 2?④퀎: EquipmentAssignment.tsx?먯꽌 ?몄텧
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

#### ?봽 EM-011: ?λ퉬 ?묒뾽???닿? (怨꾪쉷)

**?뚯씪**: `mobile-cona-front/components/EquipmentTransfer.tsx`

**?꾩슂 API**: 1媛?+ 紐⑤떖 而댄룷?뚰듃

1. **getEquipmentTransferList** (?쇱씤 96-99)
   - ?섏뿉寃??닿????λ퉬 議고쉶
   - Parameters: `WRKR_ID` (?섏쓽 ID)
   - Response: `EQT_SERNO`, `FROM_WRKR_NM`, `TRNS_DT`, `TRNS_STS_CD`

2. **Worker Search Modal** (?좉퇋 ?꾩슂)
   - ?湲곗궗 寃???앹뾽
   - API: `/system/cm/getFindUsrList3`
   - 湲곕뒫: 湲곗궗 ID濡?寃?????좏깮

#### ?봽 EM-015: 誘명쉶???λ퉬 議고쉶 (吏꾪뻾以?

**?뚯씪**: `mobile-cona-front/components/EquipmentRecovery.tsx` (147以?

**?꾩슂 API**: 1媛?

1. **getUnreturnedEquipmentList** (?쇱씤 50-52)
   - 吏??S/N/怨꾩빟ID蹂?誘명쉶???λ퉬 議고쉶
   - Parameters: `SO_ID`, `EQT_SERNO`, `CNTR_ID`
   - Response: `CUST_NM`, `ADDR`, `PHONE`, `EQT_SERNO`, `UNRETURNED_DAYS`

**援ы쁽 ?곗꽑?쒖쐞**: EM-004 ??EM-015 ??EM-011

---

## ?뵆 API ?곕룞 媛?대뱶

### API 異붽? 泥댄겕由ъ뒪??

?덈줈??API瑜?異붽??????ㅼ쓬 ?쒖꽌濡??묒뾽:

#### Step 1: Legacy Server?먯꽌 API ?뺤씤

**?뚯씪**: `legacy-server/src/com/cona/customer/equipment/web/EquipmentManagerDelegate.java`

```java
// API ?몃뱾??硫붿냼??李얘린
public void getEquipmentOutList(
    VariableList inVl,
    DataSetList inDl,
    DataSetList outDl
) throws Exception {
    // 援ы쁽 ?뺤씤
}
```

**?뺤씤?ы빆**:
- ??硫붿냼??議댁옱 ?щ?
- ??Input Dataset ?대쫫 (蹂댄넻 `ds_input`)
- ??Output Dataset ?대쫫 (蹂댄넻 `ds_output`)
- ???뚮씪誘명꽣 ?꾨뱶紐??뺤씤

#### Step 2: iBATIS SQL 留??뺤씤

**?뚯씪**: `legacy-server/src/com/cona/customer/equipment/dao/sqlmaps/maps/equipment-manager.xml`

```xml
<!-- SQL ID 李얘린 -->
<select id="getEquipmentOutList" resultClass="HashMap" parameterClass="HashMap">
  SELECT
    A.OUT_REQ_NO,
    A.OUT_DT,
    -- ... ?꾨뱶 紐⑸줉 ?뺤씤
  FROM TB_EQT_OUT_REQ A
  WHERE 1=1
  <isNotEmpty property="OUT_DT">
    AND A.OUT_DT = #OUT_DT#
  </isNotEmpty>
</select>
```

**?뺤씤?ы빆**:
- ???뚮씪誘명꽣 ?꾨뱶紐?(property 媛?
- ???묐떟 ?꾨뱶 紐⑸줉 (SELECT ??
- ???숈쟻 議곌굔 (`<isNotEmpty>`, `<isNotEqual>` ??

#### Step 3: Adapter???쇱슦??異붽?

**?뚯씪**: `adapter-build-deploy/common-src/src/com/company/api/controller/WorkApiController.java`

```java
// service() 硫붿냼?쒖뿉 if-else 異붽?
public void service(HttpServletRequest request, HttpServletResponse response) {
    String uri = request.getRequestURI();

    // 湲곗〈 肄붾뱶...

    // ?덈줈??API 異붽?
    else if (uri.endsWith("/getEquipmentOutList")) {
        handleGetEquipmentOutList(request, response);
    }
}

// ?몃뱾??硫붿냼??援ы쁽
private void handleGetEquipmentOutList(
    HttpServletRequest request,
    HttpServletResponse response
) {
    try {
        // 1. JSON ??MiPlatform Dataset
        String jsonBody = readRequestBody(request);
        JSONObject json = new JSONObject(jsonBody);

        DataSet ds = new DataSet("ds_input");
        ds.addColumn("OUT_DT", DataTypes.STRING);
        ds.addColumn("SO_ID", DataTypes.STRING);
        int row = ds.newRow();
        ds.set(row, "OUT_DT", json.optString("OUT_DT"));
        ds.set(row, "SO_ID", json.optString("SO_ID"));

        // 2. Legacy ?몄텧
        VariableList inVl = new VariableList();
        DataSetList inDl = new DataSetList();
        inDl.add(ds);
        DataSetList outDl = new DataSetList();

        equipmentManagerDelegate.getEquipmentOutList(inVl, inDl, outDl);

        // 3. MiPlatform Dataset ??JSON
        DataSet outDs = outDl.get("ds_output");
        JSONArray result = datasetToJSON(outDs);  // ?좏떥 ?⑥닔 ?ъ슜

        // 4. Response
        response.setContentType("application/json; charset=UTF-8");
        response.getWriter().write(result.toString());

    } catch (Exception e) {
        handleError(response, e);
    }
}
```

**Java 6 二쇱쓽?ы빆**:
- ??`List<String>` ?ъ슜 遺덇? ??`List` ?ъ슜
- ??Try-with-resources 遺덇? ??finally 釉붾줉 ?ъ슜
- ??EUC-KR ?몄퐫???좎?

#### Step 4: Adapter 鍮뚮뱶 & 諛고룷

```bash
cd /Users/bottle/bottle1/delive/dlive-json-api/adapter-build-deploy

# 1. Ant 鍮뚮뱶
ant clean build

# 2. Docker ?대?吏 鍮뚮뱶
docker build -t dlive-adapter:latest .

# 3. 而⑦뀒?대꼫 ?ъ떆??
docker-compose restart adapter

# 4. 濡쒓렇 ?뺤씤
docker logs -f dlive-adapter
```

#### Step 5: Frontend API ?⑥닔 異붽?

**?뚯씪**: `mobile-cona-front/services/apiService.ts`

```typescript
// TypeScript ?명꽣?섏씠???뺤쓽
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

// API ?⑥닔 異붽? (?뚯씪 ?앹뿉)
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
      throw new Error(`API ?몄텧 ?ㅽ뙣: ${response.status}`);
    }

    return await response.json();
  });
};
```

#### Step 6: React 而댄룷?뚰듃?먯꽌 ?ъ슜

**?뚯씪**: `mobile-cona-front/components/EquipmentAssignment.tsx`

```typescript
import { getEquipmentOutList } from '../services/apiService';

const EquipmentAssignment = () => {
  const [eqtOutList, setEqtOutList] = useState<EquipmentOutInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchParams.outDate) {
      setError('異쒓퀬?쇱옄瑜??좏깮?댁＜?몄슂.');
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
        setError('議고쉶??異쒓퀬 ?댁뿭???놁뒿?덈떎.');
      }
    } catch (err: any) {
      setError(err.message || '?λ퉬 議고쉶???ㅽ뙣?덉뒿?덈떎.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      <button onClick={handleSearch} disabled={isLoading}>
        {isLoading ? '議고쉶 以?..' : '議고쉶'}
      </button>

      {eqtOutList.map(item => (
        <div key={item.OUT_REQ_NO}>
          {item.CORP_NM} - {item.REMAIN_QTY}媛??⑥쓬
        </div>
      ))}
    </div>
  );
};
```

### API ?뚯뒪??諛⑸쾿

#### 1. 釉뚮씪?곗? 媛쒕컻???꾧뎄

```javascript
// Console?먯꽌 吏곸젒 ?뚯뒪??
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

#### 2. cURL 紐낅졊??

```bash
# Local ?뚯뒪??
curl -X POST http://localhost:3000/api/customer/equipment/getEquipmentOutList \
  -H "Content-Type: application/json" \
  -d '{"OUT_DT":"20250128","SO_ID":"SO001"}'

# EC2 ?뚯뒪??
curl -X POST http://52.63.232.141/api/customer/equipment/getEquipmentOutList \
  -H "Content-Type: application/json" \
  -d '{"OUT_DT":"20250128","SO_ID":"SO001"}'
```

#### 3. Demo Mode ?쒖슜

```javascript
// localStorage???붾? ?곗씠?????
localStorage.setItem('demoMode', 'true');
localStorage.setItem('demoData_getEquipmentOutList', JSON.stringify([
  {
    OUT_REQ_NO: 'OUT202501280001',
    OUT_DT: '20250128',
    SO_NM: '?쒖슱吏??,
    CORP_NM: '?뚰듃?덉궗A',
    OUT_QTY: 50,
    RCPT_QTY: 30,
    REMAIN_QTY: 20
  }
]));

// ?댁젣 API ?몄텧 ???붾? ?곗씠??諛섑솚??
```

### 怨듯넻 ?먮윭 泥섎━ ?⑦꽩

```typescript
// apiService.ts???대? 援ы쁽???⑦꽩

// 1. Network ?먮윭
try {
  const response = await fetch(url, options);
} catch (error) {
  if (error instanceof TypeError) {
    throw new Error('?ㅽ듃?뚰겕 ?곌껐???뺤씤?댁＜?몄슂.');
  }
  throw error;
}

// 2. HTTP ?먮윭
if (!response.ok) {
  if (response.status === 404) {
    throw new Error('API瑜?李얠쓣 ???놁뒿?덈떎.');
  } else if (response.status === 500) {
    throw new Error('?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
  }
  throw new Error(`API ?몄텧 ?ㅽ뙣: ${response.status}`);
}

// 3. JSON ?뚯떛 ?먮윭
try {
  const data = await response.json();
  return data;
} catch (error) {
  throw new Error('?묐떟 ?곗씠???뺤떇???щ컮瑜댁? ?딆뒿?덈떎.');
}

// 4. 鍮꾩쫰?덉뒪 濡쒖쭅 ?먮윭
if (data.ERROR_CODE) {
  throw new Error(data.ERROR_MESSAGE || '泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
}
```

---

## ?? 媛쒕컻 ?뚰겕?뚮줈??

### Git 釉뚮옖移??꾨왂

```bash
# 1. Main 釉뚮옖移?理쒖떊??
git checkout main
git pull teamart main

# 2. Feature 釉뚮옖移??앹꽦
git checkout -b jsh/equipment-feature-name
# ?? jsh/equipment-assignment-api

# 3. ?묒뾽 吏꾪뻾
# - ?뚯씪 ?섏젙
# - ?뚯뒪??

# 4. Commit
git add .
git commit -m "feat: ?λ퉬 ?좊떦 API ?곕룞 ?꾨즺

- getEquipmentOutList API 異붽?
- EquipmentAssignment 而댄룷?뚰듃 ?곕룞
- 濡쒕뵫 ?곹깭 諛??먮윭 泥섎━ 異붽?

?쨼 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 5. Push
git push origin jsh/equipment-feature-name --force-with-lease

# 6. PR ?앹꽦
gh pr create --title "feat: ?λ퉬 ?좊떦 API ?곕룞" --body "$(cat <<'EOF'
## ?뱥 ?묒뾽 ?댁슜
?λ퉬 ?좊떦 議고쉶 湲곕뒫 援ы쁽

## ??援ы쁽 湲곕뒫
- getEquipmentOutList API ?곕룞
- 異쒓퀬?쇱옄/吏?먮퀎 議고쉶
- 濡쒕뵫 ?ㅽ뵾??異붽?
- ?먮윭 硫붿떆吏 ?쒖떆

## ?㎦ ?뚯뒪??諛⑸쾿
1. ?λ퉬愿由?> ?λ퉬?좊떦/諛섎궔 ??
2. 異쒓퀬?쇱옄 ?좏깮
3. 議고쉶 踰꾪듉 ?대┃

## ?뱷 蹂寃??뚯씪
- services/apiService.ts (+50)
- components/EquipmentAssignment.tsx (+30, -10)

?쨼 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

# 7. PR Merge (GitHub ?뱀뿉???뱀씤 ??

# 8. Main 釉뚮옖移??낅뜲?댄듃
git checkout main
git pull teamart main

# 9. Feature 釉뚮옖移???젣
git branch -d jsh/equipment-feature-name
git push origin --delete jsh/equipment-feature-name
```

### 濡쒖뺄 媛쒕컻 ?섍꼍 ?ㅼ젙

```bash
# 1. ?꾨줈?앺듃 ?대줎 (?대? ?꾨즺)
cd /Users/bottle/bottle1/delive/dlive-json-api/mobile-cona-front

# 2. ?섏〈???ㅼ튂
npm install

# 3. 媛쒕컻 ?쒕쾭 ?ㅽ뻾
npm run dev
# ??http://localhost:3000

# 4. 蹂꾨룄 ?곕??먯뿉??API ?꾨줉???ㅽ뻾
node api-proxy.js
# ??http://localhost:3000/api/* ??58.143.140.222:8080/api/*

# 5. 釉뚮씪?곗??먯꽌 ?뺤씤
open http://localhost:3000
```

### Demo Mode ?쒖슜

```javascript
// 釉뚮씪?곗? Console?먯꽌 ?ㅽ뻾

// 1. Demo Mode ?쒖꽦??
localStorage.setItem('demoMode', 'true');

// 2. ?ъ슜???뺣낫 ?ㅼ젙
localStorage.setItem('userInfo', JSON.stringify({
  USR_ID: 'TEST_USER',
  USR_NM: '?뚯뒪?멸린??,
  SO_ID: 'SO001',
  SO_NM: '?쒖슱吏??,
  AUTH_SO_List: [
    { SO_ID: 'SO001', SO_NM: '?쒖슱吏?? },
    { SO_ID: 'SO002', SO_NM: '遺?곗??? }
  ]
}));

// 3. ?λ퉬 議고쉶 ?붾? ?곗씠??
localStorage.setItem('demoData_getEquipmentHistoryInfo', JSON.stringify([
  {
    EQT_SERNO: 'AB123456',
    MAC_ADDR: '00:11:22:33:44:55',
    SO_NM: '?쒖슱吏??,
    EQT_MDL_NM: 'STB-2000',
    EQT_TYPE_NM: '?뗮넲諛뺤뒪',
    EQT_STS_NM: '?뺤긽',
    USE_POSBL_YN: 'Y',
    FRST_RCPT_DT: '2025-01-15',
    CUR_LOC_NM: '?묒뾽湲곗궗',
    BEF_LOC_NM: '李쎄퀬'
    // ... ?섎㉧吏 65媛??꾨뱶
  }
]));

// 4. ?섏씠吏 ?덈줈怨좎묠
location.reload();
```

### 肄붾뱶 ?덉쭏 泥댄겕

```bash
# 1. TypeScript ???泥댄겕
npm run type-check

# 2. ESLint 寃??
npm run lint

# 3. 鍮뚮뱶 ?뚯뒪??
npm run build

# 4. 鍮뚮뱶 寃곌낵 ?꾨━酉?
npm run preview
# ??http://localhost:4173
```

---

## ?슓 諛고룷 ?꾨줈?몄뒪

### EC2 ?쒕쾭 ?뺣낫

| ??ぉ | 媛?|
|------|-----|
| IP | 52.63.232.141 |
| OS | Ubuntu 22.04 |
| SSH ?ъ슜??| ubuntu |
| 諛고룷 ?붾젆?좊━ | /home/ubuntu/dlive-cona-client |
| PM2 ?꾨줈?몄뒪紐?| dlive |
| ?묒냽 URL | http://52.63.232.141/ |

### 諛고룷 ?쒖꽌

#### Step 1: PR Merge ?뺤씤

```bash
# GitHub?먯꽌 PR Merge ?꾨즺 ?뺤씤
# ??https://github.com/teemartbottle/dlive-cona-client/pulls

# 濡쒖뺄 main ?낅뜲?댄듃
git checkout main
git pull teamart main
```

#### Step 2: EC2 SSH ?묒냽

```bash
# SSH ??沅뚰븳 ?ㅼ젙 (理쒖큹 1??
chmod 600 /path/to/ec2_key.pem

# SSH ?묒냽
ssh -i /path/to/ec2_key.pem ubuntu@52.63.232.141

# ?먮뒗 ???깅줉 ??
ssh ubuntu@52.63.232.141
```

#### Step 3: 諛고룷 ?ㅽ겕由쏀듃 ?ㅽ뻾

```bash
# 諛고룷 ?붾젆?좊━濡??대룞
cd /home/ubuntu/dlive-cona-client

# 諛고룷 ?ㅽ겕由쏀듃 ?ㅽ뻾
bash /tmp/ec2_deploy.sh

# ?먮뒗 ?섎룞 諛고룷
git pull origin main
npm install  # ?섏〈??蹂寃??쒕쭔
npm run build
pm2 restart dlive
pm2 logs dlive --lines 20
```

**諛고룷 ?ㅽ겕由쏀듃 ?댁슜** (`/tmp/ec2_deploy.sh`):
```bash
#!/bin/bash
echo "?? EC2 諛고룷 ?쒖옉..."

# 1. 理쒖떊 肄붾뱶 媛?몄삤湲?
git pull origin main

# 2. 鍮뚮뱶
npm run build

# 3. PM2 ?ъ떆??
pm2 restart dlive

# 4. 濡쒓렇 ?뺤씤
pm2 logs dlive --lines 20 --nostream

echo "??諛고룷 ?꾨즺!"
echo "?뙋 http://52.63.232.141/"
```

#### Step 4: 諛고룷 寃利?

```bash
# 1. PM2 ?곹깭 ?뺤씤
pm2 status
# dlive媛 online ?곹깭?ъ빞 ??

# 2. 濡쒓렇 ?뺤씤
pm2 logs dlive --lines 50

# 3. ?ы듃 ?뺤씤
sudo netstat -tlnp | grep 80
# 0.0.0.0:80 LISTEN ?곹깭?ъ빞 ??
```

#### Step 5: 釉뚮씪?곗? ?뚯뒪??

```
1. http://52.63.232.141/ ?묒냽
2. ?λ퉬愿由?硫붾돱 ?대┃
3. 援ы쁽??湲곕뒫 ?뚯뒪??
   - ?λ퉬?곹깭議고쉶 ??
   - S/N ?먮뒗 MAC ?낅젰
   - 議고쉶 踰꾪듉 ?대┃
4. 寃곌낵 ?뺤씤
   - ??濡쒕뵫 ?ㅽ뵾???쒖떆
   - ???λ퉬 ?뺣낫 75媛??꾨뱶 ?쒖떆
   - ???먮윭 ??鍮④컙 硫붿떆吏
```

### 諛고룷 濡ㅻ갚 (臾몄젣 諛쒖깮 ??

```bash
# 1. ?댁쟾 而ㅻ컠?쇰줈 ?섎룎由ш린
cd /home/ubuntu/dlive-cona-client
git log --oneline -5  # 理쒓렐 5媛?而ㅻ컠 ?뺤씤
git reset --hard <?댁쟾_而ㅻ컠_?댁떆>

# 2. ?щ같??
npm run build
pm2 restart dlive

# 3. ?뺤씤
pm2 logs dlive --lines 20
```

### PM2 ?좎슜??紐낅졊??

```bash
# ?ㅼ떆媛?濡쒓렇 蹂닿린
pm2 logs dlive

# 濡쒓렇 珥덇린??
pm2 flush

# ?꾨줈?몄뒪 ?ъ떆??
pm2 restart dlive

# ?꾨줈?몄뒪 以묒?
pm2 stop dlive

# ?꾨줈?몄뒪 ?쒖옉
pm2 start dlive

# ?곹깭 ?뺤씤
pm2 status

# 紐⑤땲?곕쭅
pm2 monit

# 硫붾え由??ъ슜???뺤씤
pm2 show dlive
```

---

## ?뵇 ?몃윭釉붿뒋??

### 臾몄젣 1: API ?몄텧 ?ㅽ뙣

**利앹긽**:
```
Error: Failed to fetch
Network Error
```

**?먯씤**:
1. API ?꾨줉???쒕쾭 誘몄떎??
2. Legacy ?쒕쾭 ?ㅼ슫
3. CORS ?먮윭

**?닿껐**:
```bash
# 1. API ?꾨줉???뺤씤
ps aux | grep api-proxy
# ?놁쑝硫??ㅽ뻾
node api-proxy.js &

# 2. Legacy ?쒕쾭 ping ?뚯뒪??
ping 58.143.140.222

# 3. cURL ?뚯뒪??
curl -X POST http://localhost:3000/api/customer/equipment/getEquipmentHistoryInfo \
  -H "Content-Type: application/json" \
  -d '{"EQT_SERNO":"TEST"}'
```

### 臾몄젣 2: 鍮뚮뱶 ?ㅽ뙣

**利앹긽**:
```
Type error: Property 'XXX' does not exist on type 'YYY'
```

**?먯씤**: TypeScript ???遺덉씪移?

**?닿껐**:
```typescript
// 1. ?명꽣?섏씠???뺤쓽 異붽?
interface EquipmentInfo {
  EQT_SERNO: string;
  MAC_ADDR: string;
  // ... 紐⑤뱺 ?꾨뱶 ?뺤쓽
}

// 2. Optional Chaining ?ъ슜
const value = data?.field ?? '湲곕낯媛?;

// 3. Type Assertion (理쒗썑 ?섎떒)
const typedData = data as EquipmentInfo;
```

### 臾몄젣 3: EC2 諛고룷 ??鍮??붾㈃

**利앹긽**: http://52.63.232.141/ ?묒냽 ??鍮??붾㈃

**?먯씤**:
1. 鍮뚮뱶 ?뚯씪 誘몄깮??
2. PM2 ?꾨줈?몄뒪 以묒?
3. Nginx/Express ?ㅼ젙 ?ㅻ쪟

**?닿껐**:
```bash
# 1. 鍮뚮뱶 ?뚯씪 ?뺤씤
ls -la /home/ubuntu/dlive-cona-client/dist/
# index.html, assets/ 議댁옱?댁빞 ??

# 2. PM2 ?곹깭 ?뺤씤
pm2 status
pm2 logs dlive --lines 100

# 3. ?ы듃 ?뺤씤
sudo netstat -tlnp | grep 80

# 4. ?щ퉴??& ?ъ떆??
npm run build
pm2 restart dlive
pm2 logs dlive
```

### 臾몄젣 4: localStorage ?곗씠???좎떎

**利앹긽**: 濡쒓렇?????덈줈怨좎묠 ??濡쒓렇?꾩썐??

**?먯씤**: localStorage ????꾨씫

**?닿껐**:
```typescript
// Login.tsx?먯꽌 ?뺤씤
const handleLogin = async () => {
  const response = await login(userId, password);

  // ??諛섎뱶?????
  localStorage.setItem('userInfo', JSON.stringify(response.data));
  localStorage.setItem('branchList', JSON.stringify(response.data.AUTH_SO_List));

  // ????????섎㈃ ?덈줈怨좎묠 ???좎떎??
};

// App.tsx?먯꽌 蹂듭썝
useEffect(() => {
  const storedUser = localStorage.getItem('userInfo');
  if (storedUser) {
    setUserInfo(JSON.parse(storedUser));
  }
}, []);
```

### 臾몄젣 5: Java 6 鍮뚮뱶 ?먮윭

**利앹긽**:
```
error: cannot find symbol - class ArrayList<String>
```

**?먯씤**: Generic ?ъ슜

**?닿껐**:
```java
// ??遺덇???
List<String> list = new ArrayList<String>();

// ???섏젙
List list = new ArrayList();
String item = (String) list.get(0);

// ??遺덇???
for (String item : list) { }

// ???섏젙
for (Iterator it = list.iterator(); it.hasNext();) {
    String item = (String) it.next();
}
```

### 臾몄젣 6: EUC-KR ?몄퐫??源⑥쭚

**利앹긽**: ?쒓???"??" ?먮뒗 "?곥뀅??濡??쒖떆

**?먯씤**: ?뚯씪 ?몄퐫??遺덉씪移?

**?닿껐**:
```bash
# 1. ?뚯씪 ?몄퐫???뺤씤
file -I equipment-manager.xml

# 2. UTF-8 ??EUC-KR 蹂??
iconv -f UTF-8 -t EUC-KR input.xml > output.xml

# 3. Ant 鍮뚮뱶 ???몄퐫??吏??
ant -Dfile.encoding=EUC-KR build
```

### 臾몄젣 7: iBATIS SQL 臾몃쾿 ?먮윭

**利앹긽**:
```
There is no parameter map named 'XXX'
```

**?먯씤**: MyBatis 3.x 臾몃쾿 ?ъ슜

**?닿껐**:
```xml
<!-- ??MyBatis 3.x 臾몃쾿 -->
<select id="test" parameterType="HashMap" resultType="HashMap">
  SELECT * FROM TB WHERE ID = #{id}
</select>

<!-- ??iBATIS 2.x 臾몃쾿 -->
<select id="test" parameterClass="HashMap" resultClass="HashMap">
  SELECT * FROM TB WHERE ID = #id#
</select>

<!-- ??<if test=""> -->
<if test="id != null">
  AND ID = #{id}
</if>

<!-- ??<isNotEmpty property=""> -->
<isNotEmpty property="id">
  AND ID = #id#
</isNotEmpty>
```

### 臾몄젣 8: 吏??紐⑸줉 濡쒕뱶 ?ㅽ뙣

**利앹긽**: 吏???좏깮 ?쒕∼?ㅼ슫 鍮??곹깭

**?닿껐**:
```typescript
// ???섎せ??諛⑸쾿 - 蹂꾨룄 API ?몄텧
const branchList = await getBranchList();

// ???щ컮瑜?諛⑸쾿 - 濡쒓렇???묐떟?먯꽌 媛?몄삤湲?
const loginResponse = await login(userId, password);
const branchList = loginResponse.data.AUTH_SO_List;

// localStorage?????
localStorage.setItem('branchList', JSON.stringify(branchList));

// 而댄룷?뚰듃?먯꽌 ?ъ슜
const storedBranches = localStorage.getItem('branchList');
if (storedBranches) {
  setSoList(JSON.parse(storedBranches));
}
```

---

## ?뱴 李멸퀬 ?먮즺

### 怨듯넻 肄붾뱶 (TSYCM_CODE_DETAIL)

**珥?1,280媛?肄붾뱶 洹몃９** - ?먯＜ ?ъ슜?섎뒗 肄붾뱶:

| 洹몃９ 肄붾뱶 | 洹몃９紐?| 二쇱슂 肄붾뱶 | ?ㅻ챸 |
|-----------|--------|-----------|------|
| EQT_MDL | ?λ퉬紐⑤뜽 | STB2000, MODEM500 | ?λ퉬 紐⑤뜽 援щ텇 |
| EQT_TYPE | ?λ퉬?좏삎 | 10(?뗮넲諛뺤뒪), 20(紐⑤?) | ?λ퉬 ?좏삎 |
| EQT_STS | ?λ퉬?곹깭 | 10(?ш퀬), 20(?ъ슜以?, 30(遺꾩떎) | ?λ퉬 ?곹깭 |
| EQT_LOC_TYPE | ?λ퉬?꾩튂?좏삎 | 1(李쎄퀬), 2(吏??, 3(?묒뾽湲곗궗) | ?λ퉬 ?꾩튂 |
| WORK_TYPE | ?묒뾽?좏삎 | 10(?ㅼ튂), 20(AS), 30(?댁?) | ?묒뾽 援щ텇 |
| SO | 吏??| SO001, SO002 | 吏??肄붾뱶 |

**?ъ슜 ?덉떆**:
```typescript
// 肄붾뱶 ??紐낆묶 蹂??
const getCodeName = (grpCd: string, cd: string): string => {
  // API: /system/cm/getCodeDetail
  // ?먮뒗 localStorage??罹먯떛
  const codeMap = JSON.parse(localStorage.getItem('commonCodes') || '{}');
  return codeMap[grpCd]?.[cd] || cd;
};

// ?λ퉬 ?곹깭 ?쒖떆
const statusName = getCodeName('EQT_STS', '10');  // "?ш퀬"
```

### ?ㅻ퉬寃뚯씠??怨꾩링 援ъ“

```
today-work (?ㅻ뒛 ?묒뾽)
?쒋?? customer-management (怨좉컼 愿由?
??  ?붴?? customer-detail (怨좉컼 ?곸꽭)
?쒋?? work-management (?묒뾽 愿由?
??  ?쒋?? signature-pad (?쒕챸)
??  ?붴?? work-complete (?묒뾽 ?꾨즺)
?붴?? equipment-management (?λ퉬 愿由?  ???꾩옱 ?묒뾽 以?
    ?쒋?? equipment-status (?λ퉬 ?곹깭 議고쉶)     ???꾨즺
    ?쒋?? equipment-assignment (?λ퉬 ?좊떦/諛섎궔)  ?봽 吏꾪뻾以?
    ?쒋?? equipment-movement (湲곗궗媛??대룞)       ?봽 怨꾪쉷
    ?붴?? equipment-recovery (誘명쉶???뚯닔)       ?봽 吏꾪뻾以?
```

### ?꾨줈?앺듃 二쇱슂 留덉씪?ㅽ넠

| ?좎쭨 | ?댁슜 | ?곹깭 |
|------|------|------|
| 2025-01-20 | ?꾨줈?앺듃 ?쒖옉, ?꾪궎?띿쿂 遺꾩꽍 | ???꾨즺 |
| 2025-01-25 | EM-010 ?λ퉬 ?곹깭 議고쉶 援ы쁽 | ???꾨즺 |
| 2025-01-28 | ?꾩뭅?대툕 遺꾩꽍, COMPREHENSIVE_GUIDE ?묒꽦 | ???꾨즺 |
| 2025-01-30 (?덉젙) | EM-004 ?λ퉬 ?좊떦 API ?곕룞 | ?봽 吏꾪뻾 ?덉젙 |
| 2025-02-05 (?덉젙) | EM-015 誘명쉶???λ퉬 議고쉶 | ?봽 怨꾪쉷 |
| 2025-02-10 (?덉젙) | EM-011 ?λ퉬 ?닿? 湲곕뒫 | ?봽 怨꾪쉷 |
| 2025-02-28 (?덉젙) | Phase 1 ?꾨즺 | ?렞 紐⑺몴 |

---

## ?렞 利됱떆 ?쒖옉 媛?ν븳 ?묒뾽

### ?곗꽑?쒖쐞 1: EM-004 ?λ퉬 ?좊떦 API ?곕룞

**?덉긽 ?뚯슂 ?쒓컙**: 2-3?쒓컙

**?묒뾽 ?쒖꽌**:
1. ??Legacy Server 肄붾뱶 ?뺤씤 (?대? 議댁옱)
2. ??Adapter???쇱슦??異붽? (?쒗뵆由?以鍮꾨맖)
3. ??apiService.ts???⑥닔 3媛?異붽?
4. ??EquipmentAssignment.tsx TODO ?쒓굅
5. ??濡쒖뺄 ?뚯뒪??
6. ??PR ?앹꽦 & Merge
7. ??EC2 諛고룷
8. ??釉뚮씪?곗? ?뚯뒪??

**?꾩슂 ?뚯씪**:
- `adapter-build-deploy/common-src/src/.../WorkApiController.java`
- `mobile-cona-front/services/apiService.ts`
- `mobile-cona-front/components/EquipmentAssignment.tsx`

### ?곗꽑?쒖쐞 2: EM-015 誘명쉶???λ퉬 議고쉶

**?덉긽 ?뚯슂 ?쒓컙**: 1?쒓컙

**?묒뾽 ?쒖꽌**:
1. ??API ?⑥닔 1媛쒕쭔 異붽?
2. ??EquipmentRecovery.tsx TODO ?쒓굅
3. ???뚯뒪??& 諛고룷

### ?곗꽑?쒖쐞 3: .claude/instructions.md ?앹꽦

**?덉긽 ?뚯슂 ?쒓컙**: 30遺?

**紐⑹쟻**: ?덈줈??Claude Code ?몄뀡 ?쒖옉 ???먮룞 濡쒕뱶

**?댁슜**:
- ?꾨줈?앺듃 媛쒖슂
- Java 6 ?쒖빟?ы빆
- ?λ퉬愿由?以묒젏
- ?먯＜ ?ъ슜?섎뒗 紐낅졊??

---

## ?뮕 ?좎슜??紐낅졊??紐⑥쓬

### Git 愿??
```bash
# ?꾩옱 釉뚮옖移??뺤씤
git branch

# Main 理쒖떊??
git checkout main && git pull teamart main

# Feature 釉뚮옖移??앹꽦
git checkout -b jsh/feature-name

# 蹂寃쎌궗???뺤씤
git status
git diff

# Commit
git add .
git commit -m "feat: 湲곕뒫 ?ㅻ챸"

# Push
git push origin jsh/feature-name --force-with-lease

# PR ?앹꽦
gh pr create --title "?쒕ぉ" --body "?댁슜"

# Merge ???뺣━
git checkout main && git pull teamart main && git branch -d jsh/feature-name
```

### NPM 愿??
```bash
# ?섏〈???ㅼ튂
npm install

# 媛쒕컻 ?쒕쾭
npm run dev

# 鍮뚮뱶
npm run build

# ???泥댄겕
npm run type-check

# Lint
npm run lint

# ?꾨━酉?
npm run preview
```

### EC2 愿??
```bash
# SSH ?묒냽
ssh ubuntu@52.63.232.141

# 諛고룷
cd /home/ubuntu/dlive-cona-client
git pull origin main
npm run build
pm2 restart dlive

# 濡쒓렇 ?뺤씤
pm2 logs dlive

# ?곹깭 ?뺤씤
pm2 status

# ?ы듃 ?뺤씤
sudo netstat -tlnp | grep 80
```

### Java/Adapter 鍮뚮뱶
```bash
# Adapter 鍮뚮뱶
cd /Users/bottle/bottle1/delive/dlive-json-api/adapter-build-deploy
ant clean build

# Docker 鍮뚮뱶 (?꾩슂 ??
docker build -t dlive-adapter:latest .

# 而⑦뀒?대꼫 ?ъ떆??
docker-compose restart adapter

# 濡쒓렇 ?뺤씤
docker logs -f dlive-adapter
```

---

## ?뱸 吏??諛?臾몄꽌

### GitHub Repository
- **Frontend**: https://github.com/teemartbottle/dlive-cona-client
- **Branch ?꾨왂**: main (production) / jsh/* (feature branches)

### ?쒕쾭 ?뺣낫
- **EC2 IP**: 52.63.232.141
- **Legacy Server**: 58.143.140.222:8080
- **Demo URL**: http://52.63.232.141/

### ?대떦??
- **?λ퉬愿由??뚰듃**: 議곗꽍??
- **Phase 1 湲곕뒫**: EM-010, EM-004, EM-011, EM-015

---

## ?봽 臾몄꽌 ?낅뜲?댄듃 ?대젰

| ?좎쭨 | 踰꾩쟾 | ?댁슜 |
|------|------|------|
| 2025-01-28 | 1.0 | 珥덇린 臾몄꽌 ?앹꽦 (?꾩껜 遺꾩꽍 ?듯빀) |

---

**??臾몄꽌濡??덈줈??Claude Code ?몄뒪?댁뒪媛 ?꾨줈?앺듃 ?꾩껜瑜??댄빐?섍퀬 利됱떆 媛쒕컻 ?쒖옉 媛?ν빐???⑸땲??**

**吏덈Ц?대굹 遺덈챸?뺥븳 遺遺꾩씠 ?덉쑝硫???臾몄꽌瑜?癒쇱? 李몄“?섏꽭??**
