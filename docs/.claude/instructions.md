# D-Live Equipment Management - Claude Code Instructions

> **以묒슂**: ???뚯씪? ?꾨줈?앺듃 ?쒖옉 ???먮룞?쇰줈 濡쒕뱶?⑸땲??
> ?꾩껜 臾몄꽌??`/COMPREHENSIVE_GUIDE.md`瑜?李몄“?섏꽭??

---

## ?렞 ?꾨줈?앺듃 媛쒖슂

**D-Live ?λ퉬愿由??쒖뒪??* - ?덇굅??MiPlatform ?쒖뒪?쒖쓣 React 湲곕컲?쇰줈 留덉씠洹몃젅?댁뀡

- **Frontend**: React 19 + TypeScript (mobile-cona-front/)
- **Adapter**: Java 6 + Spring 2.x (adapter-build-deploy/)
- **Legacy**: Java 6 + iBATIS 2.x (legacy-server/)
- **?꾩옱 ?묒뾽**: ?λ퉬愿由??뚰듃 Phase 1 援ы쁽

---

## ?슚 ?덈? 以???ы빆

### 0. 媛쒕컻/?뚯뒪???꾩닔 洹쒖튃 (CRITICAL - 理쒖슦??)

**??濡쒖뺄 媛쒕컻?쒕쾭 ?ъ슜 ?덈? 湲덉?!**
```
- npm run dev (localhost:3000) ?덈? ?ъ슜 湲덉?!
- 濡쒖뺄?먯꽌 API ?뚯뒪???덈? 湲덉?!
- curl localhost:3000 媛숈? 濡쒖뺄 ?뚯뒪???덈? 湲덉?!

?щ컮瑜??뚯뒪??諛⑸쾿:
1. 肄붾뱶 ?섏젙
2. git add ??git commit ??git push
3. GitHub Actions ?먮룞 諛고룷 ?湲?
4. https://dlivestore2.store/ ?먯꽌 吏곸젒 ?뚯뒪??
```

**???ъ슜?먯뿉寃??뚯뒪???좊꽆湲곌린 湲덉?!**
```
- "?뺤씤?댁＜?몄슂" ????湲덉?!
- "?뚯뒪?명빐蹂댁꽭?? ????湲덉?!
- Claude媛 吏곸젒 諛고룷???ъ씠?몄뿉??API ?몄텧?섏뿬 ?뚯뒪??????

?섏젙 ?꾨즺 ???꾩닔 ?덉감:
1. ?꾨줎?몄뿏??+ 諛깆뿏??紐⑤몢 ?뺤긽 ?숈옉 ?뺤씤
2. API ?몄텧?섏뿬 ?덉긽 寃곌낵媛??뺤씤
3. ?ㅻ쪟 ?놁씠 ?꾨즺 ?꾩뿉留??ъ슜?먯뿉寃?"?꾨즺" 蹂닿퀬
```

### 1. Java 6 ?쒖빟?ы빆 (Adapter & Legacy)

**???ъ슜 遺덇?**:
```java
// Generic ?ъ슜 遺덇?
List<String> list = new ArrayList<String>();  // ??

// Diamond Operator 遺덇?
Map<String, Object> map = new HashMap<>();    // ??

// Try-with-resources 遺덇?
try (InputStream is = ...) { }                // ??

// Enhanced for loop 遺덇? (Collection)
for (String item : list) { }                  // ??
```

**???ъ슜 媛??*:
```java
// Raw Type ?ъ슜
List list = new ArrayList();
String item = (String) list.get(0);

// 紐낆떆?????
Map map = new HashMap();

// finally 釉붾줉
InputStream is = null;
try {
    is = new FileInputStream("file.txt");
} finally {
    if (is != null) is.close();
}

// Iterator ?ъ슜
for (Iterator it = list.iterator(); it.hasNext();) {
    String item = (String) it.next();
}
```

### 2. ?몄퐫???쒖빟?ы빆

**紐⑤뱺 Java ?뚯씪怨?XML ?뚯씪? EUC-KR ?몄퐫??*:
```bash
# ?뚯씪 ?몄퐫???뺤씤
file -I equipment-manager.xml
# ??charset=euc-kr

# 蹂???꾩슂 ??
iconv -f UTF-8 -t EUC-KR input.xml > output.xml

# Ant 鍮뚮뱶 ???몄퐫??吏??
ant -Dfile.encoding=EUC-KR build
```

