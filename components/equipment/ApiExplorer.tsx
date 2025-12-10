import React, { useState, useEffect } from 'react';

interface ApiCall {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  params: any;
  response: any;
  error: string | null;
  duration: number;
  status: 'success' | 'error' | 'pending';
}

interface ApiEndpoint {
  id: string;
  category: string;
  name: string;
  path: string;
  description: string;
  params: {
    name: string;
    type: string;
    required: boolean;
    default?: any;
  }[];
}

const API_ENDPOINTS: ApiEndpoint[] = [
  // =========== EquipmentController (백엔드 확인됨) ===========
  {
    id: 'getEquipmentInfo',
    category: '장비관리-작업용',
    name: '[확인됨] 작업용 장비 정보 조회',
    path: '/work/equipment-info',
    description: 'GET - 작업용 장비 정보 조회 (workmanAssignManagement.getCustProdInfo)',
    params: [
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'PROD_CD', type: 'string', required: false },
      { name: 'WRKR_ID', type: 'string', required: false },
      { name: 'CUST_ID', type: 'string', required: false },
      { name: 'BLD_ID', type: 'string', required: false },
      { name: 'QUERY_TYPE', type: 'string', required: false },
    ],
  },
  {
    id: 'getCustProdInfo',
    category: '장비관리-작업용',
    name: '[확인됨] 고객/기사 장비 정보',
    path: '/customer/work/getCustProdInfo',
    description: 'POST - 고객/기사 장비 정보 조회 (workmanAssignManagement.getCustProdInfo)',
    params: [
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'SO_ID', type: 'string', required: false },
      { name: 'WORK_ID', type: 'string', required: false },
      { name: 'PROD_CD', type: 'string', required: false },
      { name: 'CUST_ID', type: 'string', required: false },
      { name: 'CRR_TSK_CL', type: 'string', required: false },
      { name: 'WRK_DTL_TCD', type: 'string', required: false },
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'requestType', type: 'string', required: false },
    ],
  },
  {
    id: 'equipmentWorkerTransfer',
    category: '장비관리-기사이관',
    name: '[확인됨] 장비 기사 이관',
    path: '/equipment/worker-transfer',
    description: 'POST - 장비를 다른 기사에게 이관 (equipmentManager.changeEqtWrkr_3)',
    params: [
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'SO_ID', type: 'string', required: false },
      { name: 'EQT_NO', type: 'string', required: false },
      { name: 'CRR_ID', type: 'string', required: false },
      { name: 'REG_UID', type: 'string', required: false },
    ],
  },
  {
    id: 'eqtCmpsInfoChg',
    category: '장비관리-작업용',
    name: '[확인됨] 장비 구성 변경',
    path: '/customer/work/eqtCmpsInfoChg',
    description: 'POST - 장비 구성 정보 변경 (workmanAssignManagement.eqtCmpsInfoChg)',
    params: [
      { name: 'WRK_ID', type: 'string', required: false },
      { name: 'RCPT_ID', type: 'string', required: false },
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'CUST_ID', type: 'string', required: false },
      { name: 'CRR_ID', type: 'string', required: false },
      { name: 'WRKR_ID', type: 'string', required: false },
      { name: 'REG_UID', type: 'string', required: false },
      { name: 'equipments', type: 'array', required: true, default: '[]' },
    ],
  },
  {
    id: 'signalCheck',
    category: '장비관리-신호체크',
    name: '[확인됨] 신호 체크 (Stub)',
    path: '/customer/work/signalCheck',
    description: 'POST - 신호 체크 (현재 stub 구현)',
    params: [
      { name: 'CUST_ID', type: 'string', required: false },
      { name: 'WRK_ID', type: 'string', required: false },
      { name: 'CHECK_TYPE', type: 'string', required: false },
      { name: 'PROD_CD', type: 'string', required: false },
    ],
  },
  {
    id: 'ensHistory',
    category: '장비관리-신호체크',
    name: '[확인됨] ENS 전송 이력',
    path: '/signal/ens-history',
    description: 'GET - ENS 전송 이력 조회 (sigtransManagement.getENSSendHist)',
    params: [
      { name: 'CUST_ID', type: 'string', required: false },
      { name: 'DEST_INFO', type: 'string', required: false },
      { name: 'REG_DATE1', type: 'string', required: false },
      { name: 'REG_DATE2', type: 'string', required: false },
      { name: 'RSLT_DATE1', type: 'string', required: false },
      { name: 'RSLT_DATE2', type: 'string', required: false },
      { name: 'SO_ID', type: 'string', required: false },
    ],
  },
  {
    id: 'checkStbServerConnection',
    category: '장비관리-신호체크',
    name: '[확인됨] STB 서버 연결 체크',
    path: '/customer/work/checkStbServerConnection',
    description: 'POST - STB 서버 연결 상태 확인 (workmanAssignManagement.checkStbServerConnection)',
    params: [
      { name: 'REG_UID', type: 'string', required: false },
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'WRK_ID', type: 'string', required: false },
      { name: 'MSG_ID', type: 'string', required: false },
      { name: 'STB_EQT_NO', type: 'string', required: false },
      { name: 'MODEM_EQT_NO', type: 'string', required: false },
    ],
  },
  {
    id: 'getEquipmentNmListOfProd',
    category: '장비관리-계약장비',
    name: '[확인됨] 상품별 장비명 리스트',
    path: '/customer/receipt/contract/getEquipmentNmListOfProd',
    description: 'POST - 상품별 장비명 리스트 조회 (contract.getEquipmentNmListOfProd)',
    params: [
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'PROD_CD', type: 'string', required: false },
    ],
  },
  {
    id: 'getContractEqtList',
    category: '장비관리-계약장비',
    name: '[확인됨] 계약 장비 리스트',
    path: '/customer/receipt/contract/getContractEqtList',
    description: 'POST - 계약 장비 리스트 조회 (contract.getContractEqtList)',
    params: [
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'PROD_CD', type: 'string', required: false },
    ],
  },
  {
    id: 'getCustomerCtrtInfo',
    category: '장비관리-계약장비',
    name: '[확인됨] 고객 계약 정보',
    path: '/customer/negociation/getCustomerCtrtInfo',
    description: 'POST - 고객 계약 정보 조회 (commonCodeManagement.getCustomerCtrtInfo)',
    params: [
      { name: 'CTRT_ID', type: 'string', required: true },
    ],
  },

  // =========== WorkController (백엔드 확인됨) ===========
  {
    id: 'getWorkReceiptList',
    category: '작업관리-접수조회',
    name: '[확인됨] 작업 접수 목록',
    path: '/work/receipts',
    description: 'GET - 작업 접수 목록 조회 (workmanAssignManagement.getWorkReceiptList)',
    params: [
      { name: 'WRKR_ID', type: 'string', required: false },
      { name: 'WORK_DT', type: 'string', required: false },
      { name: 'SO_ID', type: 'string', required: false },
      { name: 'CUST_ID', type: 'string', required: false },
    ],
  },
  {
    id: 'getWorkdrctnList',
    category: '작업관리-작업지시',
    name: '[확인됨] 작업 지시 목록',
    path: '/work/directions',
    description: 'GET - 작업 지시 목록 조회 (workmanAssignManagement.getWorkdrctnList)',
    params: [
      { name: 'WRKR_ID', type: 'string', required: false },
      { name: 'WORK_DT', type: 'string', required: false },
      { name: 'SO_ID', type: 'string', required: false },
    ],
  },
  {
    id: 'modWorkCancel',
    category: '작업관리-작업취소',
    name: '[확인됨] 작업 취소',
    path: '/work/cancel',
    description: 'POST - 작업 취소 처리 (workmanAssignManagement.modWorkCancel)',
    params: [
      { name: 'WRK_ID', type: 'string', required: true },
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'CANCEL_REASON', type: 'string', required: false },
      { name: 'REG_UID', type: 'string', required: false },
    ],
  },
  {
    id: 'modWorkComplete',
    category: '작업관리-작업완료',
    name: '[확인됨] 작업 완료',
    path: '/work/complete',
    description: 'POST - 작업 완료 처리 (workmanAssignManagement.modWorkComplete)',
    params: [
      { name: 'WRK_ID', type: 'string', required: true },
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'COMPLETE_MEMO', type: 'string', required: false },
      { name: 'REG_UID', type: 'string', required: false },
    ],
  },
  {
    id: 'modWorkDivision',
    category: '작업관리-작업분배',
    name: '[확인됨] 작업자 조정',
    path: '/work/worker-adjustment',
    description: 'POST - 작업자 조정/분배 (workmanAssignManagement.modWorkDivision)',
    params: [
      { name: 'WRK_ID', type: 'string', required: true },
      { name: 'FROM_WRKR_ID', type: 'string', required: true },
      { name: 'TO_WRKR_ID', type: 'string', required: true },
      { name: 'REG_UID', type: 'string', required: false },
    ],
  },
  {
    id: 'workCompleteWithParams',
    category: '작업관리-작업완료',
    name: '[확인됨] 작업 완료 (상세)',
    path: '/customer/work/workComplete',
    description: 'POST - 작업 완료 처리 with 7 parameters (workmanAssignManagement.modWorkComplete)',
    params: [
      { name: 'WRK_ID', type: 'string', required: true },
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'CUST_ID', type: 'string', required: false },
      { name: 'COMPLETE_DT', type: 'string', required: false },
      { name: 'COMPLETE_MEMO', type: 'string', required: false },
      { name: 'REG_UID', type: 'string', required: false },
    ],
  },
  {
    id: 'getRsltSinho4Wrk',
    category: '작업관리-신호조회',
    name: '[확인됨] 작업용 신호 결과',
    path: '/work/result-signals',
    description: 'POST - 작업용 신호 결과 조회 (equipmentManager.getRsltSinho4Wrk_2)',
    params: [
      { name: 'WRK_ID', type: 'string', required: true },
      { name: 'CTRT_ID', type: 'string', required: false },
    ],
  },
  {
    id: 'saveInstallInfo',
    category: '작업관리-설치정보',
    name: '[확인됨] 설치 정보 저장',
    path: '/customer/work/saveInstallInfo',
    description: 'POST - 설치 정보 저장 (workmanAssignManagement.modNetInfo)',
    params: [
      { name: 'WRK_ID', type: 'string', required: true },
      { name: 'CTRT_ID', type: 'string', required: false },
      { name: 'CUST_ID', type: 'string', required: false },
      { name: 'INSTALL_ADDR', type: 'string', required: false },
      { name: 'INSTALL_MEMO', type: 'string', required: false },
      { name: 'REG_UID', type: 'string', required: false },
    ],
  },

  // =========== apiService.ts 함수 (백엔드 미확인) ===========

  // 장비 상태 조회
  {
    id: 'getEquipmentHistoryInfo',
    category: '장비관리-상태조회',
    name: '[미확인] 장비 이력 조회 (S/N, MAC)',
    path: '/statistics/equipment/getEquipmentHistoryInfo',
    description: 'POST - S/N 또는 MAC으로 장비 상세 정보 조회 (백엔드 확인 필요)',
    params: [
      { name: 'EQT_SERNO', type: 'string', required: false },
      { name: 'MAC_ADDRESS', type: 'string', required: false },
    ],
  },

  // 장비 할당/출고
  {
    id: 'getEquipmentOutList',
    category: '장비관리-출고관리',
    name: '[미확인] 장비 출고 목록',
    path: '/customer/equipment/getEquipmentOutList',
    description: 'POST - 출고일자/지점별 장비 출고 현황 (백엔드 확인 필요)',
    params: [
      { name: 'FROM_OUT_REQ_DT', type: 'string', required: true, default: '20250101' },
      { name: 'TO_OUT_REQ_DT', type: 'string', required: true, default: '20250131' },
      { name: 'SO_ID', type: 'string', required: false },
      { name: 'OUT_REQ_NO', type: 'string', required: false },
      { name: 'PROC_STAT', type: 'string', required: false },
    ],
  },
  {
    id: 'checkEquipmentProc',
    category: '장비관리-출고관리',
    name: '[미확인] 출고 장비 처리 가능 여부',
    path: '/customer/equipment/getEquipmentProcYnCheck',
    description: 'POST - 출고번호로 장비 처리 가능 여부 확인 (백엔드 확인 필요)',
    params: [
      { name: 'OUT_REQ_NO', type: 'string', required: true },
    ],
  },
  {
    id: 'addEquipmentQuota',
    category: '장비관리-출고관리',
    name: '[미확인] 장비 쿼터 추가 (입고)',
    path: '/customer/equipment/addCorporationEquipmentQuota',
    description: 'POST - 출고 장비 입고 처리 (백엔드 확인 필요)',
    params: [
      { name: 'OUT_REQ_NO', type: 'string', required: true },
      { name: 'equipmentList', type: 'array', required: true, default: '[]' },
    ],
  },

  // 장비 반납
  {
    id: 'getEquipmentReturnRequestList',
    category: '장비관리-반납관리',
    name: '[미확인] 기사 보유 장비 조회 (반납용)',
    path: '/customer/equipment/getEquipmentReturnRequestList',
    description: 'POST - 기사가 보유한 장비 목록 조회 (백엔드 확인 필요)',
    params: [
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'SO_ID', type: 'string', required: false },
    ],
  },
  {
    id: 'checkEquipmentReturn',
    category: '장비관리-반납관리',
    name: '[미확인] 장비 반납 확인',
    path: '/customer/equipment/getEquipmentReturnRequestCheck',
    description: 'POST - 장비 반납 요청 확인 (백엔드 확인 필요)',
    params: [
      { name: 'EQT_NO', type: 'string', required: true },
      { name: 'WRKR_ID', type: 'string', required: true },
    ],
  },
  {
    id: 'addEquipmentReturnRequest',
    category: '장비관리-반납관리',
    name: '[미확인] 장비 반납 요청',
    path: '/customer/equipment/addEquipmentReturnRequest',
    description: 'POST - 장비 반납 요청 등록 (백엔드 확인 필요)',
    params: [
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'equipmentList', type: 'array', required: true, default: '[]' },
    ],
  },

  // 작업자 장비 관리
  {
    id: 'getWorkerEquipmentList',
    category: '장비관리-기사재고',
    name: '[미확인] 작업자 보유 장비 조회',
    path: '/customer/equipment/getWrkrHaveEqtList',
    description: 'POST - 작업자가 보유한 장비 목록 조회 (백엔드 확인 필요)',
    params: [
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'SO_ID', type: 'string', required: false },
      { name: 'ITEM_MID_CD', type: 'string', required: false },
      { name: 'EQT_SERNO', type: 'string', required: false },
    ],
  },
  {
    id: 'changeEquipmentWorker',
    category: '장비관리-기사이관',
    name: '[미확인] 장비 작업자 변경 (인수)',
    path: '/customer/equipment/changeEqtWrkr_3',
    description: 'POST - 장비를 다른 작업자에게 인수 (백엔드 확인 필요)',
    params: [
      { name: 'EQT_NO', type: 'string', required: true },
      { name: 'FROM_WRKR_ID', type: 'string', required: true },
      { name: 'TO_WRKR_ID', type: 'string', required: true },
    ],
  },

  // 장비 분실/상태변경
  {
    id: 'processEquipmentLoss',
    category: '장비관리-분실처리',
    name: '[미확인] 장비 분실 처리',
    path: '/customer/equipment/cmplEqtCustLossIndem',
    description: 'POST - 장비 분실 처리 (백엔드 확인 필요)',
    params: [
      { name: 'EQT_NO', type: 'string', required: true },
      { name: 'WRKR_ID', type: 'string', required: true },
      { name: 'LOSS_REASON', type: 'string', required: false },
    ],
  },
  {
    id: 'setEquipmentCheckStandby',
    category: '장비관리-상태변경',
    name: '[미확인] 장비 상태 변경 (검사대기→사용)',
    path: '/customer/equipment/setEquipmentChkStndByY',
    description: 'POST - 장비 상태를 검사대기에서 사용가능으로 변경 (백엔드 확인 필요)',
    params: [
      { name: 'EQT_NO', type: 'string', required: true },
    ],
  },

  // 미회수 장비
  {
    id: 'getUnreturnedEquipmentList',
    category: '장비관리-미회수',
    name: '[미확인] 미회수 장비 조회',
    path: '/customer/work/getEquipLossInfo',
    description: 'POST - 미회수 장비 목록 조회 (백엔드 확인 필요)',
    params: [
      { name: 'FROM_DT', type: 'string', required: false },
      { name: 'TO_DT', type: 'string', required: false },
      { name: 'CUST_ID', type: 'string', required: false },
      { name: 'CUST_NM', type: 'string', required: false },
      { name: 'EQT_SERNO', type: 'string', required: false },
    ],
  },
  {
    id: 'processEquipmentRecovery',
    category: '장비관리-미회수',
    name: '[미확인] 미회수 장비 회수 처리',
    path: '/customer/work/modEquipLoss',
    description: 'POST - 미회수 장비 회수 완료 처리 (백엔드 확인 필요)',
    params: [
      { name: 'EQT_NO', type: 'string', required: true },
      { name: 'CTRT_ID', type: 'string', required: true },
      { name: 'WRK_ID', type: 'string', required: false },
    ],
  },

  // 기사 검색 & 문자 발송
  {
    id: 'findUserList',
    category: '공통-사용자',
    name: '[미확인] 작업자(기사) 검색',
    path: '/system/cm/getFindUsrList3',
    description: 'POST - 이름/ID로 작업자 검색 (백엔드 확인 필요)',
    params: [
      { name: 'USR_NM', type: 'string', required: false },
      { name: 'USR_ID', type: 'string', required: false },
      { name: 'SO_ID', type: 'string', required: false },
    ],
  },
  {
    id: 'sendSmsNotification',
    category: '공통-알림',
    name: '[미확인] 문자 발송 (ENS)',
    path: '/customer/sigtrans/saveENSSendHist',
    description: 'POST - 문자 발송 (장비 인수 알림 등) (백엔드 확인 필요)',
    params: [
      { name: 'RECV_PHONE_NO', type: 'string', required: true },
      { name: 'MSG_CONTENT', type: 'string', required: true },
      { name: 'SEND_UID', type: 'string', required: true },
    ],
  },

  // 장비 이관 (배열 방식)
  {
    id: 'changeEqtWrkrBatch',
    category: '장비관리-기사이관',
    name: '[미확인] 장비 작업자 이관 (다건)',
    path: '/customer/equipment/changeEqtWrkr_3',
    description: 'POST - 여러 장비를 다른 작업자에게 일괄 이관 (백엔드 확인 필요)',
    params: [
      { name: 'FROM_WRKR_ID', type: 'string', required: true },
      { name: 'TO_WRKR_ID', type: 'string', required: true },
      { name: 'equipmentList', type: 'array', required: true, default: '[]' },
    ],
  },

  // =========== 공통 API ===========
  {
    id: 'getCodeDetail',
    category: '공통-코드',
    name: '[미확인] 공통코드 조회',
    path: '/system/cm/getCodeDetail',
    description: 'POST - 코드 그룹별 코드 목록 조회 (백엔드 확인 필요)',
    params: [
      { name: 'GRP_CD', type: 'string', required: true, default: 'EQT_STS' },
    ],
  },
  {
    id: 'getTodayWorkList',
    category: '작업관리-조회',
    name: '[미확인] 오늘 작업 목록',
    path: '/customer/work/getTodayWorkList',
    description: 'POST - 당일 배정된 작업 목록 조회 (백엔드 확인 필요)',
    params: [
      { name: 'WORK_DT', type: 'string', required: false },
      { name: 'WRKR_ID', type: 'string', required: false },
    ],
  },
];

