import { WorkOrder, WorkOrderStatus, WorkOrderType, WorkCompleteData, InstallInfo, CommonCodeItem, WorkAlarmInfo, Vod6MonUseDateInfo, SpecialCustVod5kInfo, CustSpecialBigoInfo, AllAlarmInfo, CustomerInfoSmsRecvInfo } from '../types';
import { getMockWorkItems } from '../utils/mockData';

// ============ 에러 타입 정의 ============

export interface ApiError {
  code: string;
  message: string;
  statusCode?: number;
  details?: any;
}

export class NetworkError extends Error {
  statusCode?: number;
  details?: any;

  constructor(message: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ============ Circuit Breaker 제거됨 ============

// ============ 요청 중복 방지 (Request Deduplication) ============

interface PendingRequest {
  promise: Promise<Response>;
  timestamp: number;
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly maxAge = 5000; // 5초 후 만료

  getOrCreate(key: string, factory: () => Promise<Response>): Promise<Response> {
    // 만료된 요청 정리
    this.cleanup();

    const existing = this.pendingRequests.get(key);
    if (existing) {
      console.log(`[Request Dedup] 중복 요청 차단: ${key} (이전 요청 재사용)`);
      return existing.promise;
    }

    const promise = factory();
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });

    // 완료 후 제거
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });

    return promise;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.maxAge) {
        this.pendingRequests.delete(key);
      }
    }
  }

  reset(): void {
    this.pendingRequests.clear();
  }
}

// 전역 인스턴스

const requestDeduplicator = new RequestDeduplicator();

// 디버깅용: Request Deduplicator 리셋 함수 (콘솔에서 사용 가능)
if (typeof window !== 'undefined') {
  (window as any).resetApiCache = () => {
    
    requestDeduplicator.reset();
    console.log('[API 초기화] Request Deduplicator 초기화됨');
  };
}

// ============ 에러 메시지 헬퍼 ============

const getErrorMessage = (statusCode: number, defaultMessage: string = '오류가 발생했습니다.'): string => {
  switch (statusCode) {
    case 400:
      return '잘못된 요청입니다. 입력 정보를 확인해주세요.';
    case 401:
      return '로그인이 필요합니다.';
    case 403:
      return '접근 권한이 없습니다.';
    case 404:
      return '요청한 데이터를 찾을 수 없습니다.';
    case 408:
      return '요청 시간이 초과되었습니다. 다시 시도해주세요.';
    case 429:
      return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 500:
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 502:
    case 503:
      return '서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
    case 504:
      return '서버 응답 시간이 초과되었습니다. 다시 시도해주세요.';
    default:
      return defaultMessage;
  }
};

// ============ API 호출 헬퍼 (재시도 로직 포함) ============

const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  timeout: number = 30000
): Promise<Response> => {

  // 요청 중복 방지 (GET 요청만 - POST는 body stream 문제로 중복 방지 비활성화)
  const isGetRequest = options.method === 'GET' || !options.method;

  // POST 요청은 중복 방지 없이 바로 실행
  if (!isGetRequest) {
    return executeRequest();
  }

  // GET 요청만 중복 방지
  return requestDeduplicator.getOrCreate(url, executeRequest);

  async function executeRequest(): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 타임아웃 설정
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // API 성공
        if (response.ok) {
          
          return response;
        }

        // 4xx 에러는 재시도하지 않음
        if (response.status >= 400 && response.status < 500) {
          // 클라이언트 에러
          
          throw new NetworkError(
            getErrorMessage(response.status),
            response.status
          );
        }

        // 5xx 에러는 재시도
        if (response.status >= 500) {
          
          // 서버 에러 시 response body에서 실제 에러 메시지 추출 시도
          let errorMessage = getErrorMessage(response.status);
          try {
            const errorBody = await response.json();
            if (errorBody && errorBody.message) {
              errorMessage = errorBody.message;
            }
          } catch (e) {
            // JSON 파싱 실패 시 기본 메시지 사용
          }
          throw new NetworkError(
            errorMessage,
            response.status
          );
        }

        return response;

      } catch (error: any) {
        lastError = error;

        // AbortError (타임아웃)
        if (error.name === 'AbortError') {
          console.error(`API 타임아웃 (시도 ${attempt + 1}/${maxRetries}):`, url);
          

          if (attempt === maxRetries - 1) {
            throw new NetworkError('요청 시간이 초과되었습니다. 다시 시도해주세요.', 408);
          }
        }
        // 네트워크 에러
        else if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error(`네트워크 에러 (시도 ${attempt + 1}/${maxRetries}):`, error);
          

          if (attempt === maxRetries - 1) {
            throw new NetworkError('인터넷 연결을 확인해주세요.', undefined, error);
          }
        }
        // NetworkError는 그대로 전파
        else if (error instanceof NetworkError) {
          // 4xx 에러는 재시도하지 않음
          if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
            throw error;
          }

          if (attempt === maxRetries - 1) {
            throw error;
          }
        }
        // 기타 에러
        else {
          console.error(`API 호출 실패 (시도 ${attempt + 1}/${maxRetries}):`, error);
          

          if (attempt === maxRetries - 1) {
            throw new NetworkError(error.message || '서버와 통신 중 오류가 발생했습니다.');
          }
        }

        // 재시도 전 대기 (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`${delay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 모든 재시도 실패
    throw lastError || new NetworkError('서버와 통신 중 오류가 발생했습니다.');
  }
};

// 더미 데이터 생성 함수 (실제 딜라이브 데이터 기반)
const getDummyWorkOrders = (startDate: string, endDate: string): WorkOrder[] => {
  const customers = [
    "김철수", "박영희", "이민수", "최지은", "정우진", "한소영", "오준호", "신미래"
  ];

  const workTypes = [
    { type: WorkOrderType.AS, display: "A/S" },
    { type: WorkOrderType.Installation, display: "신규설치" },
    { type: WorkOrderType.Move, display: "이전설치" },
    { type: WorkOrderType.Change, display: "상품변경" },
    { type: WorkOrderType.Etc, display: "기타" }
  ];

  const statuses = [WorkOrderStatus.Pending, WorkOrderStatus.Completed, WorkOrderStatus.Cancelled];
  const addresses = [
    "서울시 송파구 석촌동 15번지 1호",
    "서울시 강남구 역삼동 123번지 5호", 
    "서울시 마포구 합정동 456번지 12호",
    "서울시 서초구 방배동 789번지 3호",
    "서울시 용산구 이촌동 321번지 8호",
    "서울시 종로구 인사동 654번지 2호",
    "서울시 중구 명동 987번지 15호",
    "서울시 성동구 성수동 147번지 7호"
  ];

  const dummyOrders: WorkOrder[] = customers.map((name, index) => {
    const workType = workTypes[index % workTypes.length];
    const status = statuses[index % statuses.length];
    const hour = 9 + (index % 8);
    const minute = (index % 4) * 15;

    return {
      id: `WRK${String(index + 1).padStart(3, '0')}`,
      type: workType.type,
      typeDisplay: workType.display,
      status: status,
      scheduledAt: `2025-09-30T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
      customer: {
        id: `CUST${String(index + 1).padStart(3, '0')}`,
        name: name,
        phone: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        address: addresses[index % addresses.length]
      },
      details: `${workType.display} 작업 요청`,
      assignedEquipment: [],
      directionId: `WRK${String(index + 1).padStart(3, '0')}`
    };
  });

  return dummyOrders;
};

// 로그인 API 응답 타입 (레거시 gds_user 필드 + AUTH_SO_List)
export interface LoginResponse {
  ok: boolean;
  userId?: string;
  userName?: string;
  userNameEn?: string;
  userRole?: string;
  corpNm?: string;
  crrId?: string;
  soId?: string;
  soNm?: string;
  mstSoId?: string;
  telNo?: string;
  telNo2?: string;   // SMS 발신번호 (레거시 gds_user.TEL_NO2)
  telNo3?: string;
  soYn?: string;
  deptCd?: string;
  deptNm?: string;
  empNo?: string;
  eml?: string;
  partnerYn?: string;
  rno?: string;
  position?: string;
  AUTH_SO_List?: Array<{
    SO_ID: string;
    SO_NM: string;
    MST_SO_ID: string;
  }>;
}

// 로그인 API
export const login = async (userId: string, password: string): Promise<LoginResponse> => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  try {
    const response = await fetchWithRetry(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({
        USR_ID: userId,
        USR_PWD: password
      }),
    }, 1); // 로그인은 재시도 1회만

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('로그인 API 호출 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
};


// 더미 모드 확인 함수
export const checkDemoMode = (): boolean => {
  return typeof window !== 'undefined' && localStorage.getItem('demoMode') === 'true';
};

// ============ 더미 데이터 생성 함수들 ============

const getDummySafetyChecks = (): SafetyCheck[] => {
  return [
    {
      INSP_ID: 'INSP001',
      SO_ID: '209',
      CRR_ID: '01',
      INSP_END_DT: '20251015',
      STTL_YN: 'Y',
      CUST_ID: 'CUST001',
      CUST_NM: '김철수',
      TEL_NO: '010-1234-5678',
      PASS_YN: 'Y',
      PROD_GRP_NM: '인터넷+TV'
    },
    {
      INSP_ID: 'INSP002',
      SO_ID: '209',
      CRR_ID: '01',
      INSP_END_DT: '20251014',
      STTL_YN: 'N',
      CUST_ID: 'CUST002',
      CUST_NM: '박영희',
      TEL_NO: '010-2345-6789',
      PASS_YN: 'N',
      FAIL_GRADE: 'B',
      DAPPR_RESN: '장비 불량',
      PROD_GRP_NM: '인터넷'
    },
    {
      INSP_ID: 'INSP003',
      SO_ID: '209',
      CRR_ID: '01',
      INSP_END_DT: '20251013',
      STTL_YN: 'Y',
      CUST_ID: 'CUST003',
      CUST_NM: '이민수',
      TEL_NO: '010-3456-7890',
      PASS_YN: 'Y',
      PROD_GRP_NM: '인터넷+TV+전화'
    }
  ];
};

const getDummyENSHistory = (): ENSHistory[] => {
  return [
    {
      MSG_TYP: 'KKO',
      SO_ID: '209',
      SO_NM: '송파지점',
      EML_SMS_SND_ID: 'MSG001',
      EML_SMS_SND_TP: '01',
      EML_SMS_SND_TP_NM: '작업완료',
      CUST_ID: 'CUST001',
      CUST_NM: '김철수',
      SEND_TYPE: '즉시',
      CELL_PHN: '010-1234-5678',
      SMS_RCV_NO: '1588-1234',
      MESSAGE: '안녕하세요. D\'LIVE입니다.\n작업이 완료되었습니다.',
      RESULT: '성공',
      RSLT_NM: '전송성공',
      REG_UID: 'A20230019',
      REG_NM: '김상주',
      SOSOK: '송파지점',
      REG_DATE: '2025-10-16 14:30',
      CREATE_TIME: '2025-10-16 14:30',
      SEND_TIME: '2025-10-16 14:30',
      RSLT_TIME: '2025-10-16 14:31',
      TM_RSLT: '정상'
    },
    {
      MSG_TYP: 'SMS',
      SO_ID: '209',
      SO_NM: '송파지점',
      EML_SMS_SND_ID: 'MSG002',
      EML_SMS_SND_TP: '02',
      EML_SMS_SND_TP_NM: '작업예정',
      CUST_ID: 'CUST002',
      CUST_NM: '박영희',
      SEND_TYPE: '예약',
      CELL_PHN: '010-2345-6789',
      SMS_RCV_NO: '1588-1234',
      MESSAGE: '내일 오전 10시 방문 예정입니다.',
      RESULT: '성공',
      RSLT_NM: '전송성공',
      REG_UID: 'A20230019',
      REG_NM: '김상주',
      SOSOK: '송파지점',
      REG_DATE: '2025-10-16 09:00',
      CREATE_TIME: '2025-10-16 09:00',
      SEND_TIME: '2025-10-16 09:01',
      RSLT_TIME: '2025-10-16 09:02',
      TM_RSLT: '정상'
    },
    {
      MSG_TYP: 'LMS',
      SO_ID: '209',
      SO_NM: '송파지점',
      EML_SMS_SND_ID: 'MSG003',
      EML_SMS_SND_TP: '03',
      EML_SMS_SND_TP_NM: '작업취소',
      CUST_ID: 'CUST003',
      CUST_NM: '이민수',
      SEND_TYPE: '즉시',
      CELL_PHN: '010-3456-7890',
      SMS_RCV_NO: '1588-1234',
      MESSAGE: '고객 요청으로 작업이 취소되었습니다.',
      RESULT: '실패',
      RSLT_NM: '전송실패',
      REG_UID: 'A20230019',
      REG_NM: '김상주',
      SOSOK: '송파지점',
      REG_DATE: '2025-10-15 16:00',
      CREATE_TIME: '2025-10-15 16:00',
      SEND_TIME: '2025-10-15 16:00',
      RSLT_TIME: '',
      TM_RSLT: '실패'
    }
  ];
};

const getDummyWorkResultSignals = (): WorkResultSignal[] => {
  return [
    {
      WRK_DRCTN_ID: 'WRK001',
      WRK_ID: '1008409324',
      CUST_ID: 'CUST001',
      CUST_NM: '김철수',
      SO_ID: '209',
      SO_NM: '송파지점',
      CRR_ID: '01',
      CRR_NM: 'LG',
      PROD_CD: 'PROD001',
      PROD_NM: '인터넷 100M',
      WRK_CD: '02',
      WRK_CD_NM: 'A/S',
      WRK_STAT_CD: '4',
      WRK_STAT_NM: '완료',
      SIGNAL_RESULT: '정상',
      SIGNAL_DATE: '2025-10-16 15:30'
    },
    {
      WRK_DRCTN_ID: 'WRK002',
      WRK_ID: '1008409325',
      CUST_ID: 'CUST002',
      CUST_NM: '박영희',
      SO_ID: '209',
      SO_NM: '송파지점',
      CRR_ID: '01',
      CRR_NM: 'LG',
      PROD_CD: 'PROD002',
      PROD_NM: '인터넷 500M + TV',
      WRK_CD: '01',
      WRK_CD_NM: '신규설치',
      WRK_STAT_CD: '2',
      WRK_STAT_NM: '진행중',
      SIGNAL_RESULT: '대기중'
    },
    {
      WRK_DRCTN_ID: 'WRK003',
      WRK_ID: '1008409326',
      CUST_ID: 'CUST003',
      CUST_NM: '이민수',
      SO_ID: '209',
      SO_NM: '송파지점',
      CRR_ID: '01',
      CRR_NM: 'LG',
      PROD_CD: 'PROD003',
      PROD_NM: '인터넷 1G',
      WRK_CD: '03',
      WRK_CD_NM: '이전설치',
      WRK_STAT_CD: '1',
      WRK_STAT_NM: '대기',
      SIGNAL_RESULT: '미전송'
    }
  ];
};

// 작업지시서별 실제 작업개수 조회
export const getWorkCountForDirection = async (directionId: string): Promise<number> => {
  try {
    const items = await getWorkReceipts(directionId);
    return items.length;
  } catch (error) {
    console.error('작업개수 조회 실패:', error);
    return 0;
  }
};

// 작업지시서별 상태별 작업개수 조회
export interface WorkStatusCounts {
  total: number;
  pending: number;   // 진행중
  completed: number; // 완료
  cancelled: number; // 취소
  // 상품그룹별 카운트 (D:DTV, I:ISP, V:VoIP, C:케이블)
  pendingByProdGrp?: Record<string, number>;
  completedByProdGrp?: Record<string, number>;
}

export const getWorkStatusCountsForDirection = async (directionId: string): Promise<WorkStatusCounts> => {
  try {
    const items = await getWorkReceipts(directionId);
    const counts: WorkStatusCounts = {
      total: items.length,
      pending: 0,
      completed: 0,
      cancelled: 0,
      pendingByProdGrp: {},
      completedByProdGrp: {}
    };

    items.forEach((item: any) => {
      // WRK_STAT_CD: 1:접수, 2:할당, 3:취소, 4:완료, 7:장비철거완료, 9:삭제
      const statCd = item.WRK_STAT_CD || item.status;
      // PROD_GRP: D(DTV), I(ISP), V(VoIP), C(케이블)
      const prodGrp = item.PROD_GRP || 'D';

      if (statCd === '4' || statCd === '7' || statCd === '완료') {
        // 4: 완료, 7: 장비철거완료 모두 완료 처리
        counts.completed++;
        counts.completedByProdGrp![prodGrp] = (counts.completedByProdGrp![prodGrp] || 0) + 1;
      } else if (statCd === '3' || statCd === '취소') {
        counts.cancelled++;
      } else {
        counts.pending++; // 그 외는 진행중 (1:접수, 2:할당)
        counts.pendingByProdGrp![prodGrp] = (counts.pendingByProdGrp![prodGrp] || 0) + 1;
      }
    });

    return counts;
  } catch (error) {
    console.error('상태별 작업개수 조회 실패:', error);
    return { total: 0, pending: 0, completed: 0, cancelled: 0, pendingByProdGrp: {}, completedByProdGrp: {} };
  }
};

// 작업 상세 목록 조회 API (receipts + directionId)
export const getWorkReceipts = async (directionId: string): Promise<any[]> => {
  // 더미 모드 체크
  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    return getMockWorkItems(directionId);
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetchWithRetry(`${API_BASE}/work/receipts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({
        WRK_DRCTN_ID: directionId
      }),
    });

    const apiData = await response.json();
    return apiData;

  } catch (error) {
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('작업 목록을 불러오는데 실패했습니다.');
  }
};

// 작업취소 API
export const cancelWork = async (cancelData: any): Promise<{ code: string; message: string }> => {
  // 더미 모드 체크
  const isDemoMode = typeof window !== 'undefined' && localStorage.getItem('demoMode') === 'true';
  
  if (isDemoMode) {
    // 1초 지연 후 성공 응답
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: "SUCCESS", message: "작업이 성공적으로 취소되었습니다 (더미)" };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/work/cancel`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(cancelData),
    });
    
    if (!response.ok) {
      throw new Error(`작업취소 실패: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('작업취소 API 호출 실패:', error);
    throw error;
  }
};

// API 엔드포인트: 환경별 최적화
export const API_BASE = typeof window !== 'undefined' ? (() => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  console.log('[작업상세 API] 현재 환경:', { hostname, protocol });

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://58.143.140.222:8080/api';  // 로컬 → 딜라이브 내부서버
  } else if (hostname === '52.63.131.157') {
    // EC2 환경: Express 프록시 사용 (딜라이브 내부에서도 8080 포트 접근 문제)
    return '/api';  // EC2 Express 서버의 프록시 사용
  } else {
    return '/api';  // Vercel 프록시
  }
})() : '/api';

// Helper function to map API's work type string to our enum
const mapWorkOrderType = (apiType: string): WorkOrderType => {
    switch (apiType) {
        case '신규설치': return WorkOrderType.Installation;
        case 'A/S': return WorkOrderType.AS;
        case '상품변경': return WorkOrderType.Change;
        case '이전설치': return WorkOrderType.Move;
        default: return WorkOrderType.Etc;
    }
};

// Helper function to map API's work status to our enum
// WRK_STAT_CD: 1:접수, 2:할당, 3:취소, 4:완료, 7:장비철거완료, 9:삭제
const mapWorkOrderStatus = (apiStatus: string, wrkStatCd?: string): WorkOrderStatus => {
    // WRK_STAT_CD 기반 매핑 (우선)
    if (wrkStatCd) {
        if (wrkStatCd === '4' || wrkStatCd === '7') {
            return WorkOrderStatus.Completed; // 4: 완료, 7: 장비철거완료
        } else if (wrkStatCd === '3') {
            return WorkOrderStatus.Cancelled;
        } else if (wrkStatCd === '1' || wrkStatCd === '2') {
            return WorkOrderStatus.Pending; // 1: 접수, 2: 할당
        }
    }

    // WRK_STAT 문자열 기반 매핑 (fallback)
    switch (apiStatus) {
        case '진행중': return WorkOrderStatus.Pending;
        case '완료': return WorkOrderStatus.Completed;
        case '취소': return WorkOrderStatus.Cancelled;
        default: return WorkOrderStatus.Pending; // Default to pending if unknown
    }
};