### 3. iBATIS 2.x 臾몃쾿 (NOT MyBatis 3.x)

**??MyBatis 3.x 臾몃쾿 ?ъ슜 遺덇?**:
```xml
<!-- MyBatis 3.x (?ъ슜 遺덇?) -->
<select id="test" parameterType="HashMap" resultType="HashMap">
  SELECT * FROM TB WHERE ID = #{id}
</select>

<if test="id != null">
  AND ID = #{id}
</if>
```

**??iBATIS 2.x 臾몃쾿**:
```xml
<!-- iBATIS 2.x (?ъ슜 ?꾩닔) -->
<select id="test" parameterClass="HashMap" resultClass="HashMap">
  SELECT * FROM TB WHERE ID = #id#
</select>

<isNotEmpty property="id">
  AND ID = #id#
</isNotEmpty>
```

---

## ?뱚 ?듭떖 ?뚯씪 ?꾩튂

### Frontend (React)
```
mobile-cona-front/
?쒋?? components/
??  ?쒋?? EquipmentStatusView.tsx      # ???꾨즺 (EM-010)
??  ?쒋?? EquipmentAssignment.tsx      # ?봽 吏꾪뻾以?(EM-004)
??  ?쒋?? EquipmentMovement.tsx        # ?봽 怨꾪쉷 (EM-011)
??  ?붴?? EquipmentRecovery.tsx        # ?봽 吏꾪뻾以?(EM-015)
?쒋?? services/
??  ?붴?? apiService.ts                # 3,253以?- 紐⑤뱺 API ?⑥닔
?쒋?? api-proxy.js                     # Express ?꾨줉??(66 endpoints)
?붴?? App.tsx                          # ?ㅻ퉬寃뚯씠??怨꾩링 援ъ“ (?쇱씤 35-48)
```

### Adapter (Java 6)
```
adapter-build-deploy/
?쒋?? common-src/src/com/company/api/controller/
??  ?붴?? WorkApiController.java       # 2,746以?- JSON ??MiPlatform 蹂??
?쒋?? build.xml                        # Ant 鍮뚮뱶 ?ㅽ겕由쏀듃
?붴?? Dockerfile                       # Java 6 Docker ?섍꼍
```

### Legacy (Java 6 + iBATIS)
```
legacy-server/src/com/cona/
?쒋?? customer/equipment/
??  ?쒋?? web/EquipmentManagerDelegate.java        # 40+ API ?몃뱾??
??  ?쒋?? service/impl/EquipmentManagerImpl.java   # 3,496以? 314 硫붿냼??
??  ?붴?? dao/sqlmaps/maps/equipment-manager.xml   # iBATIS SQL 留?(EUC-KR)
```

---

## ?뵆 ??API 異붽? ?뚰겕?뚮줈??

### Step 1: Legacy Server ?뺤씤
```java
// legacy-server/.../EquipmentManagerDelegate.java
public void getEquipmentOutList(VariableList inVl, DataSetList inDl, DataSetList outDl) {
    // 硫붿냼??議댁옱 ?뺤씤
}
```

### Step 2: iBATIS SQL ?뺤씤
```xml
<!-- legacy-server/.../equipment-manager.xml -->
<select id="getEquipmentOutList" resultClass="HashMap" parameterClass="HashMap">
  SELECT ... FROM TB_EQT_OUT_REQ
  WHERE 1=1
  <isNotEmpty property="OUT_DT">
    AND OUT_DT = #OUT_DT#
  </isNotEmpty>
</select>
```

### Step 3: Adapter???쇱슦??異붽?
```java
// adapter-build-deploy/.../WorkApiController.java
public void service(HttpServletRequest request, HttpServletResponse response) {
    String uri = request.getRequestURI();

    if (uri.endsWith("/getEquipmentOutList")) {
        handleGetEquipmentOutList(request, response);
    }
}

private void handleGetEquipmentOutList(HttpServletRequest request, HttpServletResponse response) {
    // JSON ??MiPlatform ??Legacy ??MiPlatform ??JSON
}
```

