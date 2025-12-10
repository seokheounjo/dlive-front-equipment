import { WorkDirection, WorkItem, WorkOrderType, WorkOrderStatus } from '../types';

// 작업지시서 목 데이터 생성
export const getMockWorkDirections = (): WorkDirection[] => {
  return [
    {
      id: "WD001",
      type: WorkOrderType.AS,
      typeDisplay: "A/S",
      status: WorkOrderStatus.Pending,
      scheduledAt: "2025-09-30T14:00:00",
      customer: {
        id: "1001857578",
        name: "김철수",
        phone: "01044586687",
        address: "서울시 송파구 석촌동 261번지 17호",
        isVip: true,
        vipLevel: 'VIP'
      },
      details: "인터넷 연결 불량으로 인한 A/S 요청",
      totalWorks: 3,
      completedWorks: 1
    },
    {
      id: "WD002", 
      type: WorkOrderType.Installation,
      typeDisplay: "신규설치",
      status: WorkOrderStatus.Pending,
      scheduledAt: "2025-09-30T15:30:00",
      customer: {
        id: "1001857579",
        name: "박영희",
        phone: "01055567788",
        address: "서울시 강남구 역삼동 123번지 5호",
        isVip: true,
        vipLevel: 'VVIP'
      },
      details: "신규 인터넷 설치 요청",
      totalWorks: 2,
      completedWorks: 0
    },
    {
      id: "WD003",
      type: WorkOrderType.Move,
      typeDisplay: "이전설치", 
      status: WorkOrderStatus.Completed,
      scheduledAt: "2025-09-29T10:00:00",
      customer: {
        id: "1001857580",
        name: "이민수",
        phone: "01066678899",
        address: "서울시 마포구 합정동 456번지 12호"
      },
      details: "이사로 인한 설치 위치 변경",
      totalWorks: 1,
      completedWorks: 1
    }
  ];
};

// 특정 작업지시서의 작업들 목 데이터 생성
export const getMockWorkItems = (directionId: string): WorkItem[] => {
  // 어떤 ID가 와도 더미 데이터 반환 (실제 API 연동 전까지)
  return [
    {
      id: `${directionId}_1`,
      directionId: directionId,
      type: WorkOrderType.AS,
      typeDisplay: "A/S 점검",
      status: WorkOrderStatus.Completed,
      scheduledAt: "2025-09-30T14:00:00",
      customer: {
        id: "1001857578",
        name: "김철수",
        phone: "01044586687",
        address: "서울시 송파구 석촌동 261번지 17호"
      },
      details: "모뎀 상태 점검 완료",
      assignedEquipment: [],
      productName: "ISP 스마트 광랜",
      cellNo: "-",
      installLocation: "거실"
    },
    {
      id: `${directionId}_2`, 
      directionId: directionId,
      type: WorkOrderType.AS,
      typeDisplay: "A/S 교체",
      status: WorkOrderStatus.Pending,
      scheduledAt: "2025-09-30T14:30:00",
      customer: {
        id: "1001857578",
        name: "김철수",
        phone: "01044586687",
        address: "서울시 송파구 석촌동 261번지 17호"
      },
      details: "라우터 교체 작업",
      assignedEquipment: [],
      productName: "ISP 라우터",
      cellNo: "C001",
      installLocation: "현관"
    },
    {
      id: `${directionId}_3`,
      directionId: directionId, 
      type: WorkOrderType.AS,
      typeDisplay: "A/S 설정",
      status: WorkOrderStatus.Pending,
      scheduledAt: "2025-09-30T15:00:00",
      customer: {
        id: "1001857578",
        name: "김철수", 
        phone: "01044586687",
        address: "서울시 송파구 석촌동 261번지 17호"
      },
      details: "네트워크 설정 변경",
      assignedEquipment: [],
      productName: "ISP 스마트 광랜",
      cellNo: "C002",
      installLocation: "안방"
    }
  ];
};