export const getWorkOrders = async ({ startDate, endDate }: { startDate: string, endDate: string }): Promise<WorkOrder[]> => {
  // 더미 모드 체크
  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    return getDummyWorkOrders(startDate, endDate);
  }

  const formattedStartDate = startDate.replace(/-/g, '');
  const formattedEndDate = endDate.replace(/-/g, '');

  const requestBody = {
    "WRKR_ID": "A20130708",
    "SO_ID": "209",
    "PROC_CL": "A02",
    "VIEW_TYP": "MOBILE",
    "SCH_HOPEDT_GB": "2",
    "PRT_STAT": "%",
    "WRK_DTL_TCD": "%",
    "HOPE_DT_STRT": formattedStartDate,
    "HOPE_DT_END": formattedEndDate,
    "PDA_WORK_STATUS": "%",
    "EMRG_YN": "",
    "WRK_CD": "",
    "DATE_GBN": ""
  };

  // 실제 딜라이브 JSON API 호출
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetchWithRetry(`${API_BASE}/work/directions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    const apiData = await response.json();
    console.log('📋 [directions] API 응답:');
    console.log(JSON.stringify(apiData, null, 2));

    // API 응답이 빈 배열이면 그대로 반환
    if (!Array.isArray(apiData) || apiData.length === 0) {
      return [];
    }

    // Transform the API data into the structure our app uses (WorkOrder[])
    const transformedData: WorkOrder[] = apiData.map((apiOrder: any) => {
      const date = apiOrder.HOPE_DT; // "20250923"
      const time = apiOrder.HOPE_TM; // "17:00"
      const scheduledAt = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time}:00`).toISOString();

      return {
        id: apiOrder.WRK_DRCTN_ID,
        type: mapWorkOrderType(apiOrder.WRK_CD_NM),
        typeDisplay: apiOrder.WRK_CD_NM || '기타',
        status: mapWorkOrderStatus(apiOrder.WRK_STAT, apiOrder.MIN_WRK_STAT_CD || apiOrder.WRK_STAT_CD),
        scheduledAt: scheduledAt,
        customer: {
          id: apiOrder.CUST_ID,
          name: apiOrder.CUST_NM,
          phone: apiOrder.CUST_TEL_NO || apiOrder.REQ_CUST_TEL_NO || '',  // 고객 전화번호
          address: apiOrder.ADDR,
          // VIP 정보 (레거시: LENGTH(VIP_GB) > 0 이면 VIP)
          isVip: !!(apiOrder.VIP_GB && String(apiOrder.VIP_GB).length > 0),
          vipLevel: apiOrder.VIP_GB === 'VIP_VVIP' ? 'VVIP' : (apiOrder.VIP_GB ? 'VIP' : undefined),
        },
        details: apiOrder.REQ_CTX,
        assignedEquipment: [],
        directionId: apiOrder.WRK_DRCTN_ID,
        // 설치상세위치 (거실, 안방 등) - 레거시 TCMCT_CTRT_INFO.INSTL_LOC에서 파싱
        installLocation: apiOrder.INSTL_LOC || '',
        // 필터링을 위한 작업 코드 추가
        WRK_CD: apiOrder.WRK_CD,              // 작업 코드 (예: '01', '02', '03')
        WRK_CD_NM: apiOrder.WRK_CD_NM,        // 작업 코드명 (예: '설치', '철거', 'A/S' - CMWT000 코드 테이블 값)
        WRK_DTL_TCD: apiOrder.WRK_DTL_TCD,    // 작업 상세 유형 코드
        // 상품/계약 정보 (장비정보변경 모달에서 사용)
        PROD_CD: apiOrder.PROD_CD,            // 상품 코드
        PROD_NM: apiOrder.PROD_NM,            // 상품명
        PROD_GRP: apiOrder.PROD_GRP,          // 상품 그룹 (D:DTV, V:VoIP, I:Internet 등)
        CTRT_ID: apiOrder.CTRT_ID,            // 계약 ID
        CTRT_STAT: apiOrder.CTRT_STAT,        // 계약 상태 코드 (10:설치예정, 20:정상, 30:일시정지, 90:해지완료)
        CTRT_STAT_NM: apiOrder.CTRT_STAT_NM,  // 계약 상태명
        SO_ID: apiOrder.SO_ID,                // 지점 ID
        SO_NM: apiOrder.SO_NM,                // 지점명
        CRR_ID: apiOrder.CRR_ID,              // 권역 ID
        // 작업완료 시 저장된 정보 (완료된 작업 조회용)
        CUST_REL: apiOrder.CUST_REL || '',           // 고객과의 관계
        UP_CTRL_CL: apiOrder.UP_CTRL_CL || '',       // 상향제어
        PSN_USE_CORP: apiOrder.PSN_USE_CORP || '',   // 인터넷 이용
        VOIP_USE_CORP: apiOrder.VOIP_USE_CORP || '', // VoIP 이용
        DTV_USE_CORP: apiOrder.DTV_USE_CORP || '',   // DTV 이용
        VIEW_MOD_CD: apiOrder.VIEW_MOD_CD || '',     // 시청모드 코드
        VIEW_MOD_NM: apiOrder.VIEW_MOD_NM || '',     // 시청모드 이름
        // VIP 정보
        VIP_GB: apiOrder.VIP_GB || '',               // VIP 구분 (VIP_TOP, VIP_VVIP 등)
      };
    });

    return transformedData;
  } catch (error) {
    console.error('API 호출 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('작업 목록을 불러오는데 실패했습니다.');
  }
};

/**
 * 작업 상세 정보 조회 (getWorkReceiptList)
 * 레거시: /customer/work/getWorkReceiptList.req
 * 완료된 작업의 상세 정보(CUST_REL, NET_CL, WRNG_TP 등)를 조회
 */
export interface WorkReceiptDetail {
  // 기본 정보
  WRK_ID: string;
  WRK_DRCTN_ID: string;
  RCPT_ID: string;
  CUST_ID: string;
  CUST_NM: string;
  CTRT_ID: string;
  WRK_CD: string;
  WRK_CD_NM: string;
  WRK_DTL_TCD: string;
  WRK_STAT_CD: string;
  WRK_STAT_CD_NM: string;
  // 완료 정보
  CUST_REL: string;           // 고객과의 관계
  MEMO: string;               // 처리내용
  WRKR_CMPL_DT: string;       // 작업완료일
  // 설치/철거 정보
  NET_CL: string;             // 망구분 코드
  NET_CL_NM: string;          // 망구분명
  WRNG_TP: string;            // 배선유형
  WRNG_TP_NM: string;         // 배선유형명
  INSTL_TP: string;           // 설치유형
  CB_WRNG_TP: string;         // 콤보배선유형
  CB_INSTL_TP: string;        // 콤보설치유형
  CUT_YN: string;             // 절단여부
  INOUT_LINE_TP: string;      // 인입선유형
  INOUT_LEN: string;          // 인입선길이
  BFR_LINE_YN: string;        // 기설선사용여부
  RCV_STS: string;            // 수신상태
  AV_JOIN_TP: string;
  RF_JOIN_TP: string;
  TAB_LBL: string;
  CVT_LBL: string;
  STB_LBL: string;
  SUBTAP_ID: string;
  PORT_NUM: string;
  EXTN_TP: string;            // 연장유형
  DVDR_YN: string;            // 분배기여부
  TERM_NO: string;            // 단자번호
  // 이용구분
  UP_CTRL_CL: string;         // 상향제어
  PSN_USE_CORP: string;       // 인터넷 이용
  VOIP_USE_CORP: string;      // VoIP 이용
  DTV_USE_CORP: string;       // DTV 이용
  VIEW_MOD_CD: string;        // 시청모드 코드
  VIEW_MOD_NM: string;        // 시청모드명
  INSTL_LOC: string;          // 설치위치
  TV_TYPE: string;
  // 기타
  PROD_CD: string;
  PROD_NM: string;
  PROD_GRP: string;
  SO_ID: string;
  SO_NM: string;
  CRR_ID: string;
}

export const getWorkReceiptDetail = async (params: {
  WRK_DRCTN_ID: string;
  WRK_ID?: string;
  SO_ID?: string;
}): Promise<WorkReceiptDetail | null> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    return null;
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const requestBody = {
      PROC_CL: 'A02',
      WRK_DRCTN_ID: params.WRK_DRCTN_ID,
      WRK_ID: params.WRK_ID || '',
      SO_ID: params.SO_ID || ''
    };

    console.log('[getWorkReceiptDetail] Requesting with:', requestBody);

    const response = await fetch(`${API_BASE}/work/receipts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('[getWorkReceiptDetail] HTTP Error:', response.status);
      return null;
    }

    const apiData = await response.json();
    console.log('[getWorkReceiptDetail] Response:', apiData);

    // API 응답이 배열이고 데이터가 있으면 WRK_ID로 필터링하여 해당 작업 반환
    if (Array.isArray(apiData) && apiData.length > 0) {
      // WRK_ID가 제공된 경우 해당 작업을 찾음
      if (params.WRK_ID) {
        // String 변환하여 비교 (API 응답이 숫자, params가 문자열일 수 있음)
        const matchedItem = apiData.find((item: any) => String(item.WRK_ID) === String(params.WRK_ID));
        if (matchedItem) {
          console.log('[getWorkReceiptDetail] Found matching WRK_ID:', params.WRK_ID, 'MEMO:', matchedItem.MEMO, 'NET_CL:', matchedItem.NET_CL);
          return matchedItem as WorkReceiptDetail;
        }
        console.log('[getWorkReceiptDetail] WRK_ID not found in response, params.WRK_ID:', params.WRK_ID, 'available WRK_IDs:', apiData.map((i: any) => i.WRK_ID));
      }
      // WRK_ID가 없거나 찾지 못한 경우 첫 번째 항목 반환
      return apiData[0] as WorkReceiptDetail;
    }

    return null;
  } catch (error) {
    console.error('[getWorkReceiptDetail] Error:', error);
    return null;
  }
};

// ============ 안전점검 API ============

// Safety checklist item from CHECKLIST_ITEMS table
export interface SafetyChecklistItem {
  ITEM_CD: string;       // Checklist item code
  ITEM_NM: string;       // Checklist item name
  CATEGORY: string;      // Category (personal, vehicle, equipment, worksite)
  REQUIRED_YN: string;   // Required flag (Y/N)
  DISPLAY_ORDER: number; // Display order
  USE_YN?: string;       // Use flag
}

/**
 * Get safety checklist items from DB (CHECKLIST_ITEMS table)
 * Legacy: /customer/work/getSafeCheckList_ForM.req
 */
export const getSafetyChecklistItems = async (params?: { SO_ID?: string; CRR_ID?: string; WRKR_ID?: string }): Promise<SafetyChecklistItem[]> => {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/customer/work/getSafeCheckList_ForM`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      body: JSON.stringify(params || {}),
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn(`[SafetyChecklist API] Failed: ${response.status}`);
      return [];
    }

    const result = await response.json();

    // Handle both { data: [...] } format and direct array
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    if (Array.isArray(result)) {
      return result;
    }
    return [];
  } catch (error) {
    console.warn('[SafetyChecklist API] Error:', error);
    return [];
  }
};

export interface SafetyCheck {
  INSP_ID: string;
  SO_ID: string;
  CRR_ID: string;
  INSP_END_DT: string;
  STTL_YN: string;
  WRK_ID?: string;
  CUST_ID?: string;
  CUST_NM?: string;
  TEL_NO?: string;
  PASS_YN?: string;
  FAIL_GRADE?: string;
  DAPPR_RESN?: string;
  PROD_GRP_NM?: string;
}

/**
 * 안전점검 목록 조회
 */
export const getSafetyChecks = async (params: { SO_ID: string; CRR_ID: string; INSP_DT_FROM?: string; INSP_DT_TO?: string; INSP_ID?: string }): Promise<SafetyCheck[]> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500)); // 로딩 시뮬레이션
    return getDummySafetyChecks();
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const queryParams = new URLSearchParams();
    queryParams.append('SO_ID', params.SO_ID);
    queryParams.append('CRR_ID', params.CRR_ID);

    // 날짜 범위 파라미터 (필수)
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const inspDtFrom = params.INSP_DT_FROM || formatDate(threeMonthsAgo);
    const inspDtTo = params.INSP_DT_TO || formatDate(today);

    queryParams.append('INSP_DT_FROM', inspDtFrom);
    queryParams.append('INSP_DT_TO', inspDtTo);

    if (params.INSP_ID) queryParams.append('INSP_ID', params.INSP_ID);

    const response = await fetch(`${API_BASE}/work/safety-checks?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Origin': origin
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn(`[안전점검 API] 안전점검 조회 실패: ${response.status} - 기능이 서버에서 지원되지 않습니다`);
      return []; // 빈 배열 반환
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[안전점검 API] 안전점검 조회 실패 - 빈 결과 반환:', error);
    return []; // 에러 시 빈 배열 반환
  }
};

/**
 * 안전점검 등록
 */
export const saveSafetyCheck = async (data: {
  INSP_ID?: string;
  SO_ID: string;
  CRR_ID: string;
  INSP_END_DT: string;
  REG_UID: string;
}): Promise<{ code: string; message: string }> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: 'SUCCESS', message: '안전점검이 등록되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/work/safety-check`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`안전점검 등록 실패: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('안전점검 등록 실패:', error);
    throw error;
  }
};

// ============ 신호연동관리 API ============

export interface ENSHistory {
  MSG_TYP: string;
  SO_ID: string;
  SO_NM: string;
  EML_SMS_SND_ID: string;
  EML_SMS_SND_TP: string;
  EML_SMS_SND_TP_NM: string;
  CUST_ID: string;
  CUST_NM: string;
  SEND_TYPE: string;
  CELL_PHN: string;
  SMS_RCV_NO: string;
  MESSAGE: string;
  RESULT: string;
  RSLT_NM: string;
  REG_UID: string;
  REG_NM: string;
  SOSOK: string;
  REG_DATE: string;
  CREATE_TIME: string;
  SEND_TIME: string;
  RSLT_TIME: string;
  TM_RSLT: string;
  KKO_MSG_ID?: string;
  TBL_INFO?: string;
}

/**
 * ENS 전송 이력 조회
 */
export const getENSHistory = async (params: {
  CUST_ID?: string;
  DEST_INFO?: string;
  REG_DATE1?: string;
  REG_DATE2?: string;
  RSLT_DATE1?: string;
  RSLT_DATE2?: string;
  SO_ID?: string;
  CRR_ID?: string;
  EML_SMS_SND_TP?: string;
  SMS_RESULT?: string;
  SMS_PROCESS?: string;
}): Promise<ENSHistory[]> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return getDummyENSHistory();
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });

    const response = await fetch(`${API_BASE}/signal/ens-history?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Origin': origin
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn(`[ENS API] ENS 이력 조회 실패: ${response.status} - 기능이 서버에서 지원되지 않습니다`);
      return []; // 빈 배열 반환
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[ENS API] ENS 이력 조회 실패 - 빈 결과 반환:', error);
    return []; // 에러 시 빈 배열 반환
  }
};

// ============ 작업결과신호현황 API ============

export interface WorkResultSignal {
  WRK_DRCTN_ID: string;
  WRK_ID: string;
  CUST_ID: string;
  CUST_NM: string;
  SO_ID: string;
  SO_NM: string;
  CRR_ID: string;
  CRR_NM: string;
  PROD_CD: string;
  PROD_NM: string;
  WRK_CD: string;
  WRK_CD_NM: string;
  WRK_STAT_CD: string;
  WRK_STAT_NM: string;
  SIGNAL_RESULT?: string;
  SIGNAL_DATE?: string;
  ERROR_MSG?: string;
}

/**
 * 작업결과신호현황 조회
 */
export const getWorkResultSignals = async (params: {
  WRK_DRCTN_ID?: string;
  WRK_ID?: string;
  CUST_ID?: string;
  SO_ID?: string;
  CRR_ID?: string;
  PROD_CD?: string;
}): Promise<WorkResultSignal[]> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return getDummyWorkResultSignals();
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });

    const response = await fetch(`${API_BASE}/work/result-signals?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Origin': origin
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.warn(`[작업신호 API] 작업결과신호 조회 실패: ${response.status} - 기능이 서버에서 지원되지 않습니다`);
      return []; // 빈 배열 반환
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('[작업신호 API] 작업결과신호 조회 실패 - 빈 결과 반환:', error);
    return []; // 에러 시 빈 배열 반환
  }
};

// ============ LGU 관련 API ============

export interface LGUConstructionRequest {
  WRK_ID: string;
  CUST_ID: string;
  CTRT_ID: string;
  CRR_ID: string;
  SO_ID: string;
  WRKR_ID: string;
  PROD_CD: string;
  REG_UID: string;
}

export interface LGUNetworkFault {
  CTRT_ID: string;
  CUST_ID: string;
  WRK_ID: string;
  CRR_ID: string;
  SO_ID: string;
  REG_UID: string;
  CANCEL_TYPE?: string;
}

/**
 * LGU 공사요청진행정보 (LDAP 요청)
 */
export const requestLGUConstruction = async (data: LGUConstructionRequest): Promise<any> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return [{ 
      code: 'SUCCESS', 
      message: 'LGU 공사요청이 완료되었습니다 (더미)',
      REQUEST_ID: 'LGU' + Date.now(),
      STATUS: '접수완료'
    }];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/lgu/construction-request`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`LGU 공사요청 실패: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('LGU 공사요청 실패:', error);
    throw error;
  }
};

/**
 * LGU 공사요청 목록 조회
 */
export const getLGUConstructionList = async (params: any): Promise<any[]> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 더미 데이터
    return [
      {
        CONSREQNO: '20240101001',
        CTRT_ID: 'CTRT001',
        CONSCHRRNM: '김철수',
        CONSCHRRTLNO: '010-1234-5678',
        CONSCHRRMAKRMKS: 'LGU+ 인터넷 회선 공사요청',
        CONSFNSHSCDLDT: '20240115',
        CONSFNSHDT: '20240114',
        CONSNEEDDIVSNM: '신규설치',
        CONSDLYRSNNM: '',
        CONSIPSBPRSSDT: '',
        CONSIPSBRSNNM: '',
        CONSNREQPRSSDT: '',
        CONSNREQRSNNM: '',
        ENTR_NO: '500030621784',
        ENTR_RQST_NO: '300241327941',
        MSTR_FL: 'Y',
        SBGNEGNRNM: 'LGU+'
      },
      {
        CONSREQNO: '20240102002',
        CTRT_ID: 'CTRT002',
        CONSCHRRNM: '이영희',
        CONSCHRRTLNO: '010-2345-6789',
        CONSCHRRMAKRMKS: '속도 업그레이드 요청',
        CONSFNSHSCDLDT: '20240120',
        CONSFNSHDT: '',
        CONSNEEDDIVSNM: '회선변경',
        CONSDLYRSNNM: '장비 부족',
        CONSIPSBPRSSDT: '',
        CONSIPSBRSNNM: '',
        CONSNREQPRSSDT: '',
        CONSNREQRSNNM: '',
        ENTR_NO: '500030621785',
        ENTR_RQST_NO: '300241327942',
        MSTR_FL: 'Y',
        SBGNEGNRNM: 'LGU+'
      }
    ];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/customer/etc/getUplsRqstConsList.req`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`LGU 공사요청 목록 조회 실패: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('LGU 공사요청 목록 조회 실패:', error);
    throw error;
  }
};

/**
 * LGU 망장애이관리스트 (엔트 처리 취소)
 */
export const requestLGUNetworkFault = async (data: LGUNetworkFault): Promise<any> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return [{
      code: 'SUCCESS',
      message: 'LGU 망장애 처리가 완료되었습니다 (더미)',
      CANCEL_ID: 'FAULT' + Date.now(),
      STATUS: '취소완료'
    }];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetch(`${API_BASE}/lgu/network-fault`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`LGU 망장애 처리 실패: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('LGU 망장애 처리 실패:', error);
    throw error;
  }
};

// ============ 장비 관리 API ============

/**
 * 장비 정보 인터페이스
 */
export interface EquipmentInfo {
  EQT_ID: string;           // 장비 ID
  EQT_TP_CD: string;        // 장비 유형 코드
  EQT_TP_NM: string;        // 장비 유형명 (모뎀, 셋톱박스 등)
  EQT_MDL_CD: string;       // 장비 모델 코드
  EQT_MDL_NM: string;       // 장비 모델명
  SRLNO: string;            // 시리얼번호
  MAC_ADDR?: string;        // MAC 주소
  INSTL_LCTN?: string;      // 설치 위치
  ITEM_MID_CD?: string;     // 품목 중분류 코드 (04:모뎀, 05:셋톱박스, 07:특수장비, 03:추가장비)
  WRKR_ID?: string;         // 기사 ID
  SO_ID?: string;           // 지점 ID
  CRR_ID?: string;          // 통신사 ID
}

/**
 * 장비 정보 조회 응답 타입
 */
export interface EquipmentQueryResponse {
  contractEquipments: any[];      // output2: 계약 장비 (설치해야 할 장비)
  technicianEquipments: any[];    // output3: 기사 재고 장비
  customerEquipments: any[];      // output4: 고객 설치 장비
  removedEquipments: any[];       // output5: 회수 장비
  // output1: 프로모션/제품 정보 (설치정보 모달 필터링용)
  kpiProdGrpCd?: string;          // KPI 제품 그룹 코드 (V, I, C 등)
  prodChgGb?: string;             // 제품 변경 구분 (01=업그레이드, 02=다운그레이드)
  chgKpiProdGrpCd?: string;       // 변경 후 KPI 제품 그룹 코드
  prodGrp?: string;               // 제품 그룹 (V, I, C)
}

/**
 * 기사 보유 장비 조회 (실제로는 output2~5를 모두 반환)
 * @param params - 기사 ID, 지점 ID, 상품 코드 등
 */
