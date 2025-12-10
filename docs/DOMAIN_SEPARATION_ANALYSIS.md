# D'Live 도메인 분리 분석 (2025-11-28)

## 📊 현재 상태 분석

### 1. 작업관리 (Work Management) - 팀원 영역

#### 컴포넌트 구조 (22개 파일, 6,425 lines)
```
components/work/
├── Dashboard.tsx                    # 작업 대시보드 (메인)
├── TodayWork.tsx                    # 오늘의 작업
├── WorkItemList.tsx                 # 작업 목록
├── WorkItemCard.tsx                 # 작업 카드
├── WorkOrderCard.tsx                # 작업 지시 카드
├── WorkOrderDetail.tsx              # 작업 지시 상세
├── WorkDirectionRow.tsx             # 작업 방향 Row
├── WorkProcessFlow.tsx              # ⭐ 4단계 작업 프로세스
├── WorkCompleteForm.tsx             # 작업 완료 입력
├── WorkCompleteDetail.tsx           # 작업 완료 상세
├── WorkCancelModal.tsx              # 작업 취소
├── ContractInfo.tsx                 # 1단계: 계약정보
├── ReceptionInfo.tsx                # 2단계: 접수정보
├── SafetyCheckList.tsx              # 안전점검 목록
├── SafetyCheckModal.tsx             # 안전점검 모달
├── WorkResultSignalList.tsx         # 작업결과 신호 목록
└── [작업유형별 상세]
    ├── InstallWorkDetails.tsx       # 개통
    ├── TerminationWorkDetails.tsx   # 해지
    ├── ASWorkDetails.tsx            # A/S
    ├── RelocationWorkDetails.tsx    # 이전
    ├── ProductChangeWorkDetails.tsx # 상품변경
    └── SuspensionWorkDetails.tsx    # 정지
```

#### 상태 관리
- **uiStore.ts** (Zustand + persist)
  - 현재 View 라우팅
  - 활성 탭
  - 작업 필터 (날짜, 상태)
  - 선택된 작업 항목

- **workProcessStore.ts** (Zustand + persist)
  - 4단계 프로세스 상태
  - 현재 작업 항목
  - 장비 데이터 (3단계용)
  - 필터링 데이터

#### React Query
- **useWorkOrders.ts**
  - 작업 목록 조회 캐싱
  - 자동 리페칭
  - 2분 staleTime, 5분 gcTime

#### API 라우트
```
/work/directions          # 작업 지시 조회
/work/receipts           # 작업 접수 조회
/work/cancel             # 작업 취소
/work/complete           # 작업 완료
/work/safety-checks      # 안전점검 조회
/work/safety-check       # 안전점검 등록
/work/result-signals     # 작업결과 신호
/customer/work/*         # 고객 작업 관련 (7개 엔드포인트)
```

#### 4단계 작업 프로세스 (WorkProcessFlow.tsx)
1. **계약정보** (ContractInfo.tsx)
2. **접수정보** (ReceptionInfo.tsx)
3. **장비정보** (EquipmentManagement.tsx) ⚠️ 장비관리 컴포넌트 포함!
4. **작업완료** (WorkCompleteForm.tsx)

---

### 2. 장비관리 (Equipment Management) - 우리 영역

#### 컴포넌트 구조 (12개 파일, 5,542 lines)
```
components/equipment/
├── EquipmentManagement.tsx          # ⚠️ 작업 프로세스 3단계에서 사용
├── EquipmentManagementMenu.tsx      # 장비관리 메뉴 (독립)
├── EquipmentStatusView.tsx          # 장비 상태 조회
├── EquipmentAssignment.tsx          # 장비 배정
├── EquipmentTransfer.tsx            # 장비 이관
├── EquipmentMovement.tsx            # 장비 이동
├── EquipmentRecovery.tsx            # 장비 회수
├── EquipmentInstallation.tsx        # 장비 설치
├── EquipmentModelChangeModal.tsx    # 모델 변경 모달
├── SignalCheck.tsx                  # 신호 체크
├── SignalHistoryList.tsx            # 신호 이력
└── ApiExplorer.tsx                  # API 탐색기 (개발용)
```

