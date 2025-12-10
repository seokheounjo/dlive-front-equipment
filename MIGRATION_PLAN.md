# 상태 관리 마이그레이션 계획

## 🎯 목표
localStorage + Props Drilling → Zustand + React Query

## 📋 전체 로드맵

```
Phase 0: 준비 단계 (1일)
  ├─ 패키지 설치 및 환경 설정
  └─ 기존 코드 백업

Phase 1: Zustand 기초 구축 (2일)
  ├─ 1-1. 작은 Store부터 시작 (UI 상태)
  ├─ 1-2. Work Process Store (작업 프로세스)
  └─ 1-3. 기존 코드와 병행 운영

Phase 2: React Query 도입 (2일)
  ├─ 2-1. 단순 조회 API부터 (작업 목록)
  ├─ 2-2. 복잡한 API (장비 관리)
  └─ 2-3. 캐싱 전략 수립

Phase 3: localStorage 정리 (1일)
  ├─ 3-1. Zustand persist로 이관
  ├─ 3-2. 임시저장만 localStorage 유지
  └─ 3-3. 불필요한 코드 제거

Phase 4: Props Drilling 제거 (1일)
  ├─ 4-1. App.tsx 간소화
  └─ 4-2. 컴포넌트 정리

Phase 5: 테스트 및 최적화 (1일)
  └─ 전체 기능 테스트
```

---

## 📅 Phase 0: 준비 단계 (안전장치 구축)

### Step 0-1: 패키지 설치
```bash
npm install zustand
npm install @tanstack/react-query
npm install @tanstack/react-query-devtools
```

### Step 0-2: 현재 브랜치 백업
```bash
git checkout -b migration/state-management
git push -u origin migration/state-management
```

### Step 0-3: 기존 코드 분석 문서화
- localStorage 사용 현황 정리
- Props drilling 경로 매핑
- API 호출 목록 작성

**체크포인트:** ✅ 빌드 성공, 기능 정상 작동

---

## 📅 Phase 1: Zustand 기초 구축 (점진적 도입)

### Step 1-1: UI 상태 Store 생성 (가장 안전)

**대상:** 모달, 토글, 탭 상태 (복잡도 낮음)

```typescript
// stores/uiStore.ts
import { create } from 'zustand';

interface UIStore {
  // 모달 상태
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  // 현재 탭
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isDrawerOpen: false,
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  activeTab: 'work-receipt',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
```

**적용 파일:**
- `App.tsx` - isDrawerOpen
- `Dashboard.tsx` - activeTab

**롤백 방법:** 기존 useState로 되돌리기만 하면 됨

**체크포인트:** ✅ 모달/탭 동작 확인

---

### Step 1-2: Work Process Store 생성 (중요도 높음)

**대상:** 4단계 작업 프로세스 데이터

```typescript
// stores/workProcessStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkProcessStore {
  // 현재 단계
  currentStep: 1 | 2 | 3 | 4;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;

  // 작업 항목
  workItem: WorkItem | null;
  setWorkItem: (item: WorkItem | null) => void;

  // 장비 데이터 (3단계에서 수집)
  equipmentData: EquipmentData | null;
  setEquipmentData: (data: EquipmentData | null) => void;

  // 전체 초기화
  reset: () => void;
}

export const useWorkProcessStore = create<WorkProcessStore>()(
  persist(
    (set) => ({
      currentStep: 1,
      workItem: null,
      equipmentData: null,

      setCurrentStep: (step) => set({ currentStep: step }),
      setWorkItem: (item) => set({ workItem: item }),
      setEquipmentData: (data) => set({ equipmentData: data }),
      reset: () => set({ currentStep: 1, workItem: null, equipmentData: null }),
    }),
    {
      name: 'work-process-storage',
      // 작업 항목 ID별로 분리 저장 (나중에 구현)
    }
  )
);
```

**적용 파일:**
- `WorkProcessFlow.tsx` - currentStep, equipmentData
- `EquipmentManagement.tsx` - equipmentData 저장
- `WorkCompleteForm.tsx` - equipmentData 읽기

**마이그레이션 순서:**
1. Store 생성 → 빌드 테스트
2. WorkProcessFlow만 적용 → 기능 테스트
3. 나머지 컴포넌트 적용 → 전체 테스트
4. 기존 props 제거 → 최종 확인

**롤백 방법:** props 다시 추가

**체크포인트:** ✅ 4단계 프로세스 완료까지 데이터 유지 확인

---