export const getTechnicianEquipments = async (params: {
  WRKR_ID: string;          // 기사 ID
  SO_ID?: string;           // 지점 ID (선택, 미지정 시 SO 필터 해제)
  WORK_ID?: string;         // 작업 ID (프론트 호환용 - 레거시 WRK_ID로 변환됨)
  WRK_ID?: string;          // 작업 ID (레거시 명칭)
  PROD_CD?: string;         // 상품 코드 (특정 상품에 맞는 장비만 조회)
  CUST_ID?: string;         // 계약 ID
  CRR_TSK_CL?: string;      // 작업 유형 코드 (01:신규설치, 05:이전설치, 07:상품변경, 09:AS 등)
  WRK_DTL_TCD?: string;     // 작업 상세 타입 코드
  CTRT_ID?: string;         // 계약 ID (상품변경 시 DTL_CTRT_ID)
  OLD_CTRT_ID?: string;     // 기존 계약 ID (상품변경 시 원래 CTRT_ID)
  RCPT_ID?: string;         // 접수 ID
  CRR_ID?: string;          // 권역/통신사 ID
  ADDR_ORD?: string;        // 주소 순번
  WRK_CD?: string;          // 작업 코드
  WRK_STAT_CD?: string;     // 작업 상태 코드
  WRK_DRCTN_ID?: string;    // 작업지시 ID
  BLD_ID?: string;          // 건물 ID
}): Promise<EquipmentQueryResponse> => {
  // 더미 모드 체크 또는 실제 장비가 없을 때 테스트 데이터 사용
  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      contractEquipments: [
        {
          SVC_CMPS_ID: 'SVC001',
          ITEM_MID_NM: '모뎀',
          EQT_CL_NM: 'RS-M100',
          ITEM_MID_CD: '04',
        },
        {
          SVC_CMPS_ID: 'SVC002',
          ITEM_MID_NM: '셋톱박스',
          EQT_CL_NM: 'DTV-STB100',
          ITEM_MID_CD: '05',
        }
      ],
      technicianEquipments: [
        {
          EQT_NO: 'EQT001',
          ITEM_MID_NM: '모뎀',
          EQT_CL_NM: 'RS-M100',
          EQT_SERNO: 'RSM100001',
          ITEM_MID_CD: '04',
          MAC_ADDRESS: 'AA:BB:CC:DD:EE:01'
        },
        {
          EQT_NO: 'EQT002',
          ITEM_MID_NM: '모뎀',
          EQT_CL_NM: 'RS-M200',
          EQT_SERNO: 'RSM200001',
          ITEM_MID_CD: '04',
          MAC_ADDRESS: 'AA:BB:CC:DD:EE:02'
        },
        {
          EQT_NO: 'EQT003',
          ITEM_MID_NM: '셋톱박스',
          EQT_CL_NM: 'DTV-STB100',
          EQT_SERNO: 'DTV100001',
          ITEM_MID_CD: '05',
        },
        {
          EQT_NO: 'EQT004',
          ITEM_MID_NM: '셋톱박스',
          EQT_CL_NM: 'DTV-STB200',
          EQT_SERNO: 'DTV200001',
          ITEM_MID_CD: '05',
        }
      ],
      customerEquipments: [],
      removedEquipments: []
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    // 레거시와 동일한 파라미터 구성
    // IMPORTANT: 레거시는 WORK_ID가 아닌 WRK_ID를 사용 (mowoa03m05.xml fn_param_set 참조)
    const { WORK_ID, ...restParams } = params;
    const requestParams = {
      ...restParams,
      WRK_ID: params.WRK_ID || WORK_ID,  // WRK_ID 우선, 없으면 WORK_ID 사용
      EQT_SEL: '0',      // 레거시 필수 파라미터
      EQT_CL: 'ALL'      // 레거시 필수 파라미터
    };

    const response = await fetchWithRetry(`${API_BASE}/customer/work/getCustProdInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(requestParams),
    });

    const result = await response.json();

    // output1의 첫 번째 항목에서 필터링 데이터 추출 (설치정보 모달 필터링용)
    const promotionInfo = result?.output1?.[0] || {};

    // 철거 작업 여부: WRK_CD별로 output 매핑이 다름!
    // 레거시 mowoa03m02.xml (철거): "ds_prod_promo_info=output1 ds_rmv_eqt_info=output4"
    // 레거시 mowoa03m08.xml (이전철거): "ds_prod_promo_info=output1 ds_eqt_info=output2 ds_eqt_cust=output4 ds_rmv_eqt_info=output5"
    const isTerminateWork = requestParams.WRK_CD === '02';  // 철거(02)만 output4 사용

    // 철거(02): output4 = 철거장비, 고객장비 없음
    // 이전철거(08): output4 = 고객장비, output5 = 철거장비
    // 기타: output4 = 고객장비, output5 = 회수장비
    return {
      contractEquipments: result?.output2 || [],    // 계약 장비 (설치 대상)
      technicianEquipments: result?.output3 || [],  // 기사 재고
      customerEquipments: isTerminateWork ? [] : (result?.output4 || []),    // 철거(02)만 고객장비 비움
      removedEquipments: isTerminateWork ? (result?.output4 || []) : (result?.output5 || []),  // 철거(02): output4, 이전철거(08)/기타: output5
      // 설치정보 모달 필터링용 데이터 (output1에서 추출)
      kpiProdGrpCd: promotionInfo.KPI_PROD_GRP_CD,
      prodChgGb: promotionInfo.PROD_CHG_GB,
      chgKpiProdGrpCd: promotionInfo.CHG_KPI_PROD_GRP_CD,
      prodGrp: promotionInfo.PROD_GRP,
      // 상향제어 (output1 ds_prod_promo_info에서 추출)
      upCtrlCl: promotionInfo.UP_CTRL_CL,
    };
  } catch (error) {
    console.error('[fn:getTechnicianEquipments → req:getCustProdInfo] 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 정보를 불러오는데 실패했습니다.');
  }
};

/**
 * 장비 구성 정보 조회 (계약에 편성된 장비)
 */
export const getContractEquipments = async (params: {
  CUST_ID: string;          // 계약 ID
  PROD_CD?: string;         // 상품 코드
}): Promise<EquipmentInfo[]> => {
  console.log('📋 [fn:getContractEquipments → req:getCustProdInfo] API 호출:', params);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetchWithRetry(`${API_BASE}/customer/work/getCustProdInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({
        ...params,
        requestType: 'getEqtProdInfo' // 장비 구성 정보 조회 타입
      }),
    });

    const result = await response.json();
    console.log('[fn:getContractEquipments → req:getCustProdInfo] 성공:', result);
    return result;
  } catch (error) {
    console.error('[fn:getContractEquipments → req:getCustProdInfo] 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 구성 정보를 불러오는데 실패했습니다.');
  }
};

/**
 * 고객 장비 등록 (작업 완료 시 장비 정보 포함)
 * 작업 완료 API 호출 시 dataset에 장비 정보를 포함하여 전송
 */
export interface CustomerEquipmentRegistration {
  EQT_ID: string;           // 장비 ID
  SRLNO: string;            // 시리얼번호
  MAC_ADDR?: string;        // MAC 주소 (모뎀의 경우 필수)
  INSTL_LCTN?: string;      // 설치 위치
  ITEM_MID_CD: string;      // 품목 중분류 코드
  EQT_TP_CD: string;        // 장비 유형 코드
  EQT_MDL_CD: string;       // 장비 모델 코드
}

/**
 * 장비 구성 정보 변경
 * @param data - 장비 구성 정보 변경 요청 데이터
 */
export const updateEquipmentComposition = async (data: {
  WRK_ID: string;
  equipments: any[];
  RCPT_ID?: string;
  CTRT_ID?: string;
  PROM_CNT?: string; // 모달에서 선택한 약정 개월
  CUST_ID?: string;  // 레거시 기준 불필요(옵션으로 전환)
}): Promise<{ code: string; message: string }> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { code: 'SUCCESS', message: '장비 구성이 변경되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    // miPlatform 스타일 누적 필드 생성 (mowoa03p20.xml과 동일 로직)
    const rpad = (s: any, len: number, ch: string) => {
      const str = (s == null ? '' : String(s)).trim();
      if (str.length >= len) return str.substring(0, len);
      return str + new Array(len - str.length + 1).join(ch);
    };
    let PROD_GRPS = '';
    let PROD_CMPS_CLS = '';
    let PROD_CDS = '';
    let SVC_CDS = '';
    let ITEM_MID_CDS = '';
    let EQT_CLS = '';
    let LENTS = '';
    let EQT_USE_STATS = '';
    let EQT_SALE_AMTS = '';
    let ITLLMT_PRDS = '';
    let SERVICE_CNT = 0;

    // 레거시 그리드와 동일하게 장비 순서를 EQUIP_SEQ/SVC_CMPS_ID 기준으로 안정화
    const selectedOrdered = (data.equipments || [])
      .filter((eq: any) => String((eq as any).SEL || '1') === '1')
      .map((eq: any, idx: number) => ({ eq, order: Number((eq as any).EQUIP_SEQ || (eq as any).SVC_CMPS_ID || (idx + 1)), idx }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    for (let i = 0; i < selectedOrdered.length; i++) {
      const { eq, idx } = selectedOrdered[i];

      const prodGrp = String((eq as any).PROD_GRP || '');
      PROD_GRPS += prodGrp;

      // 레거시와 완전히 동일하게: 패딩 없이 그대로 연결
      const prodTyp = String((eq as any).PROD_TYP || '');
      const equipSeq = String((eq as any).EQUIP_SEQ || (eq as any).SVC_CMPS_ID || '');
      PROD_CMPS_CLS += prodTyp + equipSeq;

      PROD_CDS += String((eq as any).PROD_CD || '');
      SVC_CDS += String((eq as any).SVC_CD || '');

      const itemMidCd = rpad((eq as any).ITEM_MID_CD || (eq as any).EQT || (eq as any).EQT_CD || '', 10, ' ');
      ITEM_MID_CDS += itemMidCd;

      const eqtCl = rpad((eq as any).EQT_CL || (eq as any).EQT_CL_CD || '', 10, ' ');
      EQT_CLS += eqtCl;

      // 레거시와 완전히 동일하게: LENT 패딩 없이 그대로 연결
      const lent = String((eq as any).LENT || '');
      LENTS += lent;

      // 레거시와 완전히 동일하게: EQT_USE_STAT_CD를 1자리로 rpad
      const eqtUseStat = rpad(String((eq as any).EQT_USE_STAT_CD || ''), 1, ' ');
      EQT_USE_STATS += eqtUseStat;

      // EQT_SALE_AMTS는 레거시처럼 덮어쓰기 (누적 아님)
      EQT_SALE_AMTS = rpad((eq as any).EQT_SALE_AMT || 0, 10, ' ');

      const itllmtPrd = rpad((eq as any).ITLLMT_PRD || '00', 2, ' ');
      ITLLMT_PRDS += itllmtPrd;

      SERVICE_CNT += 1;
    }
    // ⭐️ [수정] 레거시 정확히 일치시키기 - CRR_ID, WRKR_ID, REG_UID 제거 (서버에서 세션으로 처리)
    const parameters = {
      RCPT_ID: data.RCPT_ID || '',
      WRK_ID: data.WRK_ID,
      CTRT_ID: data.CTRT_ID || '',
      PROD_GRPS,
      PROD_CMPS_CLS,
      PROD_CDS,
      SVC_CDS,
      ITEM_MID_CDS,
      EQT_CLS,
      LENTS,
      EQT_USE_STATS,
      EQT_SALE_AMTS,
      ITLLMT_PRDS,
      SERVICE_CNT: String(SERVICE_CNT),
      PROM_CNT: data.PROM_CNT || '',
    };

    // 재시도 없이 1회 호출 (fetchWithRetry 제거)
    const response = await fetch(`${API_BASE}/customer/work/eqtCmpsInfoChg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      // 레거시 호환: equipments/WRK_ID 등의 상위 키는 제외하고 parameters만 전송
      body: JSON.stringify({ parameters }),
    });

    if (!response.ok) {
      // 500 등 에러 본문을 MESSAGE로 변환
      let msg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        msg = errJson.MESSAGE || errJson.message || msg;
      } catch {
        try {
          const txt = await response.text();
          if (txt) msg = txt;
        } catch {}
      }
      throw new NetworkError(msg);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[eqtCmpsInfoChg] 장비 구성 정보 변경 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 구성 정보 변경에 실패했습니다.');
  }
};

/**
 * 상품별 장비 모델 리스트 조회
 * Legacy: /customer/receipt/contract/getEquipmentNmListOfProd.req
 * @param prodCd - 상품 코드
 * @param ctrtId - 계약 ID (선택)
 * @returns 장비 모델 리스트 (EQT_CD, EQT_CL_CD, EQT_CL_NM)
 */
export const getEquipmentModelsForProduct = async (
  prodCd: string,
  ctrtId?: string
): Promise<Array<{
  EQT_CD: string;      // ITEM_MID_CD (04:모뎀, 05:셋톱박스 등)
  EQT_CL_CD: string;   // 장비 클래스 코드 (모델 코드)
  EQT_CL_NM: string;   // 장비 클래스명 (모델명)
}>> => {
  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
      { EQT_CD: '05', EQT_CL_CD: 'STB001', EQT_CL_NM: 'STB-HD' },
      { EQT_CD: '05', EQT_CL_CD: 'STB002', EQT_CL_NM: 'STB-UHD' },
      { EQT_CD: '05', EQT_CL_CD: 'STB003', EQT_CL_NM: 'STB-4K' },
      { EQT_CD: '04', EQT_CL_CD: 'MDM001', EQT_CL_NM: 'DOCSIS 3.0' },
      { EQT_CD: '04', EQT_CL_CD: 'MDM002', EQT_CL_NM: 'DOCSIS 3.1' },
    ];
  }

  try {
    const requestBody: any = {
      EQT_SEL: "0",           // 레거시와 동일: 고정값
      PROD_CD: prodCd,
      BUGA_EQT_SEL: "Y",      // 레거시와 동일: 고정값
    };

    if (ctrtId) {
      requestBody.CTRT_ID = ctrtId;
    }

    const response = await fetch(`${API_BASE}/customer/receipt/contract/getEquipmentNmListOfProd`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // 백엔드에서 List를 직접 반환하므로 data 자체가 배열
    if (Array.isArray(data)) {
      return data;
    }

    // 에러 응답 처리
    if (data.code && data.message) {
      throw new Error(data.message || '장비 모델 리스트 조회 실패');
    }

    throw new Error('장비 모델 리스트 조회 실패: 잘못된 응답 형식');
  } catch (error) {
    console.error('[getEquipmentNmListOfProd] API 에러:', error);
    throw error;
  }
};

// 계약 장비 리스트 타입 정의
export interface ContractEquipment {
  SEL?: string;              // 선택 여부
  PROD_CD: string;           // 상품코드
  SVC_CD: string;            // 서비스코드
  PROD_TYP: string;          // 상품타입
  PROD_GRP: string;          // 상품그룹
  EQT: string;               // 장비코드 (EQT_CD, ITEM_MID_CD)
  EQT_CD: string;            // 장비코드 (동일)
  EQT_CL: string;            // 장비클래스 (모델코드)
  EQT_CL_NM: string;         // 장비클래스명 (모델명)
  ITM_MID_CD: string;        // 아이템중분류코드
  LENT: string;              // 임대구분 (10:구매, 30:렌탈, 31:할부 등)
  EQT_USE_STAT_CD: string;   // 장비사용상태
  ITLLMT_PRD: string;        // 할부기간
  LENT_YN: string;           // 임대여부
  EQT_SALE_AMT: number;      // 판매가
  EQUIP_SEQ: string;         // 장비순번
  EQT_BASIC_YN: string;      // 기본장비여부
  EQT_NM: string;            // 장비명
  CMPS_QTY_FROM?: string;    // 구성수량
}

// 서비스 구성 정보 타입
export interface ServiceComposition {
  ITEM_MID_CDS: string;      // 장비코드 목록 (10자리씩 연결)
  EQT_CLS: string;           // 모델코드 목록 (10자리씩 연결)
  LENTS: string;             // 임대구분 목록 (2자리씩 연결)
  EQT_USE_STATS: string;     // 사용상태 목록 (1자리씩 연결)
  ITLLMT_PRDS: string;       // 할부기간 목록 (2자리씩 연결)
  EQT_SALE_AMTS: string;     // 판매가 목록 (10자리씩 연결)
  PROD_CMPS_CLS?: string;    // 상품구성분류 (PROD_TYP + EQUIP_SEQ 연결)
  PROD_GRPS?: string;        // 상품그룹 목록
  PROD_CDS?: string;         // 상품코드 목록 (10자리씩 연결)
  SVC_CDS?: string;          // 서비스코드 목록 (10자리씩 연결)
}

// 장비 판매 상품 타입
export interface EquipmentSaleProduct {
  PRED: string;              // 선행여부
  EQT_USE_STAT_CD: string;   // 장비사용상태코드
  EQT_CL_CD: string;         // 장비클래스코드
  INSTL_PERD: string;        // 할부기간
}

// 공통코드 타입
export interface CommonCode {
  COMMON_CD: string;         // 공통코드
  COMMON_CD_NM: string;      // 공통코드명
  REF_CODE?: string;         // 참조코드
}

// 계약 장비 리스트 조회 응답
export interface ContractEquipmentListResponse {
  output1: ServiceComposition[];      // 서비스 구성 정보
  output2: ContractEquipment[];       // 계약 장비 리스트
  output3: EquipmentSaleProduct[];    // 장비 판매 상품 정보
}

/**
 * 계약 장비 리스트 조회 (전체 정보 포함)
 */
export const getContractEquipmentList = async (
  prodCd: string,
  ctrtId?: string
): Promise<ContractEquipmentListResponse> => {
  console.log('[fn:getContractEquipmentList → req:getContractEqtList] API 호출:');
  console.log('  - PROD_CD:', prodCd);
  console.log('  - CTRT_ID:', ctrtId);

  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      output1: [{
        ITEM_MID_CDS: '05        10        ',
        EQT_CLS: 'STB001    MDM001    ',
        LENTS: '1030',
        EQT_USE_STATS: '11',
        ITLLMT_PRDS: '0000',
        EQT_SALE_AMTS: '0         0         '
      }],
      output2: [
        {
          SEL: '1',
          PROD_CD: prodCd,
          SVC_CD: 'SVC001',
          PROD_TYP: '01',
          PROD_GRP: 'V',
          EQT: '05',
          EQT_CD: '05',
          EQT_CL: 'STB001',
          EQT_CL_NM: 'STB-HD',
          ITM_MID_CD: '05',
          LENT: '10',
          EQT_USE_STAT_CD: '1',
          ITLLMT_PRD: '00',
          LENT_YN: 'Y',
          EQT_SALE_AMT: 0,
          EQUIP_SEQ: '1',
          EQT_BASIC_YN: 'Y',
          EQT_NM: '셋톱박스'
        },
        {
          SEL: '1',
          PROD_CD: prodCd,
          SVC_CD: 'SVC001',
          PROD_TYP: '01',
          PROD_GRP: 'V',
          EQT: '04',
          EQT_CD: '04',
          EQT_CL: 'MDM001',
          EQT_CL_NM: 'DOCSIS 3.0',
          ITM_MID_CD: '04',
          LENT: '30',
          EQT_USE_STAT_CD: '1',
          ITLLMT_PRD: '00',
          LENT_YN: 'Y',
          EQT_SALE_AMT: 0,
          EQUIP_SEQ: '2',
          EQT_BASIC_YN: 'Y',
          EQT_NM: '모뎀'
        }
      ],
      output3: []
    };
  }

  try {
    const requestBody: any = {
      EQT_SEL: "0",
      PROD_CD: prodCd,
      BUGA_EQT_SEL: "Y",
    };

    if (ctrtId) {
      requestBody.CTRT_ID = ctrtId;
    }

    console.log('[fn:getContractEquipmentList → req:getContractEqtList] 요청:', requestBody);

    const response = await fetch(`${API_BASE}/customer/receipt/contract/getContractEqtList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[fn:getContractEquipmentList → req:getContractEqtList] 응답:', data);

    return data;
  } catch (error) {
    console.error('[fn:getContractEquipmentList → req:getContractEqtList] 에러:', error);
    throw error;
  }
};

/**
 * 공통코드 조회
 */
export const getCommonCodeList = async (
  codeIds: string[]  // ['CMCU027', 'CMEP314', 'CMCU064']
): Promise<{ [key: string]: CommonCode[] }> => {
  console.log('[공통코드 API] 공통코드 조회 API 호출:', codeIds);

  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 300));

    const result: { [key: string]: CommonCode[] } = {};

    if (codeIds.includes('CMCU027')) {
      // 임대구분
      result['CMCU027'] = [
        { COMMON_CD: '10', COMMON_CD_NM: '구매' },
        { COMMON_CD: '30', COMMON_CD_NM: '렌탈' },
        { COMMON_CD: '31', COMMON_CD_NM: '할부' },
        { COMMON_CD: '60', COMMON_CD_NM: '무상' },
      ];
    }

    if (codeIds.includes('CMEP314')) {
      // 장비사용상태
      result['CMEP314'] = [
        { COMMON_CD: '1', COMMON_CD_NM: '정상' },
        { COMMON_CD: '2', COMMON_CD_NM: '고장' },
        { COMMON_CD: '3', COMMON_CD_NM: '분실' },
      ];
    }

    if (codeIds.includes('CMCU064')) {
      // 프로모션개수
      result['CMCU064'] = [
        { COMMON_CD: '0', COMMON_CD_NM: '없음' },
        { COMMON_CD: '1', COMMON_CD_NM: '1개' },
        { COMMON_CD: '2', COMMON_CD_NM: '2개' },
        { COMMON_CD: '3', COMMON_CD_NM: '3개' },
      ];
    }

    if (codeIds.includes('CMCU057')) {
      // 인터넷 이용 구분
      result['CMCU057'] = [
        { COMMON_CD: '1', COMMON_CD_NM: '없음' },
        { COMMON_CD: '2', COMMON_CD_NM: '개인' },
        { COMMON_CD: '3', COMMON_CD_NM: '법인' },
      ];
    }

    if (codeIds.includes('CMCU110')) {
      // VoIP 이용 구분
      result['CMCU110'] = [
        { COMMON_CD: '1', COMMON_CD_NM: '없음' },
        { COMMON_CD: '2', COMMON_CD_NM: '개인' },
        { COMMON_CD: '3', COMMON_CD_NM: '법인' },
      ];
    }

    if (codeIds.includes('CMCU148')) {
      // 디지털방송 이용 구분
      result['CMCU148'] = [
        { COMMON_CD: '1', COMMON_CD_NM: '없음' },
        { COMMON_CD: '2', COMMON_CD_NM: '개인' },
        { COMMON_CD: '3', COMMON_CD_NM: '법인' },
      ];
    }

    if (codeIds.includes('CMCU005')) {
      // 고객관계
      result['CMCU005'] = [
        { COMMON_CD: '1', COMMON_CD_NM: '본인' },
        { COMMON_CD: '2', COMMON_CD_NM: '배우자' },
        { COMMON_CD: '3', COMMON_CD_NM: '자녀' },
        { COMMON_CD: '4', COMMON_CD_NM: '부모' },
        { COMMON_CD: '5', COMMON_CD_NM: '기타' },
      ];
    }

    if (codeIds.includes('CMCT015')) {
      // 상향제어
      result['CMCT015'] = [
        { COMMON_CD: '1', COMMON_CD_NM: '단독' },
        { COMMON_CD: '2', COMMON_CD_NM: '공용' },
      ];
    }

    return result;
  }

  try {
    const requestBody = {
      CODE_IDS: codeIds.join(',')  // "CMCU027,CMEP314,CMCU064" (JSON body)
    };
    console.log('[fn:getContractEquipmentList → req:getContractEqtList] 요청:', requestBody);

    const response = await fetch(`${API_BASE}/common/getCommonCodeList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[공통코드 API] getCommonCodeList 응답 데이터:', data);

    return data;
  } catch (error) {
    console.error('[공통코드 API] 공통코드 조회 API 에러:', error);
    throw error;
  }
};

// 그룹명 기반 공통코드 조회 (레거시 호환: 서버에서 CODE_IDS로 매핑)
export const getCommonCodeListByGroups = async (
  groupsCsv: string  // 'LENT,EQT_USE_STAT,ITLLMT_PRD'
): Promise<{ [key: string]: CommonCode[] }> => {
  try {
    const body = { P_COMM_GRP_CD: groupsCsv };
    const response = await fetch(`${API_BASE}/common/getCommonCodeList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[공통코드 API] 그룹 공통코드 조회 API 에러:', error);
    throw error;
  }
};