#### 상태 관리
- ❌ **독립적인 Store 없음**
- ⚠️ `workProcessStore`의 `equipmentData`에 의존
- ⚠️ 작업 프로세스 3단계에 종속됨

#### API 라우트
```
/customer/equipment/getEquipmentOutList          # 출고 장비 조회
/customer/equipment/getEquipmentProcYnCheck      # 장비 처리 여부
/customer/equipment/addCorporationEquipmentQuota # 법인 장비 쿼터 추가
/customer/equipment/changeEqtWrkr_3              # 장비 작업자 변경
/customer/work/eqtCmpsInfoChg                    # 장비 구성정보 변경
/customer/work/saveInstallInfo                   # 설치정보 저장
/customer/receipt/contract/getContractEqtList    # 계약 장비 조회
```

---

## 🚨 문제점

### 1. 도메인 경계 불명확
- `EquipmentManagement.tsx`가 `WorkProcessFlow.tsx`의 3단계에 포함됨
- 장비관리가 작업관리의 하위 프로세스로 인식될 수 있음
- 독립적인 장비관리 기능(배정, 이관, 회수)과 혼재

### 2. 상태 관리 종속
- 장비 데이터가 `workProcessStore`에 저장됨
- 작업과 무관한 순수 장비관리 시 Store 접근 불가
- 장비관리 독립 실행 불가능

### 3. API 라우트 혼재
- `/customer/work/eqtCmpsInfoChg` - 장비 변경인데 work 경로
- `/customer/work/saveInstallInfo` - 설치정보인데 work 경로
- `/customer/equipment/*` - 순수 장비관리 경로

### 4. 컴포넌트 재사용 제약
- `EquipmentManagement.tsx`가 `WorkItem` props 필수
- 작업 컨텍스트 없이는 장비관리 불가
- 순수 장비관리 UI 구현 어려움

---

## ✅ 해결 방안

### 1. 명확한 도메인 정의

#### 작업관리 (Work Management)
**책임**: 작업 라이프사이클 전체 관리
- 작업 조회/필터링
- 작업 지시 확인
- 작업 프로세스 진행 (4단계)
- 작업 완료/취소
- 안전점검
- 작업 결과 신호

**핵심 엔티티**: WorkOrder, WorkItem, WorkDirection

#### 장비관리 (Equipment Management)
**책임**: 장비 자원 관리
- 기사 보유 장비 조회
- 장비 배정/이관/회수
- 장비 상태 관리
- 장비 이동 이력
- 신호 체크/이력
- 계약 장비 매핑

**핵심 엔티티**: Equipment, TechnicianInventory, ContractEquipment

#### 교차점 (Intersection)
**작업 프로세스 3단계**: 작업에 필요한 장비를 관리하는 단계
- 작업 컨텍스트 + 장비관리 기능
- `WorkProcessFlow`가 `EquipmentManagement`를 컴포지션으로 사용
- 장비 데이터는 작업 완료를 위한 수단

---

### 2. 재구조화 계획

#### Phase 1: 장비관리 Store 분리
```typescript
// stores/equipmentStore.ts (신규)
interface EquipmentStore {
  // 기사 재고
  technicianInventory: Equipment[];
  setTechnicianInventory: (items: Equipment[]) => void;

  // 선택된 장비
  selectedEquipment: Equipment | null;
  setSelectedEquipment: (item: Equipment | null) => void;

  // 장비 필터
  equipmentFilters: EquipmentFilters;
  setEquipmentFilters: (filters: EquipmentFilters) => void;

  // 신호 체크 상태
  signalCheckStatus: SignalStatus | null;
  setSignalCheckStatus: (status: SignalStatus | null) => void;
}
```

#### Phase 2: 컴포넌트 분리
```
components/equipment/
├── [독립 기능]
│   ├── EquipmentManagementMenu.tsx    # 메뉴 (기존)
│   ├── EquipmentInventoryView.tsx     # 재고 조회 (신규)
│   ├── EquipmentAssignment.tsx        # 배정 (기존)
│   ├── EquipmentTransfer.tsx          # 이관 (기존)
│   ├── EquipmentMovement.tsx          # 이동 (기존)
│   └── EquipmentRecovery.tsx          # 회수 (기존)
│
├── [작업 프로세스용]
│   ├── WorkEquipmentManagement.tsx    # 작업 3단계 전용 (신규)
│   └── EquipmentAssignmentForWork.tsx # 작업용 배정 (신규)
│
└── [공통]
    ├── EquipmentCard.tsx              # 장비 카드 (신규)
    ├── EquipmentList.tsx              # 장비 리스트 (신규)
    ├── EquipmentModelChangeModal.tsx  # 모델 변경 (기존)
    ├── SignalCheck.tsx                # 신호 체크 (기존)
    └── SignalHistoryList.tsx          # 신호 이력 (기존)
```