### Step 1-3: 병행 운영 (안전 검증)

**전략:** 기존 코드 유지하면서 Zustand 추가

```typescript
// WorkProcessFlow.tsx (병행 운영 예시)
const WorkProcessFlow = ({ workItem: propsWorkItem }) => {
  // 기존 방식 (props)
  const [workItemState, setWorkItemState] = useState(propsWorkItem);

  // 새 방식 (Zustand)
  const { workItem: storeWorkItem, setWorkItem } = useWorkProcessStore();

  // 병행 운영: 두 값이 같은지 검증
  useEffect(() => {
    if (workItemState?.id !== storeWorkItem?.id) {
      console.warn('⚠️ 데이터 불일치:', { props: workItemState, store: storeWorkItem });
    }
  }, [workItemState, storeWorkItem]);

  // 점진적 마이그레이션
  const workItem = storeWorkItem || workItemState; // Zustand 우선, 없으면 props
};
```

**체크포인트:** ✅ 1주일 운영 후 문제 없으면 다음 단계

---

## 📅 Phase 2: React Query 도입

### Step 2-1: QueryClient 설정

```typescript
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      cacheTime: 10 * 60 * 1000, // 10분
      retry: 1,
      refetchOnWindowFocus: false, // 모바일에서는 불필요
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* 기존 앱 */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**체크포인트:** ✅ 빌드 성공

---

### Step 2-2: 단순 조회 API부터 적용

**대상:** 작업 목록 조회 (getWorkOrders)

```typescript
// hooks/queries/useWorkOrders.ts
import { useQuery } from '@tanstack/react-query';
import { getWorkOrders } from '@/services/apiService';

export const useWorkOrders = (params: { startDate: string; endDate: string }) => {
  return useQuery({
    queryKey: ['workOrders', params.startDate, params.endDate],
    queryFn: () => getWorkOrders(params),
    enabled: !!params.startDate && !!params.endDate, // 파라미터 있을 때만 호출
  });
};
```

**적용 파일:**
- `Dashboard.tsx` - 작업 목록 조회
- `TodayWork.tsx` - 오늘 작업 조회

**마이그레이션 순서:**
1. Custom hook 생성 → 빌드 테스트
2. Dashboard에만 적용 → 기능 테스트
3. 기존 useEffect 코드 주석 처리 (삭제 X)
4. 1주일 운영 후 주석 코드 삭제

**롤백 방법:** useQuery 코드 삭제, 주석 해제

**체크포인트:** ✅ 작업 목록 조회/필터링 정상 작동

---

### Step 2-3: 복잡한 API 적용

**대상:** 장비 관리 API (getTechnicianEquipments)

```typescript
// hooks/queries/useEquipmentData.ts
import { useQuery } from '@tanstack/react-query';
import { getTechnicianEquipments } from '@/services/apiService';

export const useEquipmentData = (workItem: WorkItem) => {
  return useQuery({
    queryKey: ['equipmentData', workItem.id, workItem.CTRT_ID],
    queryFn: () => getTechnicianEquipments({
      WRKR_ID: 'A20130708',
      WORK_ID: workItem.id,
      CTRT_ID: workItem.CTRT_ID,
      // ... 기타 파라미터
    }),
    enabled: !!workItem.CTRT_ID, // CTRT_ID 있을 때만 호출
    staleTime: 10 * 60 * 1000, // 10분 캐싱
  });
};
```

**적용 파일:**
- `EquipmentManagement.tsx` - 장비 데이터 로드
- `WorkProcessFlow.tsx` - 사전 로드

**체크포인트:** ✅ 장비 등록/변경 정상 작동

---

### Step 2-4: Mutation 적용 (작업 완료)

```typescript
// hooks/mutations/useCompleteWork.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeWork } from '@/services/apiService';

export const useCompleteWork = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeWork,
    onSuccess: () => {
      // 작업 목록 캐시 무효화 → 자동 리페칭
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });
};

// WorkCompleteForm.tsx
const { mutate: submitWork, isLoading } = useCompleteWork();