export const checkStbServerConnection = async (
  regUid: string,
  ctrtId: string,
  wrkId: string,
  msgId: string,
  stbEqtNo: string,
  modemEqtNo: string
): Promise<{
  MSGCODE: string;
  MESSAGE: string;
  O_IFSVC_RESULT?: string;
}> => {
  console.log('[STB API] 서버 연결 체크 API 호출');
  console.log('[STB API] 입력 파라미터:', { regUid, ctrtId, wrkId, msgId, stbEqtNo, modemEqtNo });

  const isDemoMode = checkDemoMode();

  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      MSGCODE: 'SUCCESS',
      MESSAGE: 'STB server connection check completed',
      O_IFSVC_RESULT: 'TRUE0000000001SMR03000000'
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = `${origin}/api/customer/work/checkStbServerConnection`;

    const requestBody = {
      REG_UID: regUid,
      CTRT_ID: ctrtId,
      WRK_ID: wrkId,
      MSG_ID: msgId,
      STB_EQT_NO: stbEqtNo,
      MODEM_EQT_NO: modemEqtNo
    };

    console.log('[STB API] API URL:', url);
    console.log('[STB API] 요청 데이터:', requestBody);
    console.log('[STB API] fetch 호출 시작...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[STB API] 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[STB API] HTTP 에러 응답:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[STB API] 응답 데이터:', data);

    // 백엔드가 배열로 응답하므로 첫 번째 요소 추출
    if (Array.isArray(data) && data.length > 0) {
      console.log('[STB API] 배열 응답 첫 번째 요소 추출:', data[0]);
      return data[0];
    }

    return data;
  } catch (error) {
    console.error('[STB API] STB 서버 연결 체크 API 에러:', error);
    throw error;
  }
};

/**
 * 장비 모델 정보 변경 (contract-item-model 변경)
 * @param equipments - 장비정보변경 배열 (각 장비마다 변경할 ITEM_MID_CD)
 * @param workId - 작업 ID
 * @param custId - 고객 ID
 */
export const changeEquipmentModel = async (
  equipments: Array<{
    CTRT_ID: string;
    RCPT_ID?: string;
    CRR_ID?: string;
    WRKR_ID: string;
    REG_UID: string;
    ITEM_MID_CD: string;  // 장비 타입 코드 (유지)
    EQT_CL: string;       // 변경할 장비 모델 코드
    SVC_CMPS_ID?: string; // 서비스 구성 ID
    PROD_CMPS_ID?: string; // 상품 구성 ID
  }>,
  workId: string,
  custId?: string
): Promise<{ MSGCODE: string; MESSAGE: string }> => {
  console.log('[fn:changeEquipmentModel → req:eqtCmpsInfoChg] API 호출:');
  console.log('  - 장비 개수:', equipments.length);
  console.log('  - WRK_ID:', workId);
  console.log('  - CUST_ID:', custId);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { MSGCODE: 'SUCCESS', MESSAGE: '장비 모델이 변경되었습니다 (더미)' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const requestBody = {
      WRK_ID: workId,
      CUST_ID: custId || '',
      equipments: equipments
    };

    console.log('\n[fn:changeEquipmentModel → req:eqtCmpsInfoChg] ==================');
    console.log('[fn:changeEquipmentModel → req:eqtCmpsInfoChg] 호출 시작');
    console.log('================================================================');
    console.log('\n📤 전송할 데이터:');
    console.log(JSON.stringify(requestBody, null, 2));
    console.log('==========================================\n');

    const response = await fetchWithRetry(`${API_BASE}/customer/work/eqtCmpsInfoChg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    console.log('\n[fn:changeEquipmentModel → req:eqtCmpsInfoChg] ==================');
    console.log('📥 응답');
    console.log('================================================================');
    console.log('  ├─ MSGCODE:', result.MSGCODE);
    console.log('  └─ MESSAGE:', result.MESSAGE);
    console.log('==========================================\n');

    if (result.MSGCODE !== 'SUCCESS' && result.MSGCODE !== '0') {
      throw new NetworkError(result.MESSAGE || '장비 모델 변경에 실패했습니다.');
    }

    return result;
  } catch (error) {
    console.error('❌ 장비 모델 변경 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 모델 변경에 실패했습니다.');
  }
};

/**
 * 신호 점검 (집선 조회)
 */
export interface SignalCheckRequest {
  CUST_ID: string;          // 계약 ID
  WRK_ID?: string;          // 작업 ID
  CHECK_TYPE: 'A' | 'B';    // A: 인터넷, B: TV/복합
  PROD_CD?: string;         // 상품 코드
}

export interface SignalCheckResult {
  checkType: 'A' | 'B';
  checkTime: string;
  status: 'success' | 'warning' | 'error';
  signalStrength?: number;
  speedTest?: {
    download: number;
    upload: number;
    ping: number;
  };
  deviceStatus?: {
    macAddress: string;
    connection: 'connected' | 'disconnected';
    ipAddress?: string;
  };
  tvSignal?: {
    channels: number;
    quality: number;
    errors: number;
  };
  issues?: string[];
}

/**
 * 신호 점검 API (집선 조회)
 */
export const checkSignal = async (params: SignalCheckRequest): Promise<SignalCheckResult> => {
  console.log('📡 신호 점검 API 호출:', params);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockResult: SignalCheckResult = {
      checkType: params.CHECK_TYPE,
      checkTime: new Date().toLocaleString('ko-KR'),
      status: Math.random() > 0.2 ? 'success' : 'warning',
      signalStrength: Math.floor(Math.random() * 30) + 70,
    };

    if (params.CHECK_TYPE === 'A') {
      mockResult.speedTest = {
        download: Math.floor(Math.random() * 200) + 100,
        upload: Math.floor(Math.random() * 50) + 20,
        ping: Math.floor(Math.random() * 20) + 5,
      };
      mockResult.deviceStatus = {
        macAddress: 'AA:BB:CC:DD:EE:FF',
        connection: 'connected',
        ipAddress: `192.168.1.${Math.floor(Math.random() * 200) + 10}`,
      };
    } else {
      mockResult.tvSignal = {
        channels: Math.floor(Math.random() * 50) + 100,
        quality: Math.floor(Math.random() * 20) + 80,
        errors: Math.floor(Math.random() * 5),
      };
    }

    if (mockResult.status === 'warning') {
      mockResult.issues = [
        '신호 품질이 기준치보다 약간 낮습니다.',
        '재점검을 권장합니다.',
      ];
    }

    return mockResult;
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const response = await fetchWithRetry(`${API_BASE}/customer/work/signalCheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 신호 점검 성공:', result);
    return result;
  } catch (error) {
    console.error('❌ 신호 점검 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('신호 점검에 실패했습니다.');
  }
};

// ============ 작업 완료 API ============

/**
 * 작업 완료 처리
 * 6가지 Dataset을 서버로 전송하여 작업을 완료 처리합니다.
 */
export const completeWork = async (data: WorkCompleteData): Promise<{ code: string; message: string; data?: any }> => {
  console.log('🚀 작업 완료 API 호출:', data);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      code: 'SUCCESS',
      message: '작업이 성공적으로 완료되었습니다 (더미)',
      data: {
        WRK_ID: data.workInfo.WRK_ID,
        WRK_STAT_CD: '4', // 완료
        CMPL_DT: data.workInfo.WRKR_CMPL_DT
      }
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    console.log('📡 실제 작업 완료 API 호출:', `${API_BASE}/customer/work/workComplete`);

    // 재시도 없이 1번만 호출 (maxRetries = 1)
    const response = await fetchWithRetry(`${API_BASE}/customer/work/workComplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(data),
    }, 1); // 재시도 없음

    console.log('📡 작업 완료 API 응답 상태:', response.status, response.statusText);

    const result = await response.json();
    console.log('✅ 작업 완료 API 성공:', result);

    // 서버가 배열을 반환하는 경우 (성공으로 간주)
    if (Array.isArray(result)) {
      console.log('✅ 배열 응답 감지 - 성공으로 처리');
      return {
        code: 'SUCCESS',
        message: '작업이 완료되었습니다.',
        data: result
      };
    }

    // 객체 응답인 경우 그대로 반환
    return result;
  } catch (error: any) {
    console.error('❌ 작업 완료 API 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(error.message || '작업 완료 처리 중 오류가 발생했습니다.');
  }
};

/**
 * 고객 계약 정보 조회
 * @param ctrtId 계약 ID
 * @returns 계약 정보
 */
export const getCustomerCtrtInfo = async (ctrtId: string): Promise<any> => {
  console.log('🔍 [고객 계약 정보] API 호출:', ctrtId);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      code: 'SUCCESS',
      data: [{
        CTRT_ID: ctrtId,
        CUST_ID: 'CUST001',
        CUST_NM: '홍길동',
        ADDR: '서울시 강남구 테헤란로 123',
        INSTL_LOC: '101동 1001호',
        BASIC_PROD_CD_NM: '인터넷+IPTV 결합',
        PROD_NM: '기가인터넷+IPTV',
        SO_NM: '강남지사',
        SO_CALL_NO: '02-1234-5678',
        PROM_YN: 'Y',
        CTRT_CL: '1'
      }]
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    console.log('📡 실제 고객 계약 정보 API 호출:', `${API_BASE}/customer/negociation/getCustomerCtrtInfo`);

    const response = await fetchWithRetry(`${API_BASE}/customer/negociation/getCustomerCtrtInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({ CTRT_ID: ctrtId }),
    });

    console.log('📡 고객 계약 정보 API 응답 상태:', response.status, response.statusText);

    const result = await response.json();
    console.log('✅ 고객 계약 정보 API 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 고객 계약 정보 API 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(error.message || '고객 계약 정보 조회 중 오류가 발생했습니다.');
  }
};

// ============ 설치 정보 관련 API ============

/**
 * 설치 정보 저장
 * @param installInfo 설치 정보
 * @returns 저장 결과
 */
export const saveInstallInfo = async (installInfo: InstallInfo): Promise<any> => {
  console.log('💾 [설치 정보 저장] API 호출:', installInfo);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      code: 'SUCCESS',
      message: '설치 정보가 저장되었습니다.'
    };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    console.log('📡 실제 설치 정보 저장 API 호출:', `${API_BASE}/customer/work/saveInstallInfo`);

    const response = await fetchWithRetry(`${API_BASE}/customer/work/saveInstallInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(installInfo),
    }, 1); // 재시도 없음

    console.log('📡 설치 정보 저장 API 응답 상태:', response.status, response.statusText);

    const result = await response.json();
    console.log('✅ 설치 정보 저장 API 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 설치 정보 저장 API 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(error.message || '설치 정보 저장 중 오류가 발생했습니다.');
  }
};

/**
 * 공통 코드 조회
 * @param codeGroup 코드 그룹 (예: CMCU048 - 망구분, BLST010 - 설치유형)
 * @returns 공통 코드 목록
 */
export const getCommonCodes = async (codeGroup: string): Promise<CommonCodeItem[]> => {
  console.log('🔍 [공통 코드 조회] API 호출:', codeGroup);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 300));

    // 코드 그룹별 더미 데이터
    const dummyData: { [key: string]: CommonCodeItem[] } = {
      'CMCU048': [ // 망구분
        { code: '1', name: 'HFC' },
        { code: '2', name: 'FTTH' },
        { code: '3', name: 'FTTB' }
      ],
      'BLST010': [ // 설치유형
        { code: '1', name: '신규' },
        { code: '2', name: '이전' },
        { code: '3', name: '재설치' }
      ],
      'BLST014': [ // 배선유형
        { code: '1', name: '단독' },
        { code: '2', name: '공용' },
        { code: '3', name: '기타' }
      ],
      'CMCU030': [ // 케이블배선유형
        { code: '1', name: '동축' },
        { code: '2', name: '광케이블' },
        { code: '3', name: 'UTP' }
      ],
      'BLST016': [ // 인입관통
        { code: '1', name: '관통' },
        { code: '2', name: '비관통' }
      ],
      'CMCU046': [ // 케이블설치유형
        { code: '1', name: '노출' },
        { code: '2', name: '은폐' },
        { code: '3', name: '반은폐' }
      ],
      'CMCU050': [ // AV접속유형
        { code: '1', name: 'HDMI' },
        { code: '2', name: 'Component' },
        { code: '3', name: 'Composite' }
      ],
      'CMCU051': [ // RF접속유형
        { code: '1', name: '동축' },
        { code: '2', name: '광' }
      ],
      'CMCU049': [ // 상향제어구분
        { code: '1', name: '양방향' },
        { code: '2', name: '단방향' }
      ]
    };

    return dummyData[codeGroup] || [];
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    console.log('📡 실제 공통 코드 조회 API 호출:', `${API_BASE}/common/getCommonCodes`);

    const response = await fetchWithRetry(`${API_BASE}/common/getCommonCodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify({ CODE_GROUP: codeGroup }),
    });

    console.log('📡 공통 코드 조회 API 응답 상태:', response.status, response.statusText);

    const result = await response.json();
    console.log('✅ 공통 코드 조회 API 성공:');
    console.log(JSON.stringify(result, null, 2));

    // 백엔드가 배열을 직접 반환 (다른 API와 동일)
    if (Array.isArray(result)) {
      // API 응답 필드(대문자)를 CommonCodeItem 형태(소문자)로 변환
      return result.map((item: any) => ({
        code: item.COMMON_CD || item.code || '',
        name: item.COMMON_CD_NM || item.name || '',
        description: item.DESCRIPTION || item.description || '',
        ref_code: item.REF_CODE || item.ref_code || '',
        ref_code2: item.REF_CODE2 || item.ref_code2 || '',
        ref_code3: item.REF_CODE3 || item.ref_code3 || '',
      }));
    }

    console.warn('⚠️ 예상치 못한 응답 형식:', result);
    return [];
  } catch (error: any) {
    console.error('❌ 공통 코드 조회 API 실패:', error);
    // 공통 코드 조회 실패 시 빈 배열 반환 (화면은 계속 동작하도록)
    return [];
  }
};

// ==================== 장비 할당/반납 처리 API ====================

/**
 * 기사 할당 장비 조회 (출고 리스트)
 * @param params 검색 조건
 * @returns 출고 리스트
 */
export const getEquipmentOutList = async (params: {
  FROM_OUT_REQ_DT: string;
  TO_OUT_REQ_DT: string;
  SO_ID?: string;
  OUT_REQ_NO?: string;
  PROC_STAT?: string;
}): Promise<any[]> => {
  console.log('📦 [getEquipmentOutList] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentOutList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 기사 할당 장비 조회 성공:', result);

    return Array.isArray(result) ? result : result.output1 || [];
  } catch (error: any) {
    console.error('❌ 기사 할당 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('기사 할당 장비 조회에 실패했습니다.');
  }
};

/**
 * 장비 할당 처리 확인
 * @param params 확인 조건
 * @returns 확인 결과
 */
export const checkEquipmentProc = async (params: {
  OUT_REQ_NO: string;
}): Promise<any> => {
  console.log('✔️ [fn:checkEquipmentProc → req:getEquipmentProcYnCheck] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentProcYnCheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 장비 할당 확인 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 장비 할당 확인 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 할당 확인에 실패했습니다.');
  }
};

/**
 * 장비 할당 처리 (입고)
 * @param params 할당 정보
 * @returns 처리 결과
 */
export const addEquipmentQuota = async (params: {
  OUT_REQ_NO: string;
  equipmentList: any[];
}): Promise<any> => {
  console.log('💼 [fn:addEquipmentQuota → req:addCorporationEquipmentQuota] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/addCorporationEquipmentQuota`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 장비 할당 처리 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 장비 할당 처리 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 할당 처리에 실패했습니다.');
  }
};

/**
 * 기사 보유 장비 조회 (반납용)
 * @param params 검색 조건
 * @returns 기사 보유 장비 리스트
 */
export const getEquipmentReturnRequestList = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
}): Promise<any[]> => {
  console.log('📋 [getEquipmentReturnRequestList] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentReturnRequestList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 기사 장비 조회 성공:', result);

    return Array.isArray(result) ? result : result.output1 || [];
  } catch (error: any) {
    console.error('❌ 기사 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('기사 장비 조회에 실패했습니다.');
  }
};

/**
 * 장비 반납 요청 확인
 * @param params 확인 조건
 * @returns 확인 결과
 */
export const checkEquipmentReturn = async (params: {
  EQT_NO: string;
  WRKR_ID: string;
}): Promise<any> => {
  console.log('✔️ [fn:checkEquipmentReturn → req:getEquipmentReturnRequestCheck] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentReturnRequestCheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 반납 확인 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 반납 확인 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('반납 확인에 실패했습니다.');
  }
};

/**
 * 장비 반납 요청
 * @param params 반납 정보
 * @returns 처리 결과
 */