### Step 4: Frontend API ?⑥닔 異붽?
```typescript
// mobile-cona-front/services/apiService.ts (?뚯씪 ?앹뿉 異붽?)
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
```

### Step 5: 而댄룷?뚰듃?먯꽌 ?ъ슜
```typescript
// mobile-cona-front/components/EquipmentAssignment.tsx
import { getEquipmentOutList } from '../services/apiService';

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

---

## ?? Git ?뚰겕?뚮줈??

```bash
# 1. Main 理쒖떊??
git checkout main
git pull teamart main

# 2. Feature 釉뚮옖移??앹꽦
git checkout -b jsh/equipment-feature-name

# 3. ?묒뾽 ??Commit
git add .
git commit -m "feat: 湲곕뒫 ?ㅻ챸

?곸꽭 ?댁슜

?쨼 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push
git push origin jsh/equipment-feature-name --force-with-lease

# 5. PR ?앹꽦
gh pr create --title "feat: ?쒕ぉ" --body "?댁슜"

# 6. Merge ???뺣━
git checkout main && git pull teamart main
git branch -d jsh/equipment-feature-name
```

---

## ?슓 EC2 諛고룷

```bash
# SSH ?묒냽
ssh ubuntu@52.63.232.141

# 諛고룷
cd /home/ubuntu/dlive-cona-client
git pull origin main
npm run build
pm2 restart dlive
pm2 logs dlive --lines 20

# ?묒냽 ?뺤씤
# http://52.63.232.141/
```

---

## ?뱥 ?꾩옱 ?묒뾽 ?곗꽑?쒖쐞

### Phase 1 (吏꾪뻾以?

1. **EM-004: 湲곗궗 蹂댁쑀?λ퉬 議고쉶** (理쒖슦??
   - ?뚯씪: `EquipmentAssignment.tsx` (300以?UI ?꾩꽦)
   - ?꾩슂 API: 3媛?
     - `getEquipmentOutList` (?쇱씤 97)
     - `getOutTargetEquipmentList` (?쇱씤 103)
     - `processEquipmentReceive` (?쇱씤 108)
   - ?덉긽 ?쒓컙: 2-3?쒓컙

2. **EM-015: 誘명쉶???λ퉬 議고쉶**
   - ?뚯씪: `EquipmentRecovery.tsx` (147以?UI ?꾩꽦)
   - ?꾩슂 API: 1媛?
     - `getUnreturnedEquipmentList` (?쇱씤 50)
   - ?덉긽 ?쒓컙: 1?쒓컙

3. **EM-011: ?λ퉬 ?묒뾽???닿?**
   - ?뚯씪: `EquipmentTransfer.tsx`
   - ?꾩슂 API: 1媛?+ 紐⑤떖 而댄룷?뚰듃
   - ?덉긽 ?쒓컙: 3-4?쒓컙

### ?꾨즺???묒뾽

- ??**EM-010: ?λ퉬 ?대젰 議고쉶** (2025-01-25)
  - ?뚯씪: `EquipmentStatusView.tsx`
  - API: `getEquipmentHistoryInfo`
  - ?곹깭: EC2 諛고룷 ?꾨즺

---

## ?뵇 ?먯＜ ?ъ슜?섎뒗 紐낅졊??

### 媛쒕컻 ?쒕쾭 ?ㅽ뻾
```bash
cd /Users/bottle/bottle1/delive/dlive-json-api/mobile-cona-front

# Frontend 媛쒕컻 ?쒕쾭
npm run dev

# API ?꾨줉???쒕쾭 (蹂꾨룄 ?곕???
node api-proxy.js
```

### 鍮뚮뱶 & ?뚯뒪??
```bash
# TypeScript ???泥댄겕
npm run type-check

# 鍮뚮뱶
npm run build

# 鍮뚮뱶 ?꾨━酉?
npm run preview
```

### Demo Mode ?쒖꽦??(釉뚮씪?곗? Console)
```javascript
// Demo Mode ON
localStorage.setItem('demoMode', 'true');

// ?ъ슜???뺣낫 ?ㅼ젙
localStorage.setItem('userInfo', JSON.stringify({
  USR_ID: 'TEST_USER',
  USR_NM: '?뚯뒪?멸린??,
  SO_ID: 'SO001',
  SO_NM: '?쒖슱吏??
}));