const handleSubmit = () => {
  submitWork(completeData, {
    onSuccess: () => {
      showToast('작업 완료!', 'success');
      onSuccess();
    },
    onError: (error) => {
      showToast(error.message, 'error');
    },
  });
};
```

**체크포인트:** ✅ 작업 완료 후 목록 자동 갱신

---

## 📅 Phase 3: localStorage 정리

### Step 3-1: Zustand persist로 이관

**대상:**
- `WORK_PROCESS_STEP` → workProcessStore
- `WORK_PROCESS_EQUIPMENT` → workProcessStore
- `ACTIVE_TAB` → uiStore (persist 추가)

```typescript
// stores/uiStore.ts (persist 추가)
export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      activeTab: 'work-receipt',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    { name: 'ui-storage' }
  )
);
```

**체크포인트:** ✅ 새로고침 후에도 상태 유지

---

### Step 3-2: 임시저장만 localStorage 유지

**유지할 항목:**
- `equipment_draft_*` - 장비 임시저장
- `work_complete_draft_*` - 작업완료 임시저장
- `userInfo` - 로그인 정보

**이유:** 작업 ID별로 동적 키가 필요 (Zustand로 복잡)

**체크포인트:** ✅ 임시저장/복원 정상 작동

---

## 📅 Phase 4: Props Drilling 제거

### Step 4-1: App.tsx 간소화

**Before:**
```typescript
const App = () => {
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [equipmentData, setEquipmentData] = useState(null);
  const [currentView, setCurrentView] = useState('today-work');

  return (
    <WorkProcessFlow
      workItem={selectedWorkOrder}
      equipmentData={equipmentData}
      onEquipmentSave={setEquipmentData}
    />
  );
};
```

**After:**
```typescript
const App = () => {
  // View 관리만 (라우팅 역할)
  const { currentView, setCurrentView } = useUIStore();

  return <WorkProcessFlow />; // ✅ props 없음
};
```

**체크포인트:** ✅ 전체 플로우 정상 작동

---

## 📅 Phase 5: 테스트 및 최적화

### Step 5-1: 전체 시나리오 테스트

**시나리오:**
1. 로그인 → 작업 목록 조회
2. 작업 선택 → 4단계 프로세스 진입
3. 1단계: 계약정보 확인 → 다음
4. 2단계: 접수정보 확인 → 다음
5. 3단계: 장비 등록/변경 → 저장
6. 4단계: 작업완료 입력 → 완료
7. 작업 목록 자동 갱신 확인
8. 새로고침 후 상태 유지 확인

**체크포인트:** ✅ 모든 시나리오 통과

---

### Step 5-2: 성능 최적화

```typescript
// React Query DevTools로 확인
- 불필요한 리페칭 제거
- staleTime 조정
- 캐시 키 최적화

// Zustand 최적화
- selector 사용 (불필요한 리렌더 방지)
const currentStep = useWorkProcessStore((state) => state.currentStep);
```

---

## 🚨 롤백 계획 (문제 발생 시)

### Level 1: 특정 기능만 롤백
```bash
# 해당 파일만 이전 버전으로 복원
git checkout HEAD~1 -- components/work/Dashboard.tsx
```

### Level 2: 전체 Phase 롤백
```bash
# 해당 Phase 커밋 전으로 되돌림
git revert <phase-commit-hash>
```

### Level 3: 전체 마이그레이션 중단
```bash
# main 브랜치로 돌아가기
git checkout main
git branch -D migration/state-management
```

---

## 📊 진행 상황 추적

- [ ] Phase 0: 준비 단계
  - [ ] 패키지 설치
  - [ ] 브랜치 생성
  - [ ] 기존 코드 분석

- [ ] Phase 1: Zustand 기초
  - [ ] UI Store
  - [ ] Work Process Store
  - [ ] 병행 운영

- [ ] Phase 2: React Query
  - [ ] QueryClient 설정
  - [ ] 작업 목록 조회
  - [ ] 장비 관리 API
  - [ ] Mutation

- [ ] Phase 3: localStorage 정리
  - [ ] persist 이관
  - [ ] 불필요한 코드 제거

- [ ] Phase 4: Props 제거
  - [ ] App.tsx 간소화

- [ ] Phase 5: 테스트
  - [ ] 전체 시나리오 테스트
  - [ ] 성능 최적화

---

## 🎯 성공 기준

1. ✅ 기존 기능 100% 정상 작동
2. ✅ localStorage 사용 50% 이상 감소
3. ✅ Props drilling 80% 이상 제거
4. ✅ API 호출 중복 제거 (캐싱)
5. ✅ 코드 가독성 향상

---

## 📝 다음 단계

**지금 시작할까요?**

1. Phase 0 시작 (패키지 설치 및 브랜치 생성)
2. 추가 질문/검토 사항 확인
3. 마이그레이션 계획 수정

**어떻게 진행할까요?**