export const addEquipmentReturnRequest = async (
  params: {
    WRKR_ID: string;
    CRR_ID: string;           // 협력업체 ID (필수!)
    SO_ID?: string;           // SO ID
    MST_SO_ID?: string;       // MST SO ID
    RETURN_TP?: string;       // 반납유형: 1=창고, 2=작업기사
    equipmentList: Array<{
      EQT_NO: string;
      EQT_SERNO?: string;
      RETN_RESN_CD?: string;
      ACTION?: string;
      EQT_USE_ARR_YN?: string;  // Y/A 값 유지
    }>;
  },
  onProgress?: (current: number, total: number, item: string) => void
): Promise<any> => {
  console.log('[addEquipmentReturnRequest] 반납요청 시작:', params);

  try {
    // 필수 파라미터 검증
    if (!params.WRKR_ID || !params.CRR_ID) {
      throw new NetworkError('사용자 정보가 필요합니다.');
    }
    if (!params.equipmentList || params.equipmentList.length === 0) {
      throw new NetworkError('반납요청할 장비를 선택해주세요.');
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const total = params.equipmentList.length;

    // CRITICAL FIX: 레거시 서비스가 _inserted_list 배치 형식을 지원하지 않음
    // 각 아이템별로 개별 API 호출 (단일 파라미터 형식만 작동함)
    let successCount = 0;
    let failedItems: string[] = [];
    let currentIdx = 0;

    for (const item of params.equipmentList) {
      currentIdx++;
      onProgress?.(currentIdx, total, item.EQT_SERNO || item.EQT_NO);
      // 단일 아이템 형식으로 전송
      const singleRequestBody = {
        EQT_NO: item.EQT_NO,
        EQT_SERNO: item.EQT_SERNO || '',
        RETN_RESN_CD: item.RETN_RESN_CD || '01',
        ACTION: item.ACTION || 'RETURN',
        WRKR_ID: params.WRKR_ID,
        CRR_ID: params.CRR_ID,
        SO_ID: params.SO_ID || '',
        MST_SO_ID: params.MST_SO_ID || params.SO_ID || '',
        RETURN_TP: params.RETURN_TP || '2',
        PROC_STAT: '1',
        RETN_PSN_ID: params.WRKR_ID,
        // 반납요청 시 EQT_USE_ARR_YN 제어 (레거시 로직)
        // - A(검사대기)면 A 유지
        // - 그 외(Y, null 등)는 N으로 변경
        EQT_USE_ARR_YN: item.EQT_USE_ARR_YN === 'A' ? 'A' : 'N',
      };

      console.log('[addEquipmentReturnRequest] 개별 호출:', item.EQT_SERNO, singleRequestBody);

      try {
        const response = await fetchWithRetry(`${API_BASE}/customer/equipment/addEquipmentReturnRequest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': origin
          },
          credentials: 'include',
          body: JSON.stringify(singleRequestBody),
        });

        const result = await response.json();
        console.log('[addEquipmentReturnRequest] 개별 응답:', item.EQT_SERNO, result);

        if (result && (result.MSGCODE === '0' || result.MSGCODE === 'SUCCESS' || result.success === true)) {
          successCount++;
        } else {
          failedItems.push(item.EQT_SERNO || item.EQT_NO);
        }
      } catch (itemError: any) {
        console.error('[addEquipmentReturnRequest] 개별 실패:', item.EQT_SERNO, itemError);
        failedItems.push(item.EQT_SERNO || item.EQT_NO);
      }
    }

    console.log('[addEquipmentReturnRequest] 완료: 성공', successCount, '/ 실패', failedItems.length);

    if (successCount > 0) {
      return {
        success: true,
        MSGCODE: 'SUCCESS',
        message: failedItems.length > 0
          ? `${successCount}건 반납요청 성공, ${failedItems.length}건 실패`
          : `${successCount}건의 반납요청이 등록되었습니다.`,
        data: { successCount, failedItems }
      };
    } else {
      throw new NetworkError(`반납요청 실패: ${failedItems.join(', ')}`);
    }

  } catch (error: any) {
    console.error('[addEquipmentReturnRequest] 반납요청 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(error.message || '반납 요청에 실패했습니다.');
  }
};

/**
 * 작업자(기사) 보유 장비 조회
 * @param params 검색 조건
 * @returns 장비 리스트
 */
export const getWorkerEquipmentList = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  ITEM_MID_CD?: string;
  EQT_SERNO?: string;
}): Promise<any[]> => {
  console.log('🔧 [fn:getWorkerEquipmentList → req:getWrkrHaveEqtList] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getWrkrHaveEqtList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 작업자 장비 조회 성공:', result);

    return Array.isArray(result) ? result : result.output1 || [];
  } catch (error: any) {
    console.error('❌ 작업자 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('작업자 장비 조회에 실패했습니다.');
  }
};

/**
 * 장비 분실 처리
 * @param params 분실 정보
 * @returns 처리 결과
 */
export const processEquipmentLoss = async (params: {
  EQT_NO: string;
  WRKR_ID: string;
  LOSS_REASON?: string;
}): Promise<any> => {
  console.log('⚠️ [fn:processEquipmentLoss → req:cmplEqtCustLossIndem] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/cmplEqtCustLossIndem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 분실 처리 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 분실 처리 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('분실 처리에 실패했습니다.');
  }
};

/**
 * 장비 상태 변경 (검사대기 → 사용가능)
 * @param params 변경 정보
 * @returns 처리 결과
 */
export const setEquipmentCheckStandby = async (params: {
  EQT_NO: string;
}): Promise<any> => {
  console.log('🔄 [fn:setEquipmentCheckStandby → req:setEquipmentChkStndByY_ForM] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetch(`${API_BASE}/customer/equipment/setEquipmentChkStndByY_ForM`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();

    // 디버그 로그 출력 (백엔드에서 전달)
    if (result.debugLogs) {
      console.log('📋 [백엔드 디버그 로그]');
      result.debugLogs.forEach((log: string) => console.log(log));
    }

    // HTTP 400: 비즈니스 규칙 오류 (한글 메시지)
    if (response.status === 400 && result.code === 'BUSINESS_RULE_ERROR') {
      console.error('❌ 비즈니스 규칙 오류:', result.message);
      throw new Error(result.message || '당일해지 장비만 사용가능으로 변경할 수 있습니다.');
    }

    // HTTP 500: 기술적 오류
    if (!response.ok) {
      console.error('❌ 장비 상태 변경 실패:', result);
      const errMsg = result.message || result.error || '장비 상태 변경에 실패했습니다.';
      throw new Error(errMsg);
    }

    console.log('✅ 장비 상태 변경 성공:', result);
    return result;
  } catch (error: any) {
    console.error('❌ 장비 상태 변경 실패:', error);
    // 이미 처리된 Error는 그대로 전달
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('장비 상태 변경에 실패했습니다.');
  }
};

// ==================== 장비 상태 조회 API ====================

/**
 * 장비 히스토리 정보 조회 (S/N 또는 MAC으로 조회)
 * @param params 검색 조건
 * @returns 장비 정보
 */
export const getEquipmentHistoryInfo = async (params: {
  EQT_SERNO?: string;
  MAC_ADDRESS?: string;
}): Promise<any> => {
  console.log('🔍 [getEquipmentHistoryInfo] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/statistics/equipment/getEquipmentHistoryInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 장비 조회 성공:', result);

    // API 응답이 { success: true, data: [...] } 형태인 경우 data 추출
    // 복수 결과를 위해 전체 배열 반환 (선택 팝업에서 처리)
    if (result.success && result.data) {
      return result.data;  // 배열 전체 반환
    }
    return result;
  } catch (error: any) {
    console.error('❌ 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('장비 조회에 실패했습니다.');
  }
};

/**
 * 장비 작업자 변경 (나에게 인수)
 * Oracle 프로시저 PCMEP_EQT_WRKR_CHG_3 직접 호출
 * @param params 변경 정보 (프로시저 필수 파라미터만)
 * @returns 처리 결과
 */
export const changeEquipmentWorker = async (params: {
  SO_ID: string;            // 장비 현재 위치 (필수)
  EQT_NO: string;           // 장비번호 (필수)
  EQT_SERNO: string;        // 장비 시리얼 (필수)
  CHG_UID: string;          // 변경자 ID (필수)
  MV_SO_ID: string;         // 이관 목적지 (필수)
  MV_CRR_ID: string;        // 이관 협력업체 (필수)
  MV_WRKR_ID: string;       // 이관 기사 (필수)
}): Promise<any> => {
  const apiCallId = `API_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const apiStartTime = Date.now();
  const timestamp = new Date().toISOString();

  // 백엔드 호환을 위해 TO_WRKR_ID도 추가
  const requestBody = {
    ...params,
    TO_WRKR_ID: params.MV_WRKR_ID,  // 백엔드 필수 파라미터
    WRKR_ID: params.MV_WRKR_ID,     // 레거시 호환
  };

  // ==================== 요청 시작 ====================
  console.log('');
  console.log('========== [fn:changeEquipmentWorker → req:changeEqtWrkr_3_ForM] 요청 시작 ==========');
  console.log('API_CALL_ID:', apiCallId);
  console.log('시작시간:', timestamp);
  console.log('');
  console.log('요청 파라미터 (전체):');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('=============================================');

  try {
    // 신규 API: changeEqtWrkr_3_ForM - Exception 대신 Map 반환 (2026-01-23)
    const apiUrl = `${API_BASE}/customer/equipment/changeEqtWrkr_3_ForM`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    console.log('API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - apiStartTime;
    const responseTimestamp = new Date().toISOString();

    // ==================== 응답 수신 ====================
    console.log('');
    console.log('========== 응답 수신 ==========');
    console.log('응답시간:', responseTimestamp);
    console.log('소요시간:', duration, 'ms');
    console.log('HTTP 상태:', response.status, response.statusText);
    console.log('response.ok:', response.ok);
    console.log('===============================');

    const responseText = await response.text();

    // ==================== RAW 응답 (가공 없이 그대로) ====================
    console.log('');
    console.log('========== RAW RESPONSE TEXT (원본 그대로) ==========');
    console.log(responseText);
    console.log('====================================================');
    console.log('');

    let result;
    try {
      result = JSON.parse(responseText);
      // JSON 파싱 성공 시 예쁘게 포맷팅해서도 출력
      console.log('========== PARSED JSON (포맷팅) ==========');
      console.log(JSON.stringify(result, null, 2));
      console.log('==========================================');
      console.log('');
      // 모든 키-값 쌍 출력
      console.log('========== 응답 필드 전체 목록 ==========');
      Object.keys(result).forEach(key => {
        console.log(`  ${key}: ${JSON.stringify(result[key])}`);
      });
      console.log('==========================================');
    } catch (parseError) {
      console.error(`[${apiCallId}] JSON 파싱 실패!`);
      console.error('Raw Text:', responseText);
      throw new Error('서버 응답 파싱 실패');
    }

    // ==================== 상세 로그: 응답 분석 ====================
    const msgCode = result?.MSGCODE;
    const message = result?.MESSAGE || result?.message || '';
    const debugId = result?.debugId || 'N/A';
    const procDuration = result?.procedureDurationMs || 'N/A';

    // 성공/실패 판단 로직
    const isHttpOk = response.ok;
    const isHttp500 = response.status === 500;
    const isMsgCodeEmpty = msgCode === undefined || msgCode === null || msgCode === '';
    const isMsgCodeZero = msgCode === '0';
    const isMsgCodeSuccess = msgCode === 'SUCCESS';
    const isMsgCodeFail = msgCode === 'FAIL';
    const hasErrorKeyword = message && (
      message.includes('없습니다') ||
      message.includes('실패') ||
      message.includes('ERROR') ||
      message.includes('error') ||
      message.includes('FAIL')
    );

    // 판단 로직 요약
    console.log('========== 성공/실패 판단 ==========');
    console.log(`HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`response.ok: ${isHttpOk}`);
    console.log(`MSGCODE: "${msgCode}" (type: ${typeof msgCode})`);
    console.log(`MESSAGE: "${message}"`);
    console.log(`MSGCODE === "SUCCESS": ${isMsgCodeSuccess}`);
    console.log(`MSGCODE === "FAIL": ${isMsgCodeFail}`);
    console.log(`에러키워드 포함: ${hasErrorKeyword}`);
    console.log('====================================');

    // ==================== 성공/실패 판단 (핵심 로직) ====================
    // 🎯 MSGCODE === "SUCCESS" 이면 HTTP 상태와 관계없이 성공!
    if (isMsgCodeSuccess) {
      console.log('');
      console.log('');
      console.log('========== 결과: 성공 (MSGCODE=SUCCESS) ==========');
      console.log('소요시간:', duration, 'ms');
      if (!isHttpOk) {
        console.log('주의: HTTP는 에러지만 MSGCODE=SUCCESS이므로 성공 처리!');
      }
      console.log('=================================================');
      return result;
    }

    // MSGCODE === "FAIL" 이면 무조건 에러
    if (isMsgCodeFail) {
      console.log('');
      console.log('========== 결과: 실패 (MSGCODE=FAIL) ==========');
      console.log('==============================================');
      throw new Error(message || 'Oracle 프로시저 실패 (MSGCODE=FAIL)');
    }

    // HTTP 에러 (4xx, 5xx) + MSGCODE가 SUCCESS가 아닌 경우
    if (!isHttpOk) {
      console.log('');
      console.log('========== 결과: HTTP 에러 ==========');
      console.log('=====================================');
      const errMsg = message || result?.error || result?.code || `서버 에러 (HTTP ${response.status})`;
      throw new Error(errMsg);
    }

    // HTTP OK (200-299)인 경우
    // 에러 키워드가 있으면 에러
    if (hasErrorKeyword) {
      console.log('');
      console.log('========== 결과: 에러 메시지 감지 ==========');
      console.log('===========================================');
      throw new Error(message);
    }

    // HTTP OK이고 에러 키워드가 없으면 성공
    console.log('');
    console.log('========== 결과: 성공 ==========');
    console.log('소요시간:', duration, 'ms');
    console.log('================================');
    return result;

  } catch (error: any) {
    const errorTimestamp = new Date().toISOString();
    const duration = Date.now() - apiStartTime;

    console.log('');
    console.log('========== 예외 발생 ==========');
    console.log('발생시간:', errorTimestamp);
    console.log('소요시간:', duration, 'ms');
    console.log('에러타입:', error.name);
    console.log('에러메시지:', error.message);
    console.log('파라미터:', JSON.stringify(params, null, 2));
    console.log('================================');

    if (error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다 (30초).');
    }
    throw error instanceof Error ? error : new Error('장비 이동에 실패했습니다.');
  }
};

// ==================== 기사 간 장비 이동 API ====================

/**
 * 작업자(기사) 검색
 * @param params 검색 조건
 * @returns 작업자 리스트
 */
export const findUserList = async (params: {
  USR_NM?: string;
  USR_ID?: string;
  SO_ID?: string;
  CRR_ID?: string;  // 협력업체 ID (필수)
}): Promise<any[]> => {
  console.log('🔍 [기사검색] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    // 검색 파라미터 정리 - 빈 값 제거, WRKR_NM도 추가 (백엔드 호환)
    const searchParams: any = {};
    if (params.USR_NM && params.USR_NM.trim()) {
      searchParams.USR_NM = params.USR_NM.trim();
      searchParams.WRKR_NM = params.USR_NM.trim(); // 백엔드 호환용
    }
    if (params.USR_ID && params.USR_ID.trim()) {
      searchParams.USR_ID = params.USR_ID.trim();
      searchParams.WRKR_ID = params.USR_ID.trim(); // 백엔드 호환용
    }
    if (params.SO_ID) {
      searchParams.SO_ID = params.SO_ID;
    }
    if (params.CRR_ID) {
      searchParams.CRR_ID = params.CRR_ID;  // 협력업체 필수
    }

    console.log('🔍 [기사검색] 정리된 파라미터:', searchParams);

    const response = await fetchWithRetry(`${API_BASE}/system/cm/getFindUsrList3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(searchParams),
    });

    const result = await response.json();
    console.log('✅ 기사 검색 결과:', result);

    // 다양한 응답 형태 처리
    if (Array.isArray(result)) {
      return result;
    }
    if (result.output1 && Array.isArray(result.output1)) {
      return result.output1;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  } catch (error: any) {
    console.error('❌ 기사 검색 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('기사 검색에 실패했습니다.');
  }
};

/**
 * 장비 마스터 정보 조회 (EQT_NO로 조회)
 * @param params EQT_NO 또는 EQT_SERNO
 * @returns 장비 마스터 정보
 */
export const getEqtMasterInfo = async (params: {
  EQT_NO?: string;
  EQT_SERNO?: string;
}): Promise<any> => {
  console.log('🔍 [getEqtMasterInfo] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEqtMasterInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 장비 마스터 조회 결과:', result);

    if (Array.isArray(result)) {
      return result;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    if (result.output1 && Array.isArray(result.output1)) {
      return result.output1;
    }
    return result;
  } catch (error: any) {
    console.error('❌ 장비 마스터 조회 실패:', error);
    throw error;
  }
};

/**
 * 문자 발송 (장비 인수 알림)
 * @param params 문자 정보
 * @returns 처리 결과
 */
export const sendSmsNotification = async (params: {
  RECV_PHONE_NO: string;
  MSG_CONTENT: string;
  SEND_UID: string;
}): Promise<any> => {
  console.log('📱 [문자발송] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/sigtrans/saveENSSendHist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 문자 발송 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 문자 발송 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('문자 발송에 실패했습니다.');
  }
};

// ==================== 문자발송이력 조회 API ====================

/**
 * 문자발송이력 조회
 * @param custId 고객 ID
 * @param startDate 시작일 (yyyyMMdd)
 * @param endDate 종료일 (yyyyMMdd)
 * @returns 문자발송이력 목록
 */
export interface SmsHistoryItem {
  EML_SMS_SND_TP_NM?: string;  // SMS유형 (작업완료, 작업예정 등)
  CELL_PHN?: string;           // 수신번호
  SMS_RCV_NO?: string;         // 발신번호
  RESULT?: string;             // 발송결과
  TM_RSLT?: string;            // 통화결과
  MSG_TYP?: string;            // 메시지타입 (KKO, SMS, LMS)
  MESSAGE?: string;            // 전송메시지
  SEND_TYPE?: string;          // 발송타입
  SEND_TIME?: string;          // 전송요청시간
  REG_NM?: string;             // 등록자명
  REG_DTTM?: string;           // 등록일시
}

export const getSmsHistory = async (
  custId: string,
  startDate?: string,
  endDate?: string
): Promise<SmsHistoryItem[]> => {
  console.log('📱 [문자발송이력] API 호출:', { custId, startDate, endDate });

  try {
    // 기본값: 최근 7일
    const today = new Date();
    const defaultEndDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const defaultStartDate = weekAgo.toISOString().slice(0, 10).replace(/-/g, '');

    const params = {
      CUST_ID: custId,
      SMS_PROCESS: 'ALL',
      REG_DATE1: startDate || defaultStartDate,
      REG_DATE2: endDate || defaultEndDate,
    };

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/sigtrans/getENSSendHist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 문자발송이력 조회 성공:', result);

    // 결과 파싱
    if (Array.isArray(result)) {
      return result;
    }
    if (result.output && Array.isArray(result.output)) {
      return result.output;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error: any) {
    console.error('❌ 문자발송이력 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('문자발송이력 조회에 실패했습니다.');
  }
};

// ==================== 미회수 장비 회수처리 API ====================

/**
 * 미회수 장비 조회
 * @param params 검색 조건
 * @returns 미회수 장비 리스트
 */
export const getUnreturnedEquipmentList = async (params: {
  FROM_DT?: string;
  TO_DT?: string;
  CUST_ID?: string;
  CTRT_ID?: string;
  CUST_NM?: string;
  EQT_SERNO?: string;
}): Promise<any[]> => {
  console.log('📦 [fn:getUnreturnedEquipmentList → req:getEquipLossInfo] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/work/getEquipLossInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 미회수 장비 조회 성공:', result);

    return Array.isArray(result) ? result : result.output1 || [];
  } catch (error: any) {
    console.error('❌ 미회수 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('미회수 장비 조회에 실패했습니다.');
  }
};

/**
 * 미회수 장비 회수 처리
 * Legacy: PCMWK_NOT_REV_EQT procedure
 * PROC_CL: 1=회수완료, 2=망실처리, 3=고객분실
 * @param params 회수 정보
 * @returns 처리 결과
 */
export const processEquipmentRecovery = async (params: {
  EQT_NO: string;
  PROC_CL: string;       // Required: 1=회수완료, 2=망실처리, 3=고객분실
  CTRT_ID?: string;
  CUST_ID?: string;
  SO_ID?: string;
  WRKR_ID?: string;
  CRR_ID?: string;
  WRK_ID?: string;
  EQT_SERNO?: string;
  CHG_UID?: string;
}): Promise<any> => {
  console.log('✅ [fn:processEquipmentRecovery → req:modEquipLoss] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/work/modEquipLoss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 회수 처리 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 회수 처리 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('회수 처리에 실패했습니다.');
  }
};

// ============================================================
// 계약정보 관련 API (Contract Info APIs)
// 레거시 negociationManagement 서비스 연동
// ============================================================

/**
 * 계약정보 통합 조회 (계약상세 + 청구/미납정보)
 *
 * 레거시 API 통합:
 * - getCustCtrtAll (계약 상세)
 * - getCustCtrtInfoListCnt_1 (청구/미납 정보)
 *
 * @param params.CUST_ID 고객ID (필수)
 * @param params.CTRT_ID 계약ID (선택 - 특정 계약만 필터링)
 * @returns 통합 계약 정보
 */
export const getFullContractInfo = async (params: {
  CUST_ID: string;
  CTRT_ID?: string;
}): Promise<{
  contracts: any[];
  billing: any;
  currentContract: any;
}> => {
  console.log('✅ [계약정보 통합] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/contract/getFullContractInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 계약정보 통합 조회 성공:', result);

    return {
      contracts: result.contracts || [],
      billing: result.billing || null,
      currentContract: result.currentContract || null
    };
  } catch (error: any) {
    console.error('❌ 계약정보 통합 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('계약정보 조회에 실패했습니다.');
  }
};

/**
 * 계약 상세 정보 조회 (getCustCtrtAll)
 *
 * 응답 필드:
 * - CTRT_ID, CUST_ID, PYM_ACNT_ID (계약 기본정보)
 * - RATE_STRT_DT, RATE_END_DT (약정 시작/종료일)
 * - PROM_CNT, CTRT_APLY_STRT_DT, CTRT_APLY_END_DT (약정 정보)
 * - GRP_ID, GRP_NM, SUBS_MOT, SUBS_MOT_NM (단체 정보)
 * - CUST_CL_DC_APLY_YN, PNTY_EXMP_YN, TERM_CALC_YN (신분할인/위약금)
 * - IP_CNT, VOIP_TEL_NO (VoIP 정보)
 * - BILL_AMT_NOW, BILL_AMT_BEFORE (청구금액)
 *
 * @param params.CUST_ID 고객ID (필수)
 * @param params.CTRT_ID 계약ID (선택)
 * @returns 계약 상세 정보 목록
 */
export const getCustomerContractInfo = async (params: {
  CUST_ID: string;
  CTRT_ID?: string;
}): Promise<any[]> => {
  console.log('✅ [계약상세] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/contract/getContractInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 계약상세 조회 성공:', result);

    return Array.isArray(result) ? result : [];
  } catch (error: any) {
    console.error('❌ 계약상세 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('계약상세 조회에 실패했습니다.');
  }
};

/**
 * 청구/미납 정보 조회 (getCustCtrtInfoListCnt_1)
 *
 * 응답 필드:
 * - DTV_CNT, DTV_LIV_CNT, DTV_DIE_CNT (DTV 계약 수)
 * - ISP_CNT, ISP_LIV_CNT, ISP_DIE_CNT (ISP 계약 수)
 * - VOIP_CNT, VOIP_LIV_CNT, VOIP_DIE_CNT (VoIP 계약 수)
 * - ACC_1 (선불금 잔액)
 * - ACC_2 (선결제 잔액 - 환불액)
 * - ACC_3 (선불료 잔액)
 * - ACC_4 (미납 청구액) ← 총 미납금
 *
 * @param params.CUST_ID 고객ID (필수)
 * @returns 청구/미납 정보
 */
export const getCustomerBillingInfo = async (params: {
  CUST_ID: string;
}): Promise<any> => {
  console.log('✅ [청구/미납] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/contract/getBillingInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 청구/미납 조회 성공:', result);

    // 보통 첫 번째 항목에 집계 정보가 있음
    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    return result;
  } catch (error: any) {
    console.error('❌ 청구/미납 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('청구/미납 조회에 실패했습니다.');
  }
};

// ============ 신호 전송 API (Signal Transmission) ============

/**
 * 신호 전송 결과 타입
 */
export interface SignalResult {
  code: 'SUCCESS' | 'PARTIAL' | 'ERROR';
  message: string;
  IF_DTL_ID?: string;
  MSG_ID?: string;
  WRK_ID?: string;
  resultCode1?: string;
  resultCode2?: string;
  rawResult?: string;
}

/**
 * 범용 신호 전송 파라미터 (modIfSvc)
 */
export interface SignalParams {
  MSG_ID: string;           // 신호 ID (SMR90:설치, SMR91:철거)
  CUST_ID: string;          // 고객 ID (필수)
  CTRT_ID: string;          // 계약 ID (필수)
  SO_ID: string;            // SO ID (필수)
  EQT_NO?: string;          // 장비 번호
  EQT_PROD_CMPS_ID?: string;// 장비 상품 구성 ID
  PROD_CD?: string;         // 상품 코드
  ITV_USR_ID?: string;      // ITV 사용자 ID
  IP_CNT?: string;          // IP 개수
  ETC_1?: string;           // 케이블모뎀 장비번호
  ETC_2?: string;           // 추가 장비번호
  ETC_3?: string;           // 추가 장비번호
  ETC_4?: string;           // WiFi 장비번호
  SUB_PROD_CD?: string;     // 부 상품 코드
  WRK_ID?: string;          // 작업 ID
  IF_DTL_ID?: string;       // IF 상세 ID
  NET_CL?: string;          // 망 구분
  REG_UID?: string;         // 등록자 ID
  VOIP_JOIN_CTRT_ID?: string; // VoIP 조인 계약 ID
  NEW_VOIP_TEL_NO?: string; // 신규 VoIP 전화번호
}

/**
 * 광랜 신호 전송 파라미터 (callMetroEqtStatusSearch)
 */
export interface MetroSignalParams {
  msg_id: string;           // 신호 ID (SMR82:포트정지, SMR83:포트개통, SMR87:포트리셋)
  cust_id: string;          // 고객 ID (필수)
  ctrt_id: string;          // 계약 ID (필수)
  so_id: string;            // SO ID (필수)
  eqt_no?: string;          // 장비 번호
  ip_cnt?: string;          // IP 개수
  wrk_id?: string;          // 작업 ID
  reg_uid?: string;         // 등록자 ID
}

/**
 * 범용 신호 전송 API (modIfSvc)
 * SMR90(설치), SMR91(철거) 등 일반 신호 전송
 *
 * @param params 신호 파라미터
 * @returns 신호 전송 결과
 */
export const sendSignal = async (params: SignalParams): Promise<SignalResult> => {
  console.log('📡 [신호전송] sendSignal 호출:', params.MSG_ID, params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/signal/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('📡 [신호전송] 응답:', result);

    return result as SignalResult;
  } catch (error: any) {
    console.error('❌ [신호전송] 실패:', error);
    return {
      code: 'ERROR',
      message: error.message || '신호 전송에 실패했습니다.',
      MSG_ID: params.MSG_ID
    };
  }
};

/**
 * 광랜 신호 전송 API (callMetroEqtStatusSearch)
 * SMR82(포트정지), SMR83(포트개통), SMR87(포트리셋)
 *
 * @param params 광랜 신호 파라미터
 * @returns 신호 전송 결과
 */
export const sendMetroSignal = async (params: MetroSignalParams): Promise<SignalResult> => {
  console.log('📡 [광랜신호] sendMetroSignal 호출:', params.msg_id, params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/signal/metro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('📡 [광랜신호] 응답:', result);

    return result as SignalResult;
  } catch (error: any) {
    console.error('❌ [광랜신호] 실패:', error);
    return {
      code: 'ERROR',
      message: error.message || '광랜 신호 전송에 실패했습니다.',
      MSG_ID: params.msg_id
    };
  }
};

/**
 * 포트 정지 API (SMR82)
 * 광랜 포트 정지 시 사용
 */
export const sendPortCloseSignal = async (params: Omit<MetroSignalParams, 'msg_id'>): Promise<SignalResult> => {
  console.log('📡 [포트정지] sendPortCloseSignal 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/signal/port-close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('📡 [포트정지] 응답:', result);

    return result as SignalResult;
  } catch (error: any) {
    console.error('❌ [포트정지] 실패:', error);
    return {
      code: 'ERROR',
      message: error.message || '포트 정지에 실패했습니다.',
      MSG_ID: 'SMR82'
    };
  }
};

/**
 * 포트 개통 API (SMR83)
 * 광랜 포트 개통 시 사용
 */
export const sendPortOpenSignal = async (params: Omit<MetroSignalParams, 'msg_id'>): Promise<SignalResult> => {
  console.log('📡 [포트개통] sendPortOpenSignal 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/signal/port-open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('📡 [포트개통] 응답:', result);

    return result as SignalResult;
  } catch (error: any) {
    console.error('❌ [포트개통] 실패:', error);
    return {
      code: 'ERROR',
      message: error.message || '포트 개통에 실패했습니다.',
      MSG_ID: 'SMR83'
    };
  }
};

/**
 * 포트 리셋 API (SMR87)
 * 광랜 포트 리셋 시 사용
 */
export const sendPortResetSignal = async (params: Omit<MetroSignalParams, 'msg_id'>): Promise<SignalResult> => {
  console.log('📡 [포트리셋] sendPortResetSignal 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/signal/port-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('📡 [포트리셋] 응답:', result);

    return result as SignalResult;
  } catch (error: any) {
    console.error('❌ [포트리셋] 실패:', error);
    return {
      code: 'ERROR',
      message: error.message || '포트 리셋에 실패했습니다.',
      MSG_ID: 'SMR87'
    };
  }
};

// ============ 인입선로 철거관리 API (Removal Line Management) ============

/**
 * 인입선로 철거상태 저장 (insertWorkRemoveStat)
 * - 레거시 customer/work/insertWorkRemoveStat.req 호출
 * - 철거배선상태, 철거상태, 미철거 사유 저장
 *
 * @param params.WRK_ID 작업 ID (필수)
 * @param params.REMOVE_LINE_TP 철거배선상태 (1:간선공용, 2:1:1배선, 3:공동인입, 4:단독인입)
 * @param params.REMOVE_GB 철거상태 (1:미철거, 4:완전철거)
 * @param params.REMOVE_STAT 미철거 사유 (5:출입불가, 6:2층1인, 7:특수지역)
 * @param params.REG_UID 등록자 ID
 * @returns 저장 결과
 */
export const insertWorkRemoveStat = async (params: {
  WRK_ID: string;
  REMOVE_LINE_TP: string;
  REMOVE_GB: string;
  REMOVE_STAT?: string;
  REG_UID?: string;
}): Promise<{ code: string; message: string }> => {
  console.log('[철거관리 API] insertWorkRemoveStat 호출:', params);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { code: 'SUCCESS', message: '철거상태가 저장되었습니다 (더미)' };
  }

  try {
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const userId = params.REG_UID || user.userId || 'A20130708';

    const requestData = {
      WRK_ID: params.WRK_ID,
      REMOVE_LINE_TP: params.REMOVE_LINE_TP,
      REMOVE_GB: params.REMOVE_GB,
      REMOVE_STAT: params.REMOVE_STAT || '',
      REG_UID: userId,
    };

    console.log('[철거관리 API] 요청 데이터:', requestData);

    const response = await fetch(`${API_BASE}/customer/work/insertWorkRemoveStat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestData),
    });

    const result = await response.json();
    console.log('[철거관리 API] 응답:', result);

    // 서버 응답이 배열이거나 성공 코드인 경우 성공으로 처리
    if (Array.isArray(result) || result.code === 'SUCCESS' || result.success === true) {
      return { code: 'SUCCESS', message: '철거상태가 저장되었습니다.' };
    } else {
      return {
        code: 'ERROR',
        message: result.message || result.msg || '철거상태 저장에 실패했습니다.'
      };
    }
  } catch (error: any) {
    console.error('[철거관리 API] 오류:', error);
    return {
      code: 'ERROR',
      message: error.message || '철거상태 저장 중 오류가 발생했습니다.',
    };
  }
};

/**
 * AS할당 (modAsPdaReceipt)
 * - 레거시 customer/work/modAsPdaReceipt.req 호출
 * - 미철거 시 AS작업 할당
 *
 * @param params AS할당 정보
 * @returns 저장 결과
 */
export const modAsPdaReceipt = async (params: {
  CUST_ID: string;
  RCPT_ID?: string;
  WRK_DTL_TCD: string;       // AS작업상세 (0380: 선로철거)
  WRK_RCPT_CL: string;       // AS접수유형 (JH: CS(전화회수))
  WRK_RCPT_CL_DTL: string;   // AS접수상세 (JHA:출입불가, JHB:2층1인, JHC:특수지역)
  WRK_HOPE_DTTM: string;     // 작업희망일시 (YYYYMMDDHHmm)
  MEMO?: string;
  EMRG_YN?: string;
  HOLY_YN?: string;
  CRR_ID?: string;
  WRKR_ID?: string;
  REG_UID?: string;
  // Address fields (from legacy ds_cust_info)
  POST_ID?: string;
  BLD_ID?: string;
  BLD_CL?: string;
  BLD_NM?: string;
  BUN_CL?: string;
  BUN_NO?: string;
  HO_NM?: string;
  APT_DONG_NO?: string;
  APT_HO_CNT?: string;
  ADDR?: string;
  ADDR_DTL?: string;
}): Promise<{ code: string; message: string }> => {
  console.log('[AS할당 API] modAsPdaReceipt 호출:', params);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { code: 'SUCCESS', message: 'AS가 할당되었습니다 (더미)' };
  }

  try {
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};
    const userId = params.REG_UID || user.userId || 'A20130708';
    const crrId = params.CRR_ID || user.crrId || '01';

    const requestData = {
      CUST_ID: params.CUST_ID,
      RCPT_ID: params.RCPT_ID || '',
      WRK_DTL_TCD: params.WRK_DTL_TCD,
      WRK_RCPT_CL: params.WRK_RCPT_CL,
      WRK_RCPT_CL_DTL: params.WRK_RCPT_CL_DTL,
      WRK_HOPE_DTTM: params.WRK_HOPE_DTTM,
      HOPE_DTTM: params.WRK_HOPE_DTTM,  // Same as WRK_HOPE_DTTM (legacy requirement)
      MEMO: params.MEMO || '',
      EMRG_YN: params.EMRG_YN || 'N',
      HOLY_YN: params.HOLY_YN || 'N',
      CRR_ID: crrId,
      WRKR_ID: params.WRKR_ID || userId,
      REG_UID: userId,
      WRK_DIV_ID: '',  // Empty (legacy requirement)
      // Address fields
      POST_ID: params.POST_ID || '',
      BLD_ID: params.BLD_ID || '',
      BLD_CL: params.BLD_CL || '',
      BLD_NM: params.BLD_NM || '',
      BUN_CL: params.BUN_CL || '',
      BUN_NO: params.BUN_NO || '',
      HO_NM: params.HO_NM || '',
      APT_DONG_NO: params.APT_DONG_NO || '',
      APT_HO_CNT: params.APT_HO_CNT || '',
      ADDR: params.ADDR || '',
      ADDR_DTL: params.ADDR_DTL || '',
    };

    console.log('[AS할당 API] 요청 데이터:', requestData);

    const response = await fetch(`${API_BASE}/customer/work/modAsPdaReceipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestData),
    });

    const result = await response.json();
    console.log('[AS할당 API] 응답:', result);

    // 서버 응답이 배열이거나 성공 코드인 경우 성공으로 처리
    if (Array.isArray(result) || result.code === 'SUCCESS' || result.success === true) {
      return { code: 'SUCCESS', message: 'AS가 할당되었습니다.' };
    } else {
      return {
        code: 'ERROR',
        message: result.message || result.msg || 'AS할당에 실패했습니다.'
      };
    }
  } catch (error: any) {
    console.error('[AS할당 API] 오류:', error);
    return {
      code: 'ERROR',
      message: error.message || 'AS할당 중 오류가 발생했습니다.',
    };
  }
};

// ============ Hot Bill (즉납) API ============

/**
 * Hot Bill 상세 정보
 */
export interface HotbillDetail {
  BILL_SEQ_NO: string;      // 청구 순번
  PROD_GRP: string;         // 상품그룹
  SO_ID: string;            // SO ID
  CHG_NM: string;           // 요금명
  BILL_AMT: number;         // 청구금액
  PYM_AMT: number;          // 납부금액
  UPYM_AMT: number;         // 미납금액
  BILL_DT?: string;         // 청구일
  PYM_DT?: string;          // 납부일
  CTRT_ID?: string;         // 계약 ID
  // 레거시 필드 (mocir23m01)
  SVC_NM?: string;          // 서비스명
  CHRG_ITM_NM?: string;     // 요금항목명
  RATE_ITM_TYP_CD?: string; // 요금항목유형코드
}

/**
 * Hot Bill 환불 정보
 */
export interface HotbillRefund {
  TOT_RFND_AMT: number;     // 총 환불금액
  RFND_RSN?: string;        // 환불 사유
}

/**
 * Hot Bill 요약 정보 (상세 + 환불)
 */
export interface HotbillSummary {
  details: HotbillDetail[];
  refund: HotbillRefund | null;
  totalAmount: number;      // 총 청구금액
  paidAmount: number;       // 납부금액
  unpaidAmount: number;     // 미납금액
  refundAmount: number;     // 환불금액
}

/**
 * Hot Bill 상세 조회
 * @param custId 고객 ID
 * @param rcptId 접수 ID
 */
export const getHotbillDetail = async (custId: string, rcptId: string): Promise<HotbillDetail[]> => {
  console.log('[Hotbill API] getHotbillDetail 호출:', { custId, rcptId });

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
      {
        BILL_SEQ_NO: '202412001',
        PROD_GRP: 'DTV',
        SO_ID: '01',
        CHG_NM: 'DTV 기본료',
        BILL_AMT: 15000,
        PYM_AMT: 15000,
        UPYM_AMT: 0,
      },
      {
        BILL_SEQ_NO: '202412002',
        PROD_GRP: 'ISP',
        SO_ID: '01',
        CHG_NM: '인터넷 기본료',
        BILL_AMT: 25000,
        PYM_AMT: 0,
        UPYM_AMT: 25000,
      },
    ];
  }

  try {
    const response = await fetch(`${API_BASE}/hotbill/detail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ CUST_ID: custId, RCPT_ID: rcptId }),
    });

    const result = await response.json();
    console.log('[Hotbill API] getHotbillDetail 응답:', result);

    if (Array.isArray(result)) {
      return result.map(item => ({
        ...item,
        BILL_AMT: Number(item.BILL_AMT) || 0,
        PYM_AMT: Number(item.PYM_AMT) || 0,
        UPYM_AMT: Number(item.UPYM_AMT) || 0,
      }));
    }

    return [];
  } catch (error: any) {
    console.error('[Hotbill API] getHotbillDetail 오류:', error);
    throw error;
  }
};

/**
 * Hot Bill 환불금액 조회
 * @param rcptId 접수 ID
 */
export const getHotbillRefund = async (rcptId: string): Promise<HotbillRefund | null> => {
  console.log('[Hotbill API] getHotbillRefund 호출:', { rcptId });

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      TOT_RFND_AMT: 5000,
      RFND_RSN: '해지 환불',
    };
  }

  try {
    const response = await fetch(`${API_BASE}/hotbill/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ RCPT_ID: rcptId }),
    });

    const result = await response.json();
    console.log('[Hotbill API] getHotbillRefund 응답:', result);

    if (Array.isArray(result) && result.length > 0) {
      return {
        ...result[0],
        TOT_RFND_AMT: Number(result[0].TOT_RFND_AMT) || 0,
      };
    }

    return null;
  } catch (error: any) {
    console.error('[Hotbill API] getHotbillRefund 오류:', error);
    throw error;
  }
};

/**
 * Hot Bill 요약 조회 (상세 + 환불 + 집계)
 * @param custId 고객 ID
 * @param rcptId 접수 ID
 */
export const getHotbillSummary = async (custId: string, rcptId: string): Promise<HotbillSummary> => {
  console.log('[Hotbill API] getHotbillSummary 호출:', { custId, rcptId });

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      details: [
        {
          BILL_SEQ_NO: '202412001',
          PROD_GRP: 'DTV',
          SO_ID: '01',
          CHG_NM: 'DTV 기본료',
          BILL_AMT: 15000,
          PYM_AMT: 15000,
          UPYM_AMT: 0,
        },
        {
          BILL_SEQ_NO: '202412002',
          PROD_GRP: 'ISP',
          SO_ID: '01',
          CHG_NM: '인터넷 기본료',
          BILL_AMT: 25000,
          PYM_AMT: 0,
          UPYM_AMT: 25000,
        },
      ],
      refund: {
        TOT_RFND_AMT: 5000,
        RFND_RSN: '해지 환불',
      },
      totalAmount: 40000,
      paidAmount: 15000,
      unpaidAmount: 25000,
      refundAmount: 5000,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/hotbill/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ CUST_ID: custId, RCPT_ID: rcptId }),
    });

    // 404 등 에러 응답 체크
    if (!response.ok) {
      console.error('[Hotbill API] HTTP 오류:', response.status);
      throw new Error(`Hot Bill API가 아직 배포되지 않았습니다. (HTTP ${response.status})`);
    }

    // Content-Type 체크 (HTML 응답 방지)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[Hotbill API] 잘못된 응답 형식:', contentType);
      throw new Error('Hot Bill API가 아직 배포되지 않았습니다.');
    }

    const result = await response.json();
    console.log('[Hotbill API] getHotbillSummary 응답:', result);

    return {
      details: Array.isArray(result.details) ? result.details.map((item: any) => ({
        ...item,
        BILL_AMT: Number(item.BILL_AMT) || 0,
        PYM_AMT: Number(item.PYM_AMT) || 0,
        UPYM_AMT: Number(item.UPYM_AMT) || 0,
      })) : [],
      refund: result.refund ? {
        ...result.refund,
        TOT_RFND_AMT: Number(result.refund.TOT_RFND_AMT) || 0,
      } : null,
      totalAmount: Number(result.totalAmount) || 0,
      paidAmount: Number(result.paidAmount) || 0,
      unpaidAmount: Number(result.unpaidAmount) || 0,
      refundAmount: Number(result.refundAmount) || 0,
    };
  } catch (error: any) {
    console.error('[Hotbill API] getHotbillSummary 오류:', error);
    throw error;
  }
};

