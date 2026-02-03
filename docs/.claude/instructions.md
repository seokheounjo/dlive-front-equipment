# D-Live Equipment Management - Claude Code Instructions

> **중요**: 이 파일은 프로젝트 시작 시 자동으로 로드됩니다.
> 전체 문서는 `/COMPREHENSIVE_GUIDE.md`를 참조하세요.

---

## 🎯 프로젝트 개요

**D-Live 장비관리 시스템** - 레거시 MiPlatform 시스템을 React 기반으로 마이그레이션

- **Frontend**: React 19 + TypeScript (mobile-cona-front/)
- **Adapter**: Java 6 + Spring 2.x (adapter-build-deploy/)
- **Legacy**: Java 6 + iBATIS 2.x (legacy-server/)
- **현재 작업**: 장비관리 파트 Phase 1 구현

---

## 🚨 절대 준수 사항

### 0. 개발/테스트 필수 규칙 (CRITICAL - 최우선!)

**⛔ 로컬 개발서버 사용 절대 금지!**
```
- npm run dev (localhost:3000) 절대 사용 금지!
- 로컬에서 API 테스트 절대 금지!
- curl localhost:3000 같은 로컬 테스트 절대 금지!

올바른 테스트 방법:
1. 코드 수정
2. git add → git commit → git push
3. GitHub Actions 자동 배포 대기
4. https://dlivestore2.store/ 에서 직접 테스트
```

**⛔ 사용자에게 테스트 떠넘기기 금지!**
```
- "확인해주세요" → ❌ 금지!
- "테스트해보세요" → ❌ 금지!
- Claude가 직접 배포된 사이트에서 API 호출하여 테스트 → ✅

수정 완료 후 필수 절차:
1. 프론트엔드 + 백엔드 모두 정상 동작 확인
2. API 호출하여 예상 결과값 확인
3. 오류 없이 완료 후에만 사용자에게 "완료" 보고
```

### 1. Java 6 제약사항 (Adapter & Legacy)

**❌ 사용 불가**:
```java
// Generic 사용 불가
List<String> list = new ArrayList<String>();  // ❌

// Diamond Operator 불가
Map<String, Object> map = new HashMap<>();    // ❌

// Try-with-resources 불가
try (InputStream is = ...) { }                // ❌

// Enhanced for loop 불가 (Collection)
for (String item : list) { }                  // ❌
```

**✅ 사용 가능**:
```java
// Raw Type 사용
List list = new ArrayList();
String item = (String) list.get(0);

// 명시적 타입
Map map = new HashMap();

// finally 블록
InputStream is = null;
try {
    is = new FileInputStream("file.txt");
} finally {
    if (is != null) is.close();
}

// Iterator 사용
for (Iterator it = list.iterator(); it.hasNext();) {
    String item = (String) it.next();
}
```

### 2. 인코딩 제약사항

**모든 Java 파일과 XML 파일은 EUC-KR 인코딩**:
```bash
# 파일 인코딩 확인
file -I equipment-manager.xml
# → charset=euc-kr

# 변환 필요 시
iconv -f UTF-8 -t EUC-KR input.xml > output.xml

# Ant 빌드 시 인코딩 지정
ant -Dfile.encoding=EUC-KR build
```

### 3. iBATIS 2.x 문법 (NOT MyBatis 3.x)

**❌ MyBatis 3.x 문법 사용 불가**:
```xml
<!-- MyBatis 3.x (사용 불가) -->
<select id="test" parameterType="HashMap" resultType="HashMap">
  SELECT * FROM TB WHERE ID = #{id}
</select>

<if test="id != null">
  AND ID = #{id}
</if>
```

**✅ iBATIS 2.x 문법**:
```xml
<!-- iBATIS 2.x (사용 필수) -->
<select id="test" parameterClass="HashMap" resultClass="HashMap">
  SELECT * FROM TB WHERE ID = #id#
</select>

<isNotEmpty property="id">
  AND ID = #id#
</isNotEmpty>
```

---

## 📁 핵심 파일 위치