#### Phase 3: API 분리
```typescript
// services/equipmentApi.ts (신규)
export const equipmentApi = {
  // 재고 관리
  getTechnicianInventory: () => {},
  getEquipmentStatus: () => {},

  // 장비 이동
  assignEquipment: () => {},
  transferEquipment: () => {},
  recoverEquipment: () => {},

  // 신호 관리
  checkSignal: () => {},
  getSignalHistory: () => {},
}

// services/workEquipmentApi.ts (신규)
export const workEquipmentApi = {
  // 작업용 장비 조회
  getEquipmentForWork: () => {},
  saveWorkEquipment: () => {},
  updateEquipmentComposition: () => {},
}
```

#### Phase 4: React Query Hooks 분리
```typescript
// hooks/queries/useEquipment.ts (신규)
export const useEquipmentInventory = () => {};
export const useEquipmentTransfer = () => {};

// hooks/queries/useWorkEquipment.ts (신규)
export const useWorkEquipmentData = (workId: string) => {};
```

---

## 📋 실행 계획

### Step 1: 분석 문서화 ✅
- [x] 현재 구조 분석
- [x] 문제점 파악
- [x] 해결 방안 수립

### Step 2: Store 분리
- [ ] `stores/equipmentStore.ts` 생성
- [ ] 장비 관련 상태 이관
- [ ] `workProcessStore`에서 equipmentData 제거

### Step 3: 컴포넌트 리팩토링
- [ ] `WorkEquipmentManagement.tsx` 신규 (작업 3단계 전용)
- [ ] `EquipmentManagement.tsx` 독립화 (순수 장비관리)
- [ ] 공통 컴포넌트 추출 (Card, List)

### Step 4: API 레이어 재구성
- [ ] `equipmentApi.ts` 생성
- [ ] `workEquipmentApi.ts` 생성
- [ ] 기존 `apiService.ts`에서 분리

### Step 5: React Query 적용
- [ ] `useEquipmentInventory` hook
- [ ] `useEquipmentTransfer` hook
- [ ] `useWorkEquipmentData` hook

### Step 6: WorkProcessFlow 업데이트
- [ ] 3단계에서 `WorkEquipmentManagement` 사용
- [ ] Store 의존성 업데이트
- [ ] Props 정리

---

## 🎯 기대 효과

1. **명확한 도메인 분리**
   - 작업관리 = 작업 프로세스 전체
   - 장비관리 = 장비 자원 관리
   - 교차점 = 작업용 장비 할당

2. **독립적인 개발 가능**
   - 작업관리 (팀원) ↔ 장비관리 (우리) 병렬 작업
   - 서로 다른 브랜치에서 충돌 없이 개발
   - 명확한 책임 경계

3. **재사용성 향상**
   - 순수 장비관리 UI 독립 실행
   - 작업 컨텍스트 없이도 장비 조회/관리
   - 다른 프로세스에서도 장비 컴포넌트 재사용

4. **유지보수 개선**
   - 장비 관련 버그 → equipment/ 폴더만 확인
   - 작업 관련 버그 → work/ 폴더만 확인
   - 명확한 코드 위치

---

## 📝 참고: 백엔드 구조 (dlive_adapter)

백엔드는 이미 도메인별로 잘 분리되어 있음:

```
src/com/company/api/controller/
├── WorkController.java          # 작업관리
├── EquipmentController.java     # 장비관리 ✅
├── SafetyCheckController.java   # 안전점검
├── SystemController.java        # 시스템/공통코드
├── IntegrationController.java   # 연동이력
├── LGUController.java           # LGU 연동
├── AuthController.java          # 인증
└── PingController.java          # 헬스체크
```

**프론트엔드도 백엔드와 동일한 구조로 정렬 필요!**