/**
 * Hot Bill 시뮬레이션 실행 (calcHotbillSumul)
 *
 * IMPORTANT: 이 API는 getHotbillSummary 호출 전에 반드시 먼저 실행해야 함!
 * - TBLIV_SIMULATION_BILL 테이블에 청구금액 데이터를 생성함
 * - 시뮬레이션 없이 조회하면 0원이 반환됨
 *
 * @param params 시뮬레이션 파라미터
 * @returns 시뮬레이션 결과 (RCPT_ID 포함)
 */
export interface HotbillSimulateParams {
  CUST_ID: string;      // 고객 ID (필수)
  CTRT_ID: string;      // 계약 ID (필수)
  SO_ID: string;        // SO ID (필수)
  HOPE_DT: string;      // 해지희망일 YYYYMMDD (필수)
  CLC_WRK_CL?: string;  // 정산유형: "2"=해지, "6"=상품변경 (레거시 기준, 기본값: "2")
  RCPT_ID?: string;     // 접수 ID (없으면 자동 생성)
  IS_NEW?: string;      // 신규 시뮬레이션 여부 (기본값: "false")
  PNTY_EXMP_YN?: string; // 위약금 면제 여부: "Y"=면제, "N"=미면제 (기본값: "N")
}

export interface HotbillSimulateResult {
  code: string;
  RCPT_ID: string;
  message: string;
  simulatedCount?: number;
}

export const runHotbillSimulation = async (params: HotbillSimulateParams): Promise<HotbillSimulateResult> => {
  console.log('[Hotbill API] runHotbillSimulation 호출:', params);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      code: 'SUCCESS',
      RCPT_ID: params.RCPT_ID || '1044931550',
      message: 'OK (Demo)',
      simulatedCount: 1,
    };
  }

  try {
    const requestBody = {
      CUST_ID: params.CUST_ID,
      CTRT_ID: params.CTRT_ID,
      SO_ID: params.SO_ID,
      HOPE_DT: params.HOPE_DT,
      CLC_WRK_CL: params.CLC_WRK_CL || '2',  // 레거시 기준: 2=해지
      RCPT_ID: params.RCPT_ID || '',
      IS_NEW: params.IS_NEW || 'false',
      PNTY_EXMP_YN: params.PNTY_EXMP_YN || 'N',  // 위약금 면제 여부
    };

    const response = await fetch(`${API_BASE}/hotbill/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    // 404 등 에러 응답 체크
    if (!response.ok) {
      console.error('[Hotbill API] HTTP 오류:', response.status);
      throw new Error(`Hot Bill 시뮬레이션 API 오류 (HTTP ${response.status})`);
    }

    const result = await response.json();
    console.log('[Hotbill API] runHotbillSimulation 응답:', result);

    return {
      code: result.code || 'ERROR',
      RCPT_ID: result.RCPT_ID || '',
      message: result.message || '',
      simulatedCount: result.simulatedCount || 0,
    };
  } catch (error: any) {
    console.error('[Hotbill API] runHotbillSimulation 오류:', error);
    throw error;
  }
};

// ============ SMS/문자 발송 API ============

import { VisitSmsRequest } from '../types';

/**
 * 방문안내 문자 발송 API (saveENSSendHist)
 * Legacy: customer/sigtrans/saveENSSendHist.req
 *
 * @param data 문자 발송 요청 데이터
 * @returns 발송 결과
 */
export const sendVisitSms = async (data: VisitSmsRequest): Promise<{ code: string; message: string }> => {
  console.log('[SMS API] sendVisitSms 호출:', data);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      code: 'SUCCESS',
      message: '문자 발송이 완료되었습니다. (Demo)',
    };
  }

  try {
    const requestBody = {
      SMS_EML_TYPE: data.SMS_EML_TYPE,
      SO_ID: data.SO_ID,
      USER_SMS: data.USER_SMS.replace(/-/g, '').replace(/\s/g, ''),  // 하이픈, 공백 제거
      SEND_SMS: data.SEND_SMS.replace(/-/g, '').replace(/\s/g, ''),  // 하이픈, 공백 제거
      USER_ID: data.USER_ID,
      USER_NAME: data.USER_NAME,
      MAP01: data.MAP01,
      KKO_MSG_ID: data.KKO_MSG_ID,
      REG_UID: data.REG_UID,
      TRANS_YN: data.TRANS_YN || 'N',
      SMS_EML_CL: data.SMS_EML_CL || '20',  // 20: SMS
    };

    const response = await fetch(`${API_BASE}/customer/sigtrans/saveENSSendHist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    // HTTP 에러 체크
    if (!response.ok) {
      console.error('[SMS API] HTTP 오류:', response.status);
      throw new Error(`문자 발송 API 오류 (HTTP ${response.status})`);
    }

    const result = await response.json();
    console.log('[SMS API] sendVisitSms 응답:', result);

    // 응답 코드 확인
    if (result.MSGCODE === 'SUCCESS' || result.code === 'SUCCESS') {
      return {
        code: 'SUCCESS',
        message: result.MESSAGE || result.message || '문자 발송이 완료되었습니다.',
      };
    } else {
      return {
        code: result.MSGCODE || result.code || 'ERROR',
        message: result.MESSAGE || result.message || '문자 발송에 실패했습니다.',
      };
    }
  } catch (error: any) {
    console.error('[SMS API] sendVisitSms 오류:', error);
    throw error;
  }
};

// ============ 정지기간 관리 API ============

/**
 * 정지기간 정보 조회 API (getMmtSusInfo)
 * Legacy: /customer/etc/getMmtSusInfo.req
 *
 * @param params RCPT_ID, CTRT_ID
 * @returns 정지기간 정보
 */
export const getMmtSusInfo = async (params: {
  RCPT_ID: string;
  CTRT_ID: string;
}): Promise<{
  SUS_HOPE_DD: string;      // 정지시작일 (YYYYMMDD)
  MMT_SUS_HOPE_DD: string;  // 정지종료일 (YYYYMMDD)
  VALID_SUS_DAYS: string;   // 유효 정지일수
  MMT_SUS_CD: string;       // 정지 사유 코드
  WRK_DTL_TCD: string;      // 작업 상세 유형 코드
} | null> => {
  console.log('[정지기간 API] getMmtSusInfo 호출:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getMmtSusInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[정지기간 API] HTTP 오류:', response.status);
      throw new Error(`정지기간 조회 API 오류 (HTTP ${response.status})`);
    }

    const result = await response.json();
    console.log('[정지기간 API] getMmtSusInfo 응답:', result);

    // 응답 데이터 반환
    if (result && (result.SUS_HOPE_DD || result.output)) {
      const data = result.output ? result.output[0] : result;
      return {
        SUS_HOPE_DD: data.SUS_HOPE_DD || '',
        MMT_SUS_HOPE_DD: data.MMT_SUS_HOPE_DD || '',
        VALID_SUS_DAYS: data.VALID_SUS_DAYS || '',
        MMT_SUS_CD: data.MMT_SUS_CD || '',
        WRK_DTL_TCD: data.WRK_DTL_TCD || '',
      };
    }

    return null;
  } catch (error: any) {
    console.error('[정지기간 API] getMmtSusInfo 오류:', error);
    throw error;
  }
};

/**
 * 정지기간 수정 API (modMmtSusInfo)
 * Legacy: /customer/etc/modMmtSusInfo.req
 *
 * @param params 정지기간 수정 데이터
 * @returns 처리 결과
 */
export const modMmtSusInfo = async (params: {
  CTRT_ID: string;          // 계약 ID
  RCPT_ID: string;          // 접수 ID
  SUS_HOPE_DD: string;      // 정지시작일 (YYYYMMDD)
  MMT_SUS_HOPE_DD: string;  // 정지종료일 (YYYYMMDD)
  SUS_DD_NUM: string;       // 정지일수
  REG_UID: string;          // 등록자 ID
}): Promise<{ code: string; message: string }> => {
  console.log('[정지기간 API] modMmtSusInfo 호출:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/modMmtSusInfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[정지기간 API] HTTP 오류:', response.status);
      throw new Error(`정지기간 수정 API 오류 (HTTP ${response.status})`);
    }

    const result = await response.json();
    console.log('[정지기간 API] modMmtSusInfo 응답:', result);

    if (result.MSGCODE === 'SUCCESS' || result.code === 'SUCCESS') {
      return {
        code: 'SUCCESS',
        message: result.MESSAGE || result.message || '이용정지기간이 수정되었습니다.',
      };
    } else {
      return {
        code: result.MSGCODE || result.code || 'ERROR',
        message: result.MESSAGE || result.message || '정지기간 수정에 실패했습니다.',
      };
    }
  } catch (error: any) {
    console.error('[정지기간 API] modMmtSusInfo 오류:', error);
    throw error;
  }
};