### Frontend (React)
```
mobile-cona-front/
├── components/
│   ├── EquipmentStatusView.tsx      # ✅ 완료 (EM-010)
│   ├── EquipmentAssignment.tsx      # 🔄 진행중 (EM-004)
│   ├── EquipmentMovement.tsx        # 🔄 계획 (EM-011)
│   └── EquipmentRecovery.tsx        # 🔄 진행중 (EM-015)
├── services/
│   └── apiService.ts                # 3,253줄 - 모든 API 함수
├── api-proxy.js                     # Express 프록시 (66 endpoints)
└── App.tsx                          # 네비게이션 계층 구조 (라인 35-48)
```

### Adapter (Java 6)
```
adapter-build-deploy/
├── common-src/src/com/company/api/controller/
│   └── WorkApiController.java       # 2,746줄 - JSON ↔ MiPlatform 변환
├── build.xml                        # Ant 빌드 스크립트
└── Dockerfile                       # Java 6 Docker 환경
```

### Legacy (Java 6 + iBATIS)
```
legacy-server/src/com/cona/
├── customer/equipment/
│   ├── web/EquipmentManagerDelegate.java        # 40+ API 핸들러
│   ├── service/impl/EquipmentManagerImpl.java   # 3,496줄, 314 메소드
│   └── dao/sqlmaps/maps/equipment-manager.xml   # iBATIS SQL 맵 (EUC-KR)
```

---

## 🔌 새 API 추가 워크플로우

### Step 1: Legacy Server 확인
```java
// legacy-server/.../EquipmentManagerDelegate.java
public void getEquipmentOutList(VariableList inVl, DataSetList inDl, DataSetList outDl) {
    // 메소드 존재 확인
}
```

### Step 2: iBATIS SQL 확인
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

### Step 3: Adapter에 라우팅 추가
```java
// adapter-build-deploy/.../WorkApiController.java
public void service(HttpServletRequest request, HttpServletResponse response) {
    String uri = request.getRequestURI();

    if (uri.endsWith("/getEquipmentOutList")) {
        handleGetEquipmentOutList(request, response);
    }
}

private void handleGetEquipmentOutList(HttpServletRequest request, HttpServletResponse response) {
    // JSON → MiPlatform → Legacy → MiPlatform → JSON
}
```

### Step 4: Frontend API 함수 추가
```typescript
// mobile-cona-front/services/apiService.ts (파일 끝에 추가)
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

### Step 5: 컴포넌트에서 사용
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

## 🚀 Git 워크플로우

```bash
# 1. Main 최신화
git checkout main
git pull teamart main

# 2. Feature 브랜치 생성
git checkout -b jsh/equipment-feature-name

# 3. 작업 후 Commit
git add .
git commit -m "feat: 기능 설명

상세 내용

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push
git push origin jsh/equipment-feature-name --force-with-lease

# 5. PR 생성
gh pr create --title "feat: 제목" --body "내용"

# 6. Merge 후 정리
git checkout main && git pull teamart main
git branch -d jsh/equipment-feature-name
```

---

## 🚢 EC2 배포

```bash
# SSH 접속
ssh ubuntu@52.63.131.157

# 배포
cd /home/ubuntu/dlive-cona-client
git pull origin main
npm run build
pm2 restart dlive
pm2 logs dlive --lines 20

# 접속 확인
# http://52.63.131.157/
```

---

## 📋 현재 작업 우선순위

### Phase 1 (진행중)

1. **EM-004: 기사 보유장비 조회** (최우선)
   - 파일: `EquipmentAssignment.tsx` (300줄 UI 완성)
   - 필요 API: 3개
     - `getEquipmentOutList` (라인 97)
     - `getOutTargetEquipmentList` (라인 103)
     - `processEquipmentReceive` (라인 108)
   - 예상 시간: 2-3시간

2. **EM-015: 미회수 장비 조회**
   - 파일: `EquipmentRecovery.tsx` (147줄 UI 완성)
   - 필요 API: 1개
     - `getUnreturnedEquipmentList` (라인 50)
   - 예상 시간: 1시간

3. **EM-011: 장비 작업자 이관**
   - 파일: `EquipmentTransfer.tsx`
   - 필요 API: 1개 + 모달 컴포넌트
   - 예상 시간: 3-4시간

### 완료된 작업

- ✅ **EM-010: 장비 이력 조회** (2025-01-25)
  - 파일: `EquipmentStatusView.tsx`
  - API: `getEquipmentHistoryInfo`
  - 상태: EC2 배포 완료

---

## 🔍 자주 사용하는 명령어

### 개발 서버 실행
```bash
cd /Users/bottle/bottle1/delive/dlive-json-api/mobile-cona-front