const ApiExplorer: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<ApiCall | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');

  // localStorage에서 이전 API 호출 기록 복원
  useEffect(() => {
    const savedCalls = localStorage.getItem('apiExplorer_calls');
    if (savedCalls) {
      try {
        setApiCalls(JSON.parse(savedCalls));
      } catch (e) {
        console.error('Failed to restore API calls', e);
      }
    }
  }, []);

  // API 호출 기록 저장
  useEffect(() => {
    localStorage.setItem('apiExplorer_calls', JSON.stringify(apiCalls));
  }, [apiCalls]);

  // 엔드포인트 선택 시 기본값 설정 + 사용자 정보 자동 채우기
  useEffect(() => {
    if (selectedEndpoint) {
      const defaults: Record<string, any> = {};

      // localStorage에서 사용자 정보 가져오기
      const userInfoStr = localStorage.getItem('userInfo');
      let userInfo: any = null;
      if (userInfoStr) {
        try {
          userInfo = JSON.parse(userInfoStr);
        } catch (e) {
          console.error('Failed to parse userInfo', e);
        }
      }

      selectedEndpoint.params.forEach((param) => {
        // 1. param에 default가 있으면 사용
        if (param.default !== undefined) {
          defaults[param.name] = param.default;
        }

        // 2. 사용자 정보가 있으면 자동 매핑
        if (userInfo) {
          switch (param.name) {
            case 'WRKR_ID':
              defaults[param.name] = userInfo.workerId || 'A20130708';
              break;
            case 'SO_ID':
            case 'MST_SO_ID':
              defaults[param.name] = userInfo.soId || '';
              break;
            case 'CRR_ID':
              defaults[param.name] = userInfo.crrId || '';
              break;
            case 'REG_UID':
            case 'SEND_UID':
              defaults[param.name] = userInfo.userId || userInfo.workerId || '';
              break;
            case 'USR_ID':
              defaults[param.name] = userInfo.userId || '';
              break;
          }
        }
      });

      setParamValues(defaults);
    }
  }, [selectedEndpoint]);

  const handleParamChange = (paramName: string, value: any) => {
    setParamValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleCallApi = async () => {
    if (!selectedEndpoint) return;

    const callId = `${Date.now()}-${Math.random()}`;
    const startTime = performance.now();

    const newCall: ApiCall = {
      id: callId,
      timestamp: new Date().toISOString(),
      method: 'POST',
      url: selectedEndpoint.path,
      params: { ...paramValues },
      response: null,
      error: null,
      duration: 0,
      status: 'pending',
    };

    setApiCalls((prev) => [newCall, ...prev]);
    setSelectedCall(newCall);
    setIsLoading(true);

    try {
      const response = await fetch(`/api${selectedEndpoint.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paramValues),
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setApiCalls((prev) =>
        prev.map((call) =>
          call.id === callId
            ? {
                ...call,
                response: data,
                duration: Math.round(duration),
                status: 'success',
              }
            : call
        )
      );

      setSelectedCall({
        ...newCall,
        response: data,
        duration: Math.round(duration),
        status: 'success',
      });
    } catch (error: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      setApiCalls((prev) =>
        prev.map((call) =>
          call.id === callId
            ? {
                ...call,
                error: error.message,
                duration: Math.round(duration),
                status: 'error',
              }
            : call
        )
      );

      setSelectedCall({
        ...newCall,
        error: error.message,
        duration: Math.round(duration),
        status: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('모든 API 호출 기록을 삭제하시겠습니까?')) {
      setApiCalls([]);
      setSelectedCall(null);
      localStorage.removeItem('apiExplorer_calls');
    }
  };

  // 샘플 데이터 자동 채우기
  const handleFillSampleData = () => {
    if (!selectedEndpoint) return;

    const userInfoStr = localStorage.getItem('userInfo');
    let userInfo: any = null;
    if (userInfoStr) {
      try {
        userInfo = JSON.parse(userInfoStr);
      } catch (e) {
        console.error('Failed to parse userInfo', e);
      }
    }

    const sampleData: Record<string, any> = { ...paramValues };

    // 각 파라미터별 샘플 데이터 설정
    selectedEndpoint.params.forEach((param) => {
      // 이미 값이 있으면 유지
      if (sampleData[param.name] && sampleData[param.name] !== '') {
        return;
      }

      // 파라미터명 기반 샘플 데이터
      switch (param.name) {
        // 작업 관련
        case 'WORK_ID':
        case 'WRK_ID':
          sampleData[param.name] = 'W202501020001';
          break;
        case 'RCPT_ID':
          sampleData[param.name] = 'R202501020001';
          break;
        case 'CTRT_ID':
          sampleData[param.name] = 'C202501020001';
          break;
        case 'WRK_DRCTN_ID':
          sampleData[param.name] = 'D202501020001';
          break;

        // 장비 관련
        case 'EQT_NO':
          sampleData[param.name] = 'EQ20250102001';
          break;
        case 'EQT_SERNO':
          sampleData[param.name] = 'SN20250102001';
          break;
        case 'ITEM_MID_CD':
          sampleData[param.name] = '05'; // 셋톱박스
          break;
        case 'EQT_CL_CD':
        case 'EQT_CL':
          sampleData[param.name] = '090401'; // 모델 코드 예시
          break;
        case 'MAC_ADDRESS':
          sampleData[param.name] = '00:11:22:33:44:55';
          break;

        // 고객 관련
        case 'CUST_ID':
          sampleData[param.name] = 'CUST20250102001';
          break;
        case 'CUST_NM':
          sampleData[param.name] = '홍길동';
          break;
        case 'PHONE_NO':
        case 'RECV_PHONE_NO':
          sampleData[param.name] = '010-1234-5678';
          break;

        // 날짜 관련
        case 'WORK_DT':
        case 'FROM_DT':
        case 'TO_DT':
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          sampleData[param.name] = today; // YYYYMMDD
          break;

        // 상태 코드
        case 'WRK_STAT_CD':
          sampleData[param.name] = '2'; // 진행중
          break;
        case 'EQT_USE_STAT_CD':
          sampleData[param.name] = '1'; // 사용중
          break;

        // 제품/서비스
        case 'PROD_CD':
          sampleData[param.name] = 'PROD001';
          break;
        case 'SVC_CD':
          sampleData[param.name] = 'SVC001';
          break;

        // 기타
        case 'BLD_ID':
          sampleData[param.name] = 'BLD20250102001';
          break;
        case 'ADDR_ORD':
          sampleData[param.name] = '1';
          break;
        case 'GRP_CD':
          sampleData[param.name] = 'EQT_STS'; // 장비상태 코드 그룹
          break;
        case 'USR_NM':
          sampleData[param.name] = '홍길동';
          break;
        case 'MSG_CONTENT':
          sampleData[param.name] = '테스트 메시지입니다.';
          break;
        case 'LOSS_REASON':
          sampleData[param.name] = '분실';
          break;
      }
    });

    setParamValues(sampleData);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(apiCalls, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `api-calls-${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Method', 'URL', 'Status', 'Duration (ms)', 'Error'];
    const rows = apiCalls.map((call) => [
      call.timestamp,
      call.method,
      call.url,
      call.status,
      call.duration,
      call.error || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const exportFileDefaultName = `api-calls-${new Date().toISOString().slice(0, 10)}.csv`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const filteredEndpoints = API_ENDPOINTS.filter((endpoint) => {
    const matchesSearch =
      filter === '' ||
      endpoint.name.toLowerCase().includes(filter.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(filter.toLowerCase());

    const matchesCategory = categoryFilter === '전체' || endpoint.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = ['전체', ...Array.from(new Set(API_ENDPOINTS.map((e) => e.category)))];

  const filteredCalls = apiCalls.filter((call) => {
    if (filter === '') return true;
    return (
      call.url.toLowerCase().includes(filter.toLowerCase()) ||
      JSON.stringify(call.params).toLowerCase().includes(filter.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">API Explorer</h1>
          <p className="text-gray-600 mt-2">D-Live 장비관리 시스템 API 테스트 도구</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Endpoints */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-bold mb-4">API 엔드포인트</h2>

              {/* Category Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="검색..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              {/* Endpoint List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredEndpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    onClick={() => setSelectedEndpoint(endpoint)}
                    className={`w-full text-left p-3 rounded border ${
                      selectedEndpoint?.id === endpoint.id
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm">{endpoint.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{endpoint.path}</div>
                    <div className="text-xs text-gray-400 mt-1">{endpoint.category}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Panel - Request Builder */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-bold mb-4">요청 설정</h2>

              {selectedEndpoint ? (
                <>
                  <div className="mb-4">
                    <h3 className="font-medium text-lg">{selectedEndpoint.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{selectedEndpoint.description}</p>
                    <code className="block bg-gray-100 p-2 rounded mt-2 text-sm">
                      POST {selectedEndpoint.path}
                    </code>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">파라미터</h4>
                      {selectedEndpoint.params.length > 0 && (
                        <button
                          onClick={handleFillSampleData}
                          className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200"
                        >
                          샘플 데이터 채우기
                        </button>
                      )}
                    </div>
                    {selectedEndpoint.params.length > 0 ? (
                      <div className="space-y-3">
                        {selectedEndpoint.params.map((param) => (
                          <div key={param.name}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {param.name}
                              {param.required && <span className="text-red-500 ml-1">*</span>}
                              <span className="text-gray-400 ml-2 text-xs">({param.type})</span>
                            </label>
                            <input
                              type="text"
                              value={paramValues[param.name] || ''}
                              onChange={(e) => handleParamChange(param.name, e.target.value)}
                              className="w-full border border-gray-300 rounded px-3 py-2"
                              placeholder={param.default?.toString() || ''}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">파라미터 없음</p>
                    )}
                  </div>

                  <button
                    onClick={handleCallApi}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '호출 중...' : 'API 호출'}
                  </button>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  왼쪽에서 API 엔드포인트를 선택하세요
                </p>
              )}
            </div>

            {/* Response Panel */}
            {selectedCall && (
              <div className="bg-white rounded-lg shadow p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">응답</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedCall.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : selectedCall.status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {selectedCall.status}
                    </span>
                    <span className="text-xs text-gray-500">{selectedCall.duration}ms</span>
                  </div>
                </div>

                {selectedCall.error ? (
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
                    {selectedCall.error}
                  </div>
                ) : selectedCall.response ? (
                  <div className="bg-gray-50 rounded p-3 max-h-[400px] overflow-y-auto">
                    <pre className="text-xs">{JSON.stringify(selectedCall.response, null, 2)}</pre>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">호출 대기 중...</p>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - History */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">호출 기록</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportJson}
                    className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                    disabled={apiCalls.length === 0}
                  >
                    JSON
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                    disabled={apiCalls.length === 0}
                  >
                    CSV
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                    disabled={apiCalls.length === 0}
                  >
                    초기화
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[800px] overflow-y-auto">
                {filteredCalls.length > 0 ? (
                  filteredCalls.map((call) => (
                    <button
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className={`w-full text-left p-3 rounded border ${
                        selectedCall?.id === call.id
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">
                          {new Date(call.timestamp).toLocaleTimeString('ko-KR')}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            call.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : call.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {call.duration}ms
                        </span>
                      </div>
                      <div className="text-sm font-medium truncate">{call.url}</div>
                      {call.error && (
                        <div className="text-xs text-red-600 truncate mt-1">{call.error}</div>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8 text-sm">호출 기록이 없습니다</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiExplorer;