// 吏??紐⑸줉 ?ㅼ젙
localStorage.setItem('branchList', JSON.stringify([
  { SO_ID: 'SO001', SO_NM: '?쒖슱吏?? },
  { SO_ID: 'SO002', SO_NM: '遺?곗??? }
]));

location.reload();
```

---

## ?뱴 李멸퀬 臾몄꽌

1. **COMPREHENSIVE_GUIDE.md** - ?꾩껜 ?쒖뒪??遺꾩꽍 (??臾몄꽌???곸쐞 臾몄꽌)
2. **?꾩뭅?대툕/** - ?덇굅??遺꾩꽍 ?먮즺
   - TSYCM_CODE_DETAIL.xlsx - 怨듯넻肄붾뱶 1,280媛?
   - 湲곕뒫遺꾪빐??Ver0.7.xlsx - ?꾩껜 湲곕뒫 紐낆꽭
3. **WBS CSV ?뚯씪??* - 媛쒕컻 怨꾪쉷 (6媛?
   - ?λ퉬愿由? ?묒뾽愿由? 怨좉컼愿由???

---

## ?좑툘 二쇱쓽?ы빆

### 肄붾뵫 ??諛섎뱶???뺤씤

- [ ] Java ?뚯씪??Generic ?ъ슜 ????
- [ ] Java/XML ?뚯씪 ?몄퐫??EUC-KR ?좎?
- [ ] iBATIS 2.x 臾몃쾿 ?ъ슜 (MyBatis 3.x ?꾨떂)
- [ ] API ?⑥닔??Circuit Breaker ?⑦꽩 ?곸슜
- [ ] TypeScript ????뺤쓽 紐낇솗??
- [ ] 濡쒕뵫 ?곹깭 諛??먮윭 泥섎━ 異붽?

### Git ?묒뾽 ??諛섎뱶???뺤씤

- [ ] Main 理쒖떊????釉뚮옖移??앹꽦
- [ ] Commit 硫붿떆吏??Co-Author 異붽?
- [ ] PR ?앹꽦 ??鍮뚮뱶 ?뚯뒪??
- [ ] Merge ??EC2 諛고룷 ?뺤씤

### 諛고룷 ??諛섎뱶???뺤씤

- [ ] `npm run build` ?깃났
- [ ] `pm2 restart dlive` ?ㅽ뻾
- [ ] `pm2 logs dlive` ?먮윭 ?놁쓬
- [ ] 釉뚮씪?곗??먯꽌 湲곕뒫 ?숈옉 ?뺤씤

---

## ?넊 ?몃윭釉붿뒋??鍮좊Ⅸ 李몄“

### API ?몄텧 ?ㅽ뙣
```bash
# API ?꾨줉???뺤씤
ps aux | grep api-proxy
node api-proxy.js &

# Legacy ?쒕쾭 ping
ping 58.143.140.222

# cURL ?뚯뒪??
curl -X POST http://localhost:3000/api/customer/equipment/getEquipmentHistoryInfo \
  -H "Content-Type: application/json" \
  -d '{"EQT_SERNO":"TEST"}'
```

### 鍮뚮뱶 ?먮윭
```bash
# ???泥댄겕
npm run type-check

# ?섏〈???ъ꽕移?
rm -rf node_modules package-lock.json
npm install
```

### EC2 諛고룷 ?ㅽ뙣
```bash
# PM2 ?곹깭 ?뺤씤
pm2 status

# ?щ퉴??
npm run build
pm2 restart dlive

# 濡쒓렇 ?뺤씤
pm2 logs dlive --lines 100
```

### Java 6 鍮뚮뱶 ?먮윭
```bash
# Ant ?щ퉴??
cd adapter-build-deploy
ant clean build

# Docker ?щ퉴??
docker build -t dlive-adapter:latest .
docker-compose restart adapter
```

---

**?묒뾽 ?쒖옉 ??諛섎뱶??COMPREHENSIVE_GUIDE.md瑜???踰??쎌뼱蹂댁꽭??**

**遺덈챸?뺥븳 ?ы빆? 癒쇱? 臾몄꽌瑜??뺤씤?섍퀬, ?놁쑝硫??ъ슜?먯뿉寃?吏덈Ц?섏꽭??**