// ============ Alarm API (Contract Info Alerts) ============

/**
 * Work Alarm Info Response
 */
export interface WorkAlarmInfo {
  OTT_SALE_DESC?: string;    // OTT sale description
  BUNDLE_ISP_TG?: string;    // Bundle product flag (Y/N)
  PYM_MTHD?: string;         // Payment method (01=auto transfer)
  ATMT_YN?: string;          // Auto transfer flag
  WRK_CD?: string;           // Work code
  RLNM_AUTH_YN_NM?: string;  // Real name auth status
  COUPON_VAL?: string;       // VOD coupon balance
  CUST_ID?: string;          // Customer ID
}

/**
 * VOD 6 Month Use Date Response
 */
export interface Vod6MonUseDateInfo {
  max_dt?: string;  // Last VOD request date (YYYYMMDD)
}

/**
 * Special Customer VOD5K Response
 */
export interface SpecialCustVod5kInfo {
  BIGO?: string;         // Special note
  SPECIAL_GB?: string;   // Special type
}

/**
 * Customer Special Bigo Response
 */
export interface CustSpecialBigoInfo {
  SPECIAL_GB?: string;    // Special type (G = general)
  BIGO?: string;          // Special note
  ATTN_CUST_YN?: string;  // Attention customer flag
}

/**
 * Customer Basic Info (from negociationDao.getCustInfo)
 */
export interface CustBasicInfo {
  CUST_ID?: string;
  CUST_NM?: string;
  SMS_RCV_YN?: string;        // 홍보문자 수신동의 (Y=동의, N=거부)
  SMS_YN?: string;            // 문자수신동의 상태 텍스트
  ATTN_CUST_YN?: string;      // 관심고객 여부
  RLNM_AUTH_YN?: string;      // 실명인증 여부
  RLNM_AUTH_YN_NM?: string;   // 실명인증 상태명
  COUPON_VAL?: string;        // VOD 쿠폰 잔액
  TEL_NO1?: string;           // 전화번호1
  TEL_NO2?: string;           // 전화번호2
  ADDR_FULL?: string;         // 전체주소
  AGREE_YN?: string;          // 동의여부
  AGREE_YN_01?: string;       // 영업TM동의
  CLOSE_DANGER?: string;      // 해지위험 여부
  [key: string]: any;         // 기타 필드들
}

/**
 * All Alarm Info Response (Combined)
 */
export interface AllAlarmInfo {
  workAlarm?: WorkAlarmInfo;
  vodLastDate?: Vod6MonUseDateInfo;
  specialVod5k?: SpecialCustVod5kInfo;
  specialBigo?: CustSpecialBigoInfo[];
  custBasicInfo?: CustBasicInfo;  // 고객기본정보 (negociationDao.getCustInfo)
}

/**
 * Get Work Alarm Info
 * @param wrkDrctnId Work direction ID
 */
export const getWorkAlarmInfo = async (wrkDrctnId: string): Promise<WorkAlarmInfo | null> => {
  console.log('[Alarm API] getWorkAlarmInfo:', wrkDrctnId);

  try {
    const response = await fetch(`${API_BASE}/customer/alarm/getWorkAlarmInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ WRK_DRCTN_ID: wrkDrctnId }),
    });

    if (!response.ok) {
      console.error('[Alarm API] HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[Alarm API] getWorkAlarmInfo response:', result);
    return result;
  } catch (error) {
    console.error('[Alarm API] getWorkAlarmInfo error:', error);
    return null;
  }
};

/**
 * Get VOD 6 Month Use Date
 * @param custId Customer ID
 */
export const getVod6MonUseDate = async (custId: string): Promise<Vod6MonUseDateInfo | null> => {
  console.log('[Alarm API] getVod6MonUseDate:', custId);

  try {
    const response = await fetch(`${API_BASE}/customer/alarm/getVod6MonUseDate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ CUST_ID: custId }),
    });

    if (!response.ok) {
      console.error('[Alarm API] HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[Alarm API] getVod6MonUseDate response:', result);
    return result;
  } catch (error) {
    console.error('[Alarm API] getVod6MonUseDate error:', error);
    return null;
  }
};

/**
 * Get Special Customer VOD5K
 * @param custId Customer ID
 */
export const getSpecialCust4VOD5K = async (custId: string): Promise<SpecialCustVod5kInfo | null> => {
  console.log('[Alarm API] getSpecialCust4VOD5K:', custId);

  try {
    const response = await fetch(`${API_BASE}/customer/alarm/getSpecialCust4VOD5K`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ CUST_ID: custId }),
    });

    if (!response.ok) {
      console.error('[Alarm API] HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[Alarm API] getSpecialCust4VOD5K response:', result);
    return result;
  } catch (error) {
    console.error('[Alarm API] getSpecialCust4VOD5K error:', error);
    return null;
  }
};

/**
 * Get Customer Special Bigo
 * @param custId Customer ID
 */
export const getCustSpecialBigo = async (custId: string): Promise<CustSpecialBigoInfo[]> => {
  console.log('[Alarm API] getCustSpecialBigo:', custId);

  try {
    const response = await fetch(`${API_BASE}/customer/alarm/getCustSpecialBigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ CUST_ID: custId }),
    });

    if (!response.ok) {
      console.error('[Alarm API] HTTP error:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[Alarm API] getCustSpecialBigo response:', result);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('[Alarm API] getCustSpecialBigo error:', error);
    return [];
  }
};

/**
 * Get All Alarm Info (Combined API)
 * @param custId Customer ID
 * @param wrkDrctnId Work direction ID (optional)
 */
export const getAllAlarmInfo = async (custId: string, wrkDrctnId?: string): Promise<AllAlarmInfo> => {
  console.log('[Alarm API] getAllAlarmInfo:', { custId, wrkDrctnId });

  try {
    const response = await fetch(`${API_BASE}/customer/alarm/getAllAlarmInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        CUST_ID: custId,
        WRK_DRCTN_ID: wrkDrctnId || '',
      }),
    });

    if (!response.ok) {
      console.error('[Alarm API] HTTP error:', response.status);
      return {};
    }

    const result = await response.json();
    console.log('[Alarm API] getAllAlarmInfo response:', result);
    return result;
  } catch (error) {
    console.error('[Alarm API] getAllAlarmInfo error:', error);
    return {};
  }
};

/**
 * Get Customer Info SMS Receive Status
 * Legacy API: customer/customer/general/customerChgInfo.req
 * @param custId Customer ID
 */
export const getCustomerInfoSmsRecv = async (custId: string): Promise<CustomerInfoSmsRecvInfo | null> => {
  console.log('[Alarm API] getCustomerInfoSmsRecv:', custId);

  try {
    const response = await fetch(`${API_BASE}/customer/alarm/getCustomerInfoSmsRecv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ CUST_ID: custId }),
    });

    if (!response.ok) {
      console.error('[Alarm API] HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[Alarm API] getCustomerInfoSmsRecv response:', result);
    return result;
  } catch (error) {
    console.error('[Alarm API] getCustomerInfoSmsRecv error:', error);
    return null;
  }
};

// ============ 이사작업정보 API (Move Work Info) ============

/**
 * 이사작업정보 (철거이전정보) 조회
 * Legacy: /customer/work/getMoveWorkInfo.req
 *
 * @param params.WRK_CD 작업코드 (07: 이전설치, 08: 이전철거)
 * @param params.WRK_ID 작업ID
 * @param params.RCPT_ID 접수ID (WRK_CD=08일 때 필요)
 * @returns 이사작업정보
 */
export interface MoveWorkInfo {
  MVM_TP?: string;           // 이사유형
  MVM_TP_NM?: string;        // 이사유형명
  WRK_ID?: string;           // 작업ID
  MVM_REM_WK_ID?: string;    // 이사철거작업ID
  CTRT_ID?: string;          // 계약ID
  OLD_CTRT_ID?: string;      // 이전계약ID
  WRK_STAT_CD?: string;      // 작업상태코드
  PROD_NM?: string;          // 상품명
  HOPE_DTTM?: string;        // 작업희망일시
  WRK_STAT_NM?: string;      // 작업상태명
  ADDR_ORD?: string;         // 작업주소
  WRK_CD?: string;           // 작업코드
  WRK_DTL_TCD?: string;      // 작업상세유형코드
  OLD_MST_SO_ID?: string;    // 이전마스터SO ID
  OLD_SO_ID?: string;        // 이전SO ID
  OLD_PROD_CD?: string;      // 이전상품코드
  NEW_PROD_CD?: string;      // 신규상품코드
  SO_ID?: string;            // SO ID
}

export const getMoveWorkInfo = async (params: {
  WRK_CD: string;
  WRK_ID: string;
  RCPT_ID?: string;
}): Promise<MoveWorkInfo | null> => {
  console.log('[이사작업정보 API] getMoveWorkInfo:', params);

  // 더미 모드 체크
  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      MVM_TP: '01',
      MVM_TP_NM: '일반이사',
      WRK_ID: params.WRK_ID,
      PROD_NM: 'DTV 기본상품',
      HOPE_DTTM: '2024-12-29 10:00',
      WRK_STAT_NM: '작업완료',
      ADDR_ORD: '서울시 강남구 테헤란로 123',
      WRK_CD: params.WRK_CD,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/customer/work/getMoveWorkInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[이사작업정보 API] HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[이사작업정보 API] getMoveWorkInfo response:', result);

    // data 객체 또는 배열 첫 번째 항목 반환
    if (result.data) {
      return result.data;
    }
    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    return result;
  } catch (error) {
    console.error('[이사작업정보 API] getMoveWorkInfo error:', error);
    return null;
  }
};

// ============ 장비이전 API (Equipment Move) ============

/**
 * 철거장비 목록 조회 (이사작업 시 이전할 수 있는 장비)
 * Legacy: /customer/equipment/getMVRemoveEqtInfo.req
 */
export interface RemovalEquipmentInfo {
  CHK?: number;             // 선택 플래그
  CTRT_ID?: string;         // 계약ID
  EQT_NO?: string;          // 장비번호 (분실처리시 필요)
  EQT_CL_NM?: string;       // 장비유형명
  LENT_YN_NM?: string;      // 임대여부명
  EQT_USE_STAT_CD?: string; // 장비사용상태코드
  NOTRECEV?: string;        // 철거구분 (철거됨/사용중)
  EQT_LOC_TP_CD?: string;   // 장비위치유형코드
  EQT_STAT_CD?: string;     // 장비상태코드
  WRKR_NM?: string;         // 작업자명
  EQT_SERNO?: string;       // 장비시리얼번호
  MAC_ADDRESS?: string;     // MAC 주소
  ITEM_NM?: string;         // 품목명
  OWNER_TP_CD?: string;     // 소유유형코드
  WRK_CD?: string;          // 작업코드
}

export const getMVRemoveEqtInfo = async (params: {
  CUST_ID: string;
  RCPT_ID: string;
}): Promise<RemovalEquipmentInfo[]> => {
  console.log('[getMVRemoveEqtInfo]:', params);

  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
      {
        CHK: 1,
        CTRT_ID: 'CT123456',
        EQT_CL_NM: 'DTV 셋톱박스',
        LENT_YN_NM: '임대',
        EQT_USE_STAT_CD: '사용중',
        NOTRECEV: '사용중',
        EQT_LOC_TP_CD: '고객',
        EQT_STAT_CD: '정상',
        WRKR_NM: '홍길동',
        EQT_SERNO: 'STB123456789',
        MAC_ADDRESS: 'AA:BB:CC:DD:EE:FF',
        ITEM_NM: 'UHD 셋톱박스',
        WRK_CD: '08',
      },
      {
        CHK: 1,
        CTRT_ID: 'CT123456',
        EQT_CL_NM: '모뎀',
        LENT_YN_NM: '임대',
        EQT_USE_STAT_CD: '사용중',
        NOTRECEV: '사용중',
        EQT_LOC_TP_CD: '고객',
        EQT_STAT_CD: '정상',
        WRKR_NM: '홍길동',
        EQT_SERNO: 'MDM987654321',
        MAC_ADDRESS: '11:22:33:44:55:66',
        ITEM_NM: '기가비트 모뎀',
        WRK_CD: '08',
      },
    ];
  }

  try {
    const response = await fetch(`${API_BASE}/customer/equipment/getMVRemoveEqtInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[장비이전] HTTP error:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[getMVRemoveEqtInfo] response:', result);

    if (result.data) {
      return Array.isArray(result.data) ? result.data : [result.data];
    }
    if (Array.isArray(result)) {
      return result;
    }
    return [];
  } catch (error) {
    console.error('[getMVRemoveEqtInfo] error:', error);
    return [];
  }
};

/**
 * 장비이전 결과 조회
 * Legacy: /customer/work/getEqtSoMoveInfo.req
 */
export interface EqtSoMoveInfo {
  CMPL_DD?: string;          // 완료일자
  RCPT_ID?: string;          // 접수ID
  EQT_NO?: string;           // 장비번호
  ITEM_CD?: string;          // 품목코드
  MST_SO_ID?: string;        // 마스터SO ID
  SO_ID?: string;            // SO ID
  CRR_ID?: string;           // 협력사ID
  WRKR_ID?: string;          // 작업자ID
  WRK_ID?: string;           // 작업ID
  CUST_ID?: string;          // 고객ID
  CTRT_ID?: string;          // 계약ID
  EQT_LOC_TP_CD?: string;    // 장비위치유형코드
  OLD_MST_SO_ID?: string;    // 이전마스터SO ID
  OLD_SO_ID?: string;        // 이전SO ID
  OLD_SO_NM?: string;        // 이전SO명
  OLD_CRR_ID?: string;       // 이전협력사ID
  OLD_WRKR_ID?: string;      // 이전작업자ID
  OLD_WRK_ID?: string;       // 이전작업ID
  OLD_CUST_ID?: string;      // 이전고객ID
  OLD_CTRT_ID?: string;      // 이전계약ID
  OLD_EQT_LOC_TP_CD?: string; // 이전장비위치유형코드
  EQT_SERNO?: string;        // 장비시리얼번호
  EQT_STAT_CD?: string;      // 장비상태코드
  CHG_KND_CD?: string;       // 변경종류코드
  EQT_USE_END_DT?: string;   // 장비사용종료일
  EQT_GUBN?: string;         // 장비구분
  EQT_CL_NM?: string;        // 장비종류명
  ITEM_NM?: string;          // 품목명
  SUCCESS_GUBN?: string;     // 성공구분 (SUCCESS/CHARGE/FAIL)
  REMRK?: string;            // 비고 (결과메시지)
  REG_UID?: string;          // 등록자ID
  REG_DATE?: string;         // 등록일시
}

export const getEqtSoMoveInfo = async (params: {
  WRK_ID: string;
}): Promise<EqtSoMoveInfo[]> => {
  console.log('[getEqtSoMoveInfo]:', params);

  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return [];
  }

  try {
    const response = await fetch(`${API_BASE}/customer/work/getEqtSoMoveInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[장비이전] HTTP error:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[getEqtSoMoveInfo] response:', result);

    if (result.data) {
      return Array.isArray(result.data) ? result.data : [result.data];
    }
    if (Array.isArray(result)) {
      return result;
    }
    return [];
  } catch (error) {
    console.error('[getEqtSoMoveInfo] error:', error);
    return [];
  }
};

/**
 * 장비이전 실행
 * Legacy: /customer/work/excuteSoMoveEqtChg.req
 */
export interface ExcuteSoMoveEqtChgResult {
  MV_CRR_ID?: string;    // 이전협력사ID
  MV_WRKR_ID?: string;   // 이전작업자ID
  MSGCODE?: string;      // 결과코드
  MESSAGE?: string;      // 결과메시지
}

export const excuteSoMoveEqtChg = async (params: {
  MST_SO_ID: string;
  SO_ID: string;
  CUST_ID: string;
  CTRT_ID: string;
  RCPT_ID: string;
  WRK_ID: string;
  WRK_CD?: string;  // 작업코드 (07=이전설치, 05=상품변경 등)
  CRR_ID: string;
  WRKR_ID: string;
  EQT_SERNO: string;
  CHG_UID: string;
}): Promise<ExcuteSoMoveEqtChgResult | null> => {
  console.log('[excuteSoMoveEqtChg]:', params);

  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      MSGCODE: 'SUCCESS',
      MESSAGE: '장비이전이 완료되었습니다.',
    };
  }

  try {
    const response = await fetch(`${API_BASE}/customer/work/excuteSoMoveEqtChg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[장비이전] HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[excuteSoMoveEqtChg] response:', result);

    if (result.data) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.error('[excuteSoMoveEqtChg] error:', error);
    return null;
  }
};

/**
 * 장비분실처리 (철거 장비 분실/파손 처리)
 * Legacy: /customer/work/custEqtInfoDel.req
 * Procedure: pcmct_cust_eqt_info_del
 */
export interface CustEqtInfoDelParams {
  WRK_ID: string;
  CUST_ID: string;
  CTRT_ID: string;
  MST_SO_ID?: string;
  SO_ID?: string;
  BASIC_PROD_CMPS_ID?: string;
  EQT_NO: string;
  ITEM_MID_CD?: string;
  EQT_CL_CD?: string;
  EQT_CL?: string;
  REG_UID?: string;
  IF_DTL_ID?: string;
  OLD_LENT_YN?: string;
  WRK_CD?: string;
  EQT_CHG_GB?: string;
  SVC_CMPS_ID?: string;
  EQT_LOSS_YN?: string;      // 장비분실 (0/1)
  EQT_BRK_YN?: string;       // 리모콘분실 (0/1)
  PART_LOSS_BRK_YN?: string; // 아답터분실 (0/1)
  EQT_CABL_LOSS_YN?: string; // 케이블분실 (0/1)
  EQT_CRDL_LOSS_YN?: string; // 크래들분실 (0/1)
  LANCD_SALE_YN?: string;
  CRR_ID?: string;
  WRKR_ID?: string;
  RCPT_ID?: string;
  REUSE_YN?: string;
}

export interface CustEqtInfoDelResult {
  MSGCODE?: string;
  MESSAGE?: string;
}

export const custEqtInfoDel = async (params: CustEqtInfoDelParams): Promise<CustEqtInfoDelResult | null> => {
  console.log('[custEqtInfoDel]:', params);

  if (checkDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      MSGCODE: 'SUCCESS',
      MESSAGE: '장비분실처리가 완료되었습니다.',
    };
  }

  try {
    const response = await fetch(`${API_BASE}/customer/work/custEqtInfoDel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[custEqtInfoDel] HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[custEqtInfoDel] response:', result);

    if (result.data) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.error('[custEqtInfoDel] error:', error);
    return null;
  }
};

// ============ LGU+ APIs ============

/**
 * LGU+ Contract Info (getUplsCtrtInfo)
 * Legacy: /customer/etc/getUplsCtrtInfo.req
 */
export interface UplsCtrtInfo {
  CTRT_ID?: string;
  CUST_ID?: string;
  ENTR_NO?: string;
  PROD_CD?: string;
  PROD_NM?: string;
  STAT_CD?: string;
  [key: string]: any;
}

export const getUplsCtrtInfo = async (params: {
  CTRT_ID?: string;
  CUST_ID?: string;
  ENTR_NO?: string;
}): Promise<UplsCtrtInfo[] | null> => {
  console.log('[LGU API] getUplsCtrtInfo params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getUplsCtrtInfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[LGU API] getUplsCtrtInfo HTTP error:', response.status);
      return null;
    }

    const result = await response.json();
    console.log('[LGU API] getUplsCtrtInfo response:', result);

    if (Array.isArray(result)) {
      return result;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return result ? [result] : null;
  } catch (error) {
    console.error('[LGU API] getUplsCtrtInfo error:', error);
    return null;
  }
};

/**
 * Terminal Authentication CL-06 (setCertifyCL06)
 * Legacy: /customer/etc/setCertifyCL06.req
 * Sends CL-06 command for terminal certification
 */
export interface CertifyResult {
  ERROR?: string;
  MSG?: string;
  RESULT?: string;
  [key: string]: any;
}

export const setCertifyCL06 = async (params: {
  CTRT_ID: string;
  CUST_ID: string;
  SO_ID: string;
  REG_UID: string;
  WRK_ID?: string;
}): Promise<CertifyResult | null> => {
  console.log('[Certify API] setCertifyCL06 params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/setCertifyCL06`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...params,
        CONT_ID: params.CTRT_ID, // Legacy uses CONT_ID
      }),
    });

    if (!response.ok) {
      console.error('[Certify API] setCertifyCL06 HTTP error:', response.status);
      return { ERROR: `HTTP ${response.status}` };
    }

    const result = await response.json();
    console.log('[Certify API] setCertifyCL06 response:', result);

    if (result.data) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.error('[Certify API] setCertifyCL06 error:', error);
    return { ERROR: String(error) };
  }
};

/**
 * Terminal Status Query CL-08 (getCertifyCL08)
 * Legacy: /customer/etc/getCertifyCL08.req
 * Queries current certification status
 */
export const getCertifyCL08 = async (params: {
  CTRT_ID: string;
  CUST_ID: string;
  SO_ID: string;
  REG_UID: string;
  WRK_ID?: string;
}): Promise<CertifyResult | null> => {
  console.log('[Certify API] getCertifyCL08 params:', params);

  try {
    const response = await fetch(`${API_BASE}/customer/etc/getCertifyCL08`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...params,
        CONT_ID: params.CTRT_ID, // Legacy uses CONT_ID
      }),
    });

    if (!response.ok) {
      console.error('[Certify API] getCertifyCL08 HTTP error:', response.status);
      return { ERROR: `HTTP ${response.status}` };
    }

    const result = await response.json();
    console.log('[Certify API] getCertifyCL08 response:', result);

    if (result.data) {
      return result.data;
    }
    return result;
  } catch (error) {
    console.error('[Certify API] getCertifyCL08 error:', error);
    return { ERROR: String(error) };
  }
};

/**
 * LGHV Product Map (getLghvProdMap)
 * Legacy: /customer/work/getLghvProdMap.req
 * Returns list of LGHV product mappings for STB detection
 */
export interface LghvProdMapItem {
  PROD_CD?: string;
  PROD_NM?: string;
  STB_YN?: string;
  [key: string]: any;
}