# Frontend 개발 서버
npm run dev

# API 프록시 서버 (별도 터미널)
node api-proxy.js
```

### 빌드 & 테스트
```bash
# TypeScript 타입 체크
npm run type-check

# 빌드
npm run build

# 빌드 프리뷰
npm run preview
```

### Demo Mode 활성화 (브라우저 Console)
```javascript
// Demo Mode ON
localStorage.setItem('demoMode', 'true');

// 사용자 정보 설정
localStorage.setItem('userInfo', JSON.stringify({
  USR_ID: 'TEST_USER',
  USR_NM: '테스트기사',
  SO_ID: 'SO001',
  SO_NM: '서울지점'
}));

// 지점 목록 설정
localStorage.setItem('branchList', JSON.stringify([
  { SO_ID: 'SO001', SO_NM: '서울지점' },
  { SO_ID: 'SO002', SO_NM: '부산지점' }
]));

location.reload();
```

---

## 📚 참고 문서

1. **COMPREHENSIVE_GUIDE.md** - 전체 시스템 분석 (이 문서의 상위 문서)
2. **아카이브/** - 레거시 분석 자료
   - TSYCM_CODE_DETAIL.xlsx - 공통코드 1,280개
   - 기능분해도_Ver0.7.xlsx - 전체 기능 명세
3. **WBS CSV 파일들** - 개발 계획 (6개)
   - 장비관리, 작업관리, 고객관리 등

---

## ⚠️ 주의사항

### 코딩 시 반드시 확인

- [ ] Java 파일에 Generic 사용 안 함
- [ ] Java/XML 파일 인코딩 EUC-KR 유지
- [ ] iBATIS 2.x 문법 사용 (MyBatis 3.x 아님)
- [ ] API 함수에 Circuit Breaker 패턴 적용
- [ ] TypeScript 타입 정의 명확히
- [ ] 로딩 상태 및 에러 처리 추가

### Git 작업 시 반드시 확인

- [ ] Main 최신화 후 브랜치 생성
- [ ] Commit 메시지에 Co-Author 추가
- [ ] PR 생성 전 빌드 테스트
- [ ] Merge 후 EC2 배포 확인

### 배포 시 반드시 확인

- [ ] `npm run build` 성공
- [ ] `pm2 restart dlive` 실행
- [ ] `pm2 logs dlive` 에러 없음
- [ ] 브라우저에서 기능 동작 확인

---

## 🆘 트러블슈팅 빠른 참조

### API 호출 실패
```bash
# API 프록시 확인
ps aux | grep api-proxy
node api-proxy.js &

# Legacy 서버 ping
ping 58.143.140.222

# cURL 테스트
curl -X POST http://localhost:3000/api/customer/equipment/getEquipmentHistoryInfo \
  -H "Content-Type: application/json" \
  -d '{"EQT_SERNO":"TEST"}'
```

### 빌드 에러
```bash
# 타입 체크
npm run type-check

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### EC2 배포 실패
```bash
# PM2 상태 확인
pm2 status

# 재빌드
npm run build
pm2 restart dlive

# 로그 확인
pm2 logs dlive --lines 100
```

### Java 6 빌드 에러
```bash
# Ant 재빌드
cd adapter-build-deploy
ant clean build

# Docker 재빌드
docker build -t dlive-adapter:latest .
docker-compose restart adapter
```

---

**작업 시작 전 반드시 COMPREHENSIVE_GUIDE.md를 한 번 읽어보세요!**

**불명확한 사항은 먼저 문서를 확인하고, 없으면 사용자에게 질문하세요.**