export const getLghvProdMap = async (): Promise<LghvProdMapItem[]> => {
  console.log('[Work API] getLghvProdMap called');

  try {
    const response = await fetch(`${API_BASE}/customer/work/getLghvProdMap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      console.error('[Work API] getLghvProdMap HTTP error:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[Work API] getLghvProdMap response:', result);

    if (Array.isArray(result)) {
      return result;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  } catch (error) {
    console.error('[Work API] getLghvProdMap error:', error);
    return [];
  }
};

/**
 * Certify Product Map (getCertifyProdMap)
 * Legacy: /customer/work/getCertifyProdMap.req
 * Returns list of products requiring certification
 */
export interface CertifyProdMapItem {
  PROD_CD?: string;
  PROD_NM?: string;
  CERTIFY_YN?: string;
  [key: string]: any;
}

export const getCertifyProdMap = async (): Promise<CertifyProdMapItem[]> => {
  console.log('[Work API] getCertifyProdMap called');

  try {
    const response = await fetch(`${API_BASE}/customer/work/getCertifyProdMap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      console.error('[Work API] getCertifyProdMap HTTP error:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[Work API] getCertifyProdMap response:', result);

    if (Array.isArray(result)) {
      return result;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  } catch (error) {
    console.error('[Work API] getCertifyProdMap error:', error);
    return [];
  }
};

// ============ Common Code APIs ============

/**
 * Common Code Detail
 * Legacy: /system/common/getCodeDetail.req
 * Returns common code detail by COMMON_GRP and optional COMMON_CD
 */
export interface CommonCodeDetail {
  COMMON_GRP?: string;
  COMMON_CD?: string;
  COMMON_CD_NM?: string;
  REF_CODE?: string;
  REF_CODE2?: string;
  REF_CODE3?: string;
  REF_CODE4?: string;
  REF_CODE5?: string;
  REF_CODE6?: string;
  REF_CODE7?: string;
  REF_CODE8?: string;
  REF_CODE9?: string;
  REF_CODE10?: string;
  REF_CODE11?: string;
  REF_CODE12?: string;
  REF_CODE13?: string;
  SORT_NO?: string;
  USE_YN?: string;
  [key: string]: any;
}

export const getCodeDetail = async (params: {
  COMMON_GRP: string;
  COMMON_CD?: string;
}): Promise<CommonCodeDetail[]> => {
  console.log('[Common Code API] getCodeDetail params:', params);

  try {
    const response = await fetch(`${API_BASE}/system/common/getCodeDetail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error('[Common Code API] getCodeDetail HTTP error:', response.status);
      return [];
    }

    const result = await response.json();
    console.log('[Common Code API] getCodeDetail response:', result);

    if (Array.isArray(result)) {
      return result;
    }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  } catch (error) {
    console.error('[Common Code API] getCodeDetail error:', error);
    return [];
  }
};
// ========== 장비관리 전용 함수들 ==========


/**
 * 출고 대상 장비 목록 조회 (장비할당 상세)
 * @param params OUT_REQ_NO 필수
 * @returns 출고 대상 장비 목록
 */
export const getOutEquipmentTargetList = async (params: {
  OUT_REQ_NO: string;
}): Promise<any> => {
  console.log('📦 [getOutEquipmentTargetList] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getOutEquipmentTargetList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 출고 대상 장비 조회 성공:', result);

    return result;
  } catch (error: any) {
    console.error('❌ 출고 대상 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('출고 대상 장비 조회에 실패했습니다.');
  }
};

/**
 * 반납요청 장비 목록 조회
 * Backend: getEquipmentReturnRequestList (without _All - 모바일 앱과 동일)
 * @param params 검색 조건
 * @returns 반납요청 장비 리스트
 */
export const getEquipmentReturnRequestListAll = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  CRR_ID?: string;
  PROC_STAT?: string;
  OUT_TP?: string;
  OUT_EQT_TP?: string;  // 반납요청 상태
  RETURN_TP?: string;  // '1':반납창고, '2':작업기사, '3':CRR_ID직접 (필수!)
  RETURN_STAT?: string; // '1':전체(outer join), '2':요청건만(inner join) (필수!)
  ITEM_MID_CD?: string; // 장비 중분류 (선택)
  EQT_CL_CD?: string;   // 장비 유형 (선택)
}): Promise<any[]> => {
  // RETURN_TP, RETURN_STAT 기본값 추가 (SQL 필수 파라미터)
  const requestParams = {
    ...params,
    RETURN_TP: params.RETURN_TP || '2',      // 기본: 작업기사
    RETURN_STAT: params.RETURN_STAT || '2',  // 기본: 반납요청건만 (PROC_STAT='1')
  };
  console.log('📋 [fn:getEquipmentReturnRequestListAll → req:getEquipmentReturnRequestList] API 호출:', requestParams);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    // getEquipmentReturnRequestList 사용 (without _All - 모바일 앱과 동일)
    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentReturnRequestList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(requestParams),
    });

    const result = await response.json();
    console.log('✅ 반납요청 장비 조회 성공:', result);

    return Array.isArray(result) ? result : result.output1 || result.data || [];
  } catch (error: any) {
    console.error('❌ 반납요청 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('반납요청 장비 조회에 실패했습니다.');
  }
};


/**
 * 반납요청 취소 (삭제)
 * - 반납요청 목록에서 선택한 장비의 반납요청을 취소
 * - Legacy: /customer/equipment/delEquipmentReturnRequest.req
 *
 * @param params 취소할 장비 정보 + 사용자 정보
 * @returns 처리 결과
 */
export const delEquipmentReturnRequest = async (
  params: {
    // 사용자 정보
    WRKR_ID: string;
    CRR_ID: string;
    SO_ID?: string;
    // 취소할 장비 목록 - MiPlatform 레거시 필수: EQT_NO, REQ_DT, RETURN_TP, EQT_USE_ARR_YN
    equipmentList: Array<{
      EQT_NO: string;
      EQT_SERNO?: string;
      REQ_DT?: string;       // 반납요청일자 (SQL WHERE 조건)
      RETURN_TP?: string;    // 반납유형 (항상 "2")
      EQT_USE_ARR_YN?: string; // 장비사용도착여부 (A 또는 Y)
    }>;
  },
  onProgress?: (current: number, total: number, item: string) => void
): Promise<any> => {
  console.log('[delEquipmentReturnRequest] 반납취소 시작:', params);

  try {
    // 필수 파라미터 검증
    if (!params.WRKR_ID || !params.CRR_ID) {
      throw new NetworkError('사용자 정보가 필요합니다.');
    }
    if (!params.equipmentList || params.equipmentList.length === 0) {
      throw new NetworkError('취소할 장비를 선택해주세요.');
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const total = params.equipmentList.length;

    // CRITICAL FIX: 레거시 서비스가 _inserted_list 배치 형식을 지원하지 않음
    // 각 아이템별로 개별 API 호출 (단일 파라미터 형식만 작동함)
    let successCount = 0;
    let failedItems: string[] = [];
    let currentIdx = 0;

    for (const item of params.equipmentList) {
      currentIdx++;
      onProgress?.(currentIdx, total, item.EQT_SERNO || item.EQT_NO);
      // 단일 아이템 형식으로 전송 (DELETE WHERE 조건: EQT_NO, REQ_DT, RETURN_TP)
      const singleRequestBody = {
        EQT_NO: item.EQT_NO,
        REQ_DT: item.REQ_DT || '',           // 필수! 반납요청일자
        RETURN_TP: item.RETURN_TP || '2',    // 필수! 반납유형
        // 반납취소 시 EQT_USE_ARR_YN 제어 (레거시 로직)
        // - A(검사대기)면 A 유지
        // - 그 외는 Y(사용가능)로 복구
        EQT_USE_ARR_YN: item.EQT_USE_ARR_YN === 'A' ? 'A' : 'Y',
        WRKR_ID: params.WRKR_ID,
        CRR_ID: params.CRR_ID,
        SO_ID: params.SO_ID || '',
      };

      console.log('[delEquipmentReturnRequest] 개별 호출:', item.EQT_SERNO, singleRequestBody);

      try {
        const response = await fetchWithRetry(`${API_BASE}/customer/equipment/delEquipmentReturnRequest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': origin
          },
          credentials: 'include',
          body: JSON.stringify(singleRequestBody),
        });

        const result = await response.json();
        console.log('[delEquipmentReturnRequest] 개별 응답:', item.EQT_SERNO, result);

        if (result && (result.MSGCODE === '0' || result.MSGCODE === 'SUCCESS' || result.success === true)) {
          successCount++;
        } else {
          failedItems.push(item.EQT_SERNO || item.EQT_NO);
        }
      } catch (itemError: any) {
        console.error('[delEquipmentReturnRequest] 개별 실패:', item.EQT_SERNO, itemError);
        failedItems.push(item.EQT_SERNO || item.EQT_NO);
      }
    }

    console.log('[delEquipmentReturnRequest] 완료: 성공', successCount, '/ 실패', failedItems.length);

    if (successCount > 0) {
      return {
        success: true,
        message: failedItems.length > 0
          ? `${successCount}건 취소 성공, ${failedItems.length}건 실패`
          : `${successCount}건의 반납요청이 취소되었습니다.`,
        data: { successCount, failedItems }
      };
    } else {
      throw new NetworkError(`반납취소 실패: ${failedItems.join(', ')}`);
    }

  } catch (error: any) {
    console.error('[delEquipmentReturnRequest] 반납취소 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError(error.message || '반납 취소에 실패했습니다.');
  }
};


/**
 * 작업자(기사) 보유 장비 전체 조회 (All statuses/locations)
 * Backend: getWrkrHaveEqtList_All -> getOwnerEquipmentList (parameterized SQL)
 * @param params 검색 조건
 * @returns 장비 리스트
 */
export const getWrkrHaveEqtListAll = async (params: {
  WRKR_ID: string;
  CRR_ID: string;  // 협력업체 ID (필수!)
  SO_ID?: string;
  ITEM_MID_CD?: string;
  EQT_SERNO?: string;
  EQT_STAT_CD?: string;
  EQT_LOC_TP_CD?: string;
}): Promise<any[]> => {
  console.log('🔧 [fn:getWrkrHaveEqtListAll → req:getWrkrHaveEqtList_All] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getWrkrHaveEqtList_All`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 보유장비 전체 조회 성공:', result);

    if (!result) return [];
    // 백엔드 응답: { data: [...], debugLogs: [...] }
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return Array.isArray(result) ? result : result.output1 || [];
  } catch (error: any) {
    console.error('❌ 보유장비 전체 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('보유장비 전체 조회에 실패했습니다.');
  }
};

/**
 * 반납요청 장비 조회
 * Backend: getOwnEqtLstForMobile_3 -> getEquipmentReturnRequestList
 * @param params 검색 조건
 * @returns 반납요청 장비 리스트
 */
export const getOwnEqtLstForMobile3 = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  RETURN_TP?: string;  // 1=반납위치, 2=기사위치, 3=기사본인
  ITEM_MID_CD?: string;
  EQT_CL_CD?: string;
}): Promise<any[]> => {
  console.log('🔧 [fn:getOwnEqtLstForMobile3 → req:getOwnEqtLstForMobile_3] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getOwnEqtLstForMobile_3`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 반납요청 장비 조회 성공:', result);

    if (!result) return [];
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return Array.isArray(result) ? result : result.output1 || [];
  } catch (error: any) {
    console.error('❌ 반납요청 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('반납요청 장비 조회에 실패했습니다.');
  }
};

/**
 * 검사대기 장비 전체 조회
 * Backend: getEquipmentChkStndByA_All
 * SQL Conditions: EQT_USE_ARR_YN='A', EQT_LOC_TP_CD='3', ITEM_MID_CD='04'
 * @param params 검색 조건
 * @returns 검사대기 장비 리스트
 */
export const getEquipmentChkStndByAAll = async (params: {
  WRKR_ID: string;
  SO_ID?: string;
  EQT_SERNO?: string;
}): Promise<any[]> => {
  console.log('🔧 [fn:getEquipmentChkStndByAAll → req:getEquipmentChkStndByA_All] API 호출:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentChkStndByA_All`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('✅ 검사대기 장비 조회 성공:', result);

    if (!result) return [];
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return Array.isArray(result) ? result : result.output1 || [];
  } catch (error: any) {
    console.error('❌ 검사대기 장비 조회 실패:', error);
    if (error instanceof NetworkError) {
      throw error;
    }
    throw new NetworkError('검사대기 장비 조회에 실패했습니다.');
  }
};

/**
 * 장비 소분류(EQT_CL_CD) 목록 조회
 * Legacy: getEquipmentTypeList.req
 * SQL: SELECT EQT_CL_CD, EQT_CL_NM FROM TCMEP_EQT_CL WHERE ITEM_MID_CD = ?
 * @param params 중분류 코드
 * @returns 소분류 목록 [{COMMON_CD: code, COMMON_CD_NM: name}]
 */
export const getEquipmentTypeList = async (params: {
  ITEM_MID_CD: string;
}): Promise<Array<{COMMON_CD: string; COMMON_CD_NM: string}>> => {
  console.log('[getEquipmentTypeList] API call:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getEquipmentTypeList`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[getEquipmentTypeList] Result:', result);

    if (!result) return [];
    if (result.data && Array.isArray(result.data)) {
      return result.data;
    }
    return Array.isArray(result) ? result : result.output1 || [];
  } catch (error: any) {
    console.error('[getEquipmentTypeList] Failed:', error);
    return [];  // 실패 시 빈 배열 반환 (UI에서 처리)
  }
};

/**
 * 장비 상세 조회 (분실처리 전 필수 호출)
 * Legacy: getWrkrListDetail.req
 * @param params 조회 조건
 * @returns 장비 상세 정보
 */
export const getWrkrListDetail = async (params: {
  SO_ID: string;
  CRR_ID: string;
  WRKR_ID: string;
  EQT_CL_CD?: string;
  EQT_SERNO: string;
}): Promise<any> => {
  console.log('[getWrkrListDetail] API call:', params);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/getWrkrListDetail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    const result = await response.json();
    console.log('[getWrkrListDetail] Result:', result);
    return result;
  } catch (error: any) {
    console.error('[getWrkrListDetail] Failed:', error);
    throw new NetworkError('장비 상세 조회에 실패했습니다.');
  }
};

// ============ 이관 장비 로컬 저장소 관리 ============
export interface TransferredEquipment {
  EQT_NO: string;
  EQT_SERNO: string;
  ITEM_NM: string;
  ITEM_MID_NM?: string;
  ITEM_MAX_NM?: string;
  EQT_CL_NM?: string;
  SO_ID: string;
  SO_NM?: string;
  FROM_WRKR_ID: string;
  FROM_WRKR_NM?: string;
  TO_WRKR_ID: string;
  transferredAt: number;
  isTransferred: boolean;
}

const TRANSFERRED_EQUIPMENT_KEY = 'dlive_transferred_equipment';
const TRANSFER_EXPIRY_HOURS = 48;

export const saveTransferredEquipment = (equipment: Omit<TransferredEquipment, 'transferredAt' | 'isTransferred'>): void => {
  try {
    const existing = getTransferredEquipmentList();
    const filtered = existing.filter(e => e.EQT_SERNO !== equipment.EQT_SERNO);
    const newEquipment: TransferredEquipment = {
      ...equipment,
      transferredAt: Date.now(),
      isTransferred: true
    };
    filtered.push(newEquipment);
    localStorage.setItem(TRANSFERRED_EQUIPMENT_KEY, JSON.stringify(filtered));
    console.log('[TransferredEquipment] Saved:', equipment.EQT_SERNO);
  } catch (e) {
    console.error('[TransferredEquipment] Save error:', e);
  }
};

export const getTransferredEquipmentList = (): TransferredEquipment[] => {
  try {
    const stored = localStorage.getItem(TRANSFERRED_EQUIPMENT_KEY);
    if (!stored) return [];
    const list: TransferredEquipment[] = JSON.parse(stored);
    const now = Date.now();
    const expiryMs = TRANSFER_EXPIRY_HOURS * 60 * 60 * 1000;
    const valid = list.filter(e => (now - e.transferredAt) < expiryMs);
    if (valid.length !== list.length) {
      localStorage.setItem(TRANSFERRED_EQUIPMENT_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch (e) {
    console.error('[TransferredEquipment] Get error:', e);
    return [];
  }
};

export const getTransferredEquipmentCount = (userId: string): number => {
  const list = getTransferredEquipmentList();
  return list.filter(e => e.TO_WRKR_ID === userId).length;
};

export const getTransferredOutCount = (userId: string): number => {
  const list = getTransferredEquipmentList();
  return list.filter(e => e.FROM_WRKR_ID === userId).length;
};

export const getTransferredEquipmentForUser = (userId: string): TransferredEquipment[] => {
  const list = getTransferredEquipmentList();
  return list.filter(e => e.TO_WRKR_ID === userId);
};

export const removeTransferredEquipment = (eqtSerno: string): void => {
  try {
    const list = getTransferredEquipmentList();
    const filtered = list.filter(e => e.EQT_SERNO !== eqtSerno);
    localStorage.setItem(TRANSFERRED_EQUIPMENT_KEY, JSON.stringify(filtered));
    console.log('[TransferredEquipment] Removed:', eqtSerno);
  } catch (e) {
    console.error('[TransferredEquipment] Remove error:', e);
  }
};

export const clearTransferredEquipment = (): void => {
  try {
    localStorage.removeItem(TRANSFERRED_EQUIPMENT_KEY);
    console.log('[TransferredEquipment] Cleared all');
  } catch (e) {
    console.error('[TransferredEquipment] Clear error:', e);
  }
};

export const mergeWithTransferredEquipment = (
  apiResults: any[],
  userId: string
): { merged: any[]; transferredCount: number } => {
  const transferred = getTransferredEquipmentForUser(userId);
  if (transferred.length === 0) {
    return { merged: apiResults, transferredCount: 0 };
  }
  const apiSernos = new Set(apiResults.map(e => e.EQT_SERNO));
  const toAdd: any[] = [];
  transferred.forEach(te => {
    if (!apiSernos.has(te.EQT_SERNO)) {
      toAdd.push({
        EQT_NO: te.EQT_NO,
        EQT_SERNO: te.EQT_SERNO,
        ITEM_NM: te.ITEM_NM,
        ITEM_MID_NM: te.ITEM_MID_NM || '',
        ITEM_MAX_NM: te.ITEM_MAX_NM || '',
        EQT_CL_NM: te.EQT_CL_NM || '',
        SO_ID: te.SO_ID,
        SO_NM: te.SO_NM || '',
        WRKR_ID: te.TO_WRKR_ID,
        FROM_WRKR_ID: te.FROM_WRKR_ID,
        FROM_WRKR_NM: te.FROM_WRKR_NM || '',
        isTransferred: true,
        transferredAt: te.transferredAt
      });
    } else {
      removeTransferredEquipment(te.EQT_SERNO);
    }
  });
  console.log('[TransferredEquipment] Merging:', toAdd.length, 'items not in API');
  return {
    merged: [...apiResults, ...toAdd],
    transferredCount: toAdd.length
  };
};

/**
 * 기사 이름 검색
 * @param params WRKR_NM (2글자 이상 필수), CRR_ID (optional)
 * @returns 이름에 매칭되는 기사 목록 (부분 일치)
 */
export const searchWorkersByName = async (params: {
  WRKR_NM: string;
  CRR_ID?: string;
}): Promise<any[]> => {
  console.log('[searchWorkersByName] 기사 이름 검색:', params);

  try {
    const response = await fetchWithRetry(`${API_BASE}/customer/equipment/searchWorkersByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      },
      body: JSON.stringify(params),
      credentials: 'include'
    });

    const result = await response.json();
    console.log('[searchWorkersByName] 결과:', result.length, '명');
    return Array.isArray(result) ? result : [];
  } catch (error: any) {
    console.error('[searchWorkersByName] 실패:', error);
    throw error;
  }
};

// ==================== 장비관리 API Aliases ====================
export const getWrkrHaveEqtList = getWorkerEquipmentList;
export const apiRequest = async (endpoint: string, method: 'GET' | 'POST' = 'POST', body?: any): Promise<any> => {
  console.log(`📡 [API 직접호출] ${method} ${endpoint}`, body);

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin
      },
      credentials: 'include',
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    // 백엔드 디버그 로그 콘솔 출력 (성공/실패 모두)
    printBackendDebugLogs(endpoint, result, response.ok);

    console.log(`📡 [API 직접호출] ${endpoint} 응답:`, result);
    return result;
  } catch (error: any) {
    console.error(`❌ [API 직접호출] ${endpoint} 실패:`, error);
    throw error;
  }
};

/**
 * 백엔드 디버그 로그를 콘솔에 출력하는 헬퍼 함수
 * 서버 로그 파일에는 쓰지 않고 프론트엔드 콘솔에서만 확인 가능
 */
const printBackendDebugLogs = (endpoint: string, result: any, isSuccess: boolean): void => {
  if (!result?.debugLogs || !Array.isArray(result.debugLogs) || result.debugLogs.length === 0) {
    return;
  }

  const status = isSuccess ? '✅ 성공' : '❌ 실패';
  console.group(`🔧 [백엔드 디버그 로그 - ${status}] ${endpoint}`);

  result.debugLogs.forEach((log: string) => {
    if (log.includes('SUCCESS') || log.includes('API_CALL_SUCCESS')) {
      console.log('%c' + log, 'color: #22c55e; font-weight: bold;');
    } else if (log.includes('ERROR') || log.includes('FAILED') || log.includes('Exception')) {
      console.log('%c' + log, 'color: #ef4444; font-weight: bold;');
    } else if (log.includes('FALLBACK') || log.includes('SKIP') || log.includes('Warning')) {
      console.log('%c' + log, 'color: #f97316;');
    } else if (log.includes('API_CALL_START') || log.includes('========')) {
      console.log('%c' + log, 'color: #3b82f6; font-weight: bold;');
    } else if (log.includes('[METHOD]') || log.includes('[URI]') || log.includes('[TIMESTAMP]')) {
      console.log('%c' + log, 'color: #8b5cf6;');
    } else if (log.includes('PARAMETER') || log.includes('Required:') || log.includes('Optional:')) {
      console.log('%c' + log, 'color: #6366f1;');
    } else if (log.includes('invokeFlexible') || log.includes('findMethod')) {
      console.log('%c' + log, 'color: #0891b2;');
    } else {
      console.log(log);
    }
  });

  console.groupEnd();
};

