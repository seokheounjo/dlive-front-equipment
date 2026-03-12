import React, { useState, useEffect } from 'react';
import { WorkDirection, WorkItem, WorkOrderStatus } from '../../types';
import WorkItemCard from '../work/WorkItemCard';
import WorkOrderDetail from '../work/WorkOrderDetail';
import WorkCompletionResult from '../work/WorkCompletionResult';
import WorkCancelModal from '../work/WorkCancelModal';
import EquipmentStatusModal from '../modal/EquipmentStatusModal';
import NetworkTransferModal from '../modal/NetworkTransferModal';
import ConfirmModal from '../common/ConfirmModal';
import { cancelWork, getWorkReceipts, insertRcptProcInfo, getTechnicianEquipments, NetworkError, getCommonCodes } from '../../services/apiService';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import VipBadge from '../common/VipBadge';
import { ClipboardList, Navigation } from 'lucide-react';
import { useWorkProcessStore } from '../../stores/workProcessStore';
import { useUIStore } from '../../stores/uiStore';
import { geocodeAndNavigate } from '../../services/navigationService';
import { useCertifyStore } from '../../stores/certifyStore';
import { useWorkEquipmentStore } from '../../stores/workEquipmentStore';
import { formatDateTimeFromISO } from '../../utils/dateFormatter';

interface WorkItemListProps {
  direction: WorkDirection;  // 작업지시서 (부모)
  onBack: () => void;
  onNavigateToView?: (view: string, data?: any) => void;
  userId?: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  isRecontract?: boolean;
}

const WorkItemList: React.FC<WorkItemListProps> = ({ direction, onBack, onNavigateToView, userId, showToast, isRecontract }) => {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);  // 개별 작업 목록
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [showCompleteDetail, setShowCompleteDetail] = useState<WorkItem | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<WorkItem | null>(null);
  const [showEquipmentStatusModal, setShowEquipmentStatusModal] = useState(false);
  const [equipmentStatusTarget, setEquipmentStatusTarget] = useState<any>(null);
  const [showNetworkTransferModal, setShowNetworkTransferModal] = useState(false);
  const [networkTransferTarget, setNetworkTransferTarget] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; title?: string; type?: 'confirm' | 'warning' | 'info' | 'error'; showCancel?: boolean; onConfirm: () => void }>({ isOpen: false, message: '', onConfirm: () => {} });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uplsProdCodes, setUplsProdCodes] = useState<string[]>([]);
  const [uplsProdMap, setUplsProdMap] = useState<Record<string, string>>({});
  const [navLoading, setNavLoading] = useState(false);
  const { preferredNavApp } = useUIStore();

  // LGCT001 (LGU+/UPLS 상품 코드 목록 + OP_LNKD_CD map) 로드
  useEffect(() => {
    getCommonCodes('LGCT001').then(codes => {
      const prodCodes: string[] = [];
      const map: Record<string, string> = {};
      codes.forEach((item: any) => {
        const code = item.code || item.COMMON_CD;
        if (code) {
          prodCodes.push(code);
          map[code] = item.ref_code8 || '';
        }
      });
      setUplsProdCodes(prodCodes);
      setUplsProdMap(map);
      console.log('[WorkItemList] LGCT001 로드 완료:', prodCodes.length, '개 상품');
    }).catch(() => {});
  }, []);

  // 작업 선택 시 이전 작업 draft 삭제를 위한 store
  const clearPreviousWorkDraft = useWorkProcessStore((state) => state.clearPreviousWorkDraft);

  // 작업 전환 시 장비 스토어 초기화
  const clearAllWorkStates = useWorkEquipmentStore((state) => state.clearAllWorkStates);

  // 실제 API에서 작업 목록 가져오기
  useEffect(() => {
    const fetchWorkItems = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('WorkItemList - direction 전체 객체:', direction);
        console.log('WorkItemList - direction.id:', direction.id);
        console.log('API 호출 시작 - WRK_DRCTN_ID:', direction.id);

        const items = await getWorkReceipts(direction.id);

        // 정렬: 1) 상태별 (진행중/할당 → 완료 → 취소)
        //       2) 상품그룹별 (설치: V→D→I, 철거: I→D→V)
        const sortedItems = items.sort((a, b) => {
          // 1. 상태 우선순위
          const getStatusPriority = (status: string) => {
            if (status === '할당' || status === '진행중') return 1;
            if (status === '완료') return 2;
            return 3; // 취소
          };
          const statusDiff = getStatusPriority(a.WRK_STAT_CD_NM) - getStatusPriority(b.WRK_STAT_CD_NM);
          if (statusDiff !== 0) return statusDiff;

          // 2. 상품그룹 우선순위 (WRK_CD에 따라 다름)
          // 설치류: 01(설치), 05(상품변경), 07(이전설치), 0440(정지철거복구) → V→D→I
          // 철거류: 02(철거), 08(이전철거), 0430(정지철거) → I→D→V
          const isRemovalType = (item: any) => {
            const wrkCd = item.WRK_CD;
            const wrkDtlTcd = item.WRK_DTL_TCD;
            // 철거류: 02, 08, 0430(정지철거)
            if (wrkCd === '02' || wrkCd === '08') return true;
            if (wrkDtlTcd === '0430') return true;
            return false;
          };

          const getProdGrpPriority = (item: any) => {
            const prodGrp = item.PROD_GRP || '';
            if (isRemovalType(item)) {
              // 철거류: ISP(I) → DTV(D) → VoIP(V)
              if (prodGrp === 'I') return 1;
              if (prodGrp === 'D') return 2;
              if (prodGrp === 'V') return 3;
            } else {
              // 설치류: VoIP(V) → DTV(D) → ISP(I)
              if (prodGrp === 'V') return 1;
              if (prodGrp === 'D') return 2;
              if (prodGrp === 'I') return 3;
            }
            return 4; // 기타
          };

          return getProdGrpPriority(a) - getProdGrpPriority(b);
        });

        // 비가입자 A/S 등 접수(receipt)가 없는 경우 작업지시서 데이터로 가상 WorkItem 생성
        if (sortedItems.length === 0) {
          console.log('[WorkItemList] 접수 없음 - 작업지시서 데이터로 가상 WorkItem 생성');
          const dir = direction as any;
          const statusToCode = (s: string) => s === '완료' ? '4' : s === '취소' ? '3' : '2';
          const virtualItem: WorkItem = {
            id: direction.id,
            directionId: direction.id,
            type: direction.type,
            typeDisplay: direction.typeDisplay,
            status: (direction.status === '완료' ? '완료' : direction.status === '취소' ? '취소' : '진행중') as any,
            scheduledAt: direction.scheduledAt,
            customer: { ...direction.customer },
            details: direction.details || '',
            assignedEquipment: [],
            WRK_CD: dir.WRK_CD,
            WRK_CD_NM: dir.WRK_CD_NM,
            WRK_DTL_TCD: dir.WRK_DTL_TCD,
            WRK_STAT_CD: dir.MIN_WRK_STAT_CD || dir.WRK_STAT_CD || statusToCode(direction.status as string),
            WRK_STAT_NM: dir.WRK_STAT_NM || direction.status,
            WRK_DRCTN_ID: direction.id,
            CTRT_ID: dir.CTRT_ID,
            PROD_NM: dir.PROD_NM,
            PROD_CD: dir.PROD_CD,
            PROD_GRP: dir.PROD_GRP,
            PROD_GRP_NM: dir.PROD_GRP_NM,
            productName: dir.PROD_NM,
            SO_ID: dir.SO_ID,
            SO_NM: dir.SO_NM,
            MST_SO_ID: dir.MST_SO_ID,
            CRR_ID: dir.CRR_ID,
            CRR_NM: dir.CRR_NM,
            CUST_ID: dir.CUST_ID || direction.customer?.id,
            VIP_GB: dir.VIP_GB || '',
            OST_WORKABLE_STAT: dir.OST_WORKABLE_STAT,
            installLocation: dir.installLocation || dir.INSTL_LOC,
            CTRT_STAT: dir.CTRT_STAT,
            CTRT_STAT_NM: dir.CTRT_STAT_NM,
          };
          sortedItems.push(virtualItem);
        }

        setWorkItems(sortedItems);
        console.log('Work items loaded - 개수:', sortedItems.length);
        console.log('Work items 상세:', sortedItems);
      } catch (error) {
        console.error('작업 목록 로드 실패:', error);

        // NetworkError인 경우 사용자 친화적인 메시지 사용
        if (error instanceof NetworkError) {
          setError(error.message);
          if (showToast) showToast(error.message, 'error', true);
        } else if (error instanceof Error) {
          setError(error.message);
          if (showToast) showToast(error.message, 'error', true);
        } else {
          setError('작업 목록을 불러오는데 실패했습니다.');
          if (showToast) showToast('작업 목록을 불러오는데 실패했습니다.', 'error', true);
        }

        setWorkItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkItems();
  }, [direction.id, showToast]);

  const handleSelectItem = (item: any) => {
    console.log('작업 카드 클릭됨:', item);
    console.log('선택된 작업 ID:', item.WRK_ID || item.id);
    console.log('선택된 작업 정보:', {
      WRK_ID: item.WRK_ID,
      WRK_CD_NM: item.WRK_CD_NM,
      CUST_NM: item.CUST_NM,
      PROD_NM: item.PROD_NM,
      RCPT_ID: item.RCPT_ID,
    });

    // 이전 작업의 draft 삭제 (다른 작업 선택 시)
    const newWorkId = item.WRK_ID || item.id;
    const prevWorkId = useWorkProcessStore.getState().currentWorkId;
    clearPreviousWorkDraft(newWorkId);

    // 다른 작업으로 전환할 때만 certify/장비 초기화 (같은 작업 재진입 시 보존)
    if (prevWorkId !== newWorkId) {
      useCertifyStore.getState().reset();
      clearAllWorkStates();
    }

    // 작업요청상세 디버깅
    console.log('[작업요청상세] REQ_CTX 원본:', item.REQ_CTX);
    console.log('[작업요청상세] REQ_CTX JSON:', JSON.stringify(item.REQ_CTX));
    // VIP 디버깅
    console.log('[VIP 디버그] item.VIP_GB:', item.VIP_GB, '| direction.VIP_GB:', (direction as any).VIP_GB, '| direction.customer.isVip:', direction.customer?.isVip);

    // 상품변경철거(0520)/서비스전환철거(0560)일 때 형제 설치접수의 변경 후 상품명 사용
    let resolvedNewProduct = item.PROD_NM;
    if (item.WRK_DTL_TCD === '0520' || item.WRK_DTL_TCD === '0560') {
      const siblingInstallTcd = item.WRK_DTL_TCD === '0520' ? '0510' : '0550';
      const sibling = workItems.find((w: any) =>
        w.WRK_DTL_TCD === siblingInstallTcd && w.PROD_GRP === item.PROD_GRP
      );
      if (sibling) resolvedNewProduct = sibling.PROD_NM;
    }

    // 실제 API 데이터를 WorkOrder 형태로 변환 (handleSelectItem)
    const convertedItem: WorkItem = {
      id: item.WRK_ID || item.id,
      directionId: item.WRK_DRCTN_ID || item.directionId,
      type: item.WRK_CD_NM === 'A/S' ? 'A/S' as any : 'Installation' as any,
      typeDisplay: item.WRK_CD_NM || item.typeDisplay || '기타',
      // WRK_STAT_CD: 1=접수, 2=할당, 3=취소, 4=완료, 7=장비철거완료
      status: item.WRK_STAT_CD === '3' ? '취소' as any
            : (item.WRK_STAT_CD === '4' || item.WRK_STAT_CD === '7') ? '완료' as any
            : (item.WRK_STAT_CD === '1' || item.WRK_STAT_CD === '2') ? '진행중' as any
            : (item.WRK_STAT_CD_NM || item.status || '진행중') as any,
      scheduledAt: item.WRK_HOPE_DTTM ?
        `${item.WRK_HOPE_DTTM.slice(0,4)}-${item.WRK_HOPE_DTTM.slice(4,6)}-${item.WRK_HOPE_DTTM.slice(6,8)}T${item.WRK_HOPE_DTTM.slice(8,10)}:${item.WRK_HOPE_DTTM.slice(10,12)}:00` :
        item.scheduledAt || new Date().toISOString(),
      customer: {
        id: item.CUST_ID || item.customer?.id || '',
        name: item.CUST_NM || item.customer?.name || '고객명 없음',
        phone: item.REQ_CUST_TEL_NO || item.customer?.phone,
        address: item.ADDR || item.customer?.address || '주소 정보 없음',
        // VIP 정보 (item에 없으면 direction에서 복사)
        isVip: !!(item.VIP_GB && String(item.VIP_GB).length > 0) || direction.customer?.isVip || false,
        vipLevel: item.VIP_GB === 'VIP_VVIP' ? 'VVIP' : (item.VIP_GB ? 'VIP' : direction.customer?.vipLevel),
      },
      details: item.REQ_CTX || '',
      assignedEquipment: item.assignedEquipment || [],

      // 작업 유형별 분기처리를 위한 필드 추가
      WRK_CD: item.WRK_CD,              // 작업코드 (01:설치, 02:철거, 03:AS, 04:정지, 05:상품변경, 06:댁내이전, 07:이전설치, 08:이전철거, 09:부가상품)
      WRK_DTL_TCD: item.WRK_DTL_TCD,    // 작업 세부 유형 코드
      WRK_STAT_CD: item.WRK_STAT_CD,    // 작업 상태 코드
      WRK_STAT_NM: item.WRK_STAT_CD_NM || item.WRK_STAT_NM,  // 작업 상태명 (이전설치/이전철거 상품정보용)
      WRK_DRCTN_ID: item.WRK_DRCTN_ID,  // 작업지시 ID
      CTRT_ID: item.CTRT_ID,            // 원본 계약 ID (상품변경 시 OLD_CTRT_ID로 사용)
      DTL_CTRT_ID: item.DTL_CTRT_ID,    // 상세 계약 ID (상품변경 시 신규 계약 ID)
      RCPT_ID: item.RCPT_ID || (direction as any)?.RCPT_ID || '',  // 접수 ID (핫빌 재호출 fallback)
      productName: item.PROD_NM,        // 상품명 (레거시 호환)
      PROD_NM: item.PROD_NM,            // 상품명 (장비정보변경 모달에서 사용)
      OLD_PROD_CD: item.OLD_PROD_CD,    // 이전 상품코드 (상품변경 시)
      OLD_PROD_NM: item.OLD_PROD_NM,    // 이전 상품명 (상품변경 시)
      OLD_CTRT_ID: item.OLD_CTRT_ID,    // 이전 계약ID (상품변경 시)
      OLD_CTRT_STAT: item.OLD_CTRT_STAT, // 이전 계약상태코드 (상품변경 시)
      OLD_CTRT_STAT_NM: item.OLD_CTRT_STAT_NM, // 이전 계약상태명 (상품변경 시)
      OLD_PROM_CNT: item.OLD_PROM_CNT,  // 이전 약정기간 (상품변경 시)
      currentProduct: item.OLD_PROD_NM || item.OLD_PROD_CD,  // 현재(이전) 상품 - 상품변경 상세정보용
      newProduct: resolvedNewProduct,    // 변경(새) 상품 - 상품변경철거 시 형제 설치접수 상품명 사용
      installLocation: item.INSTL_LOC,  // 설치위치

      // 추가 작업 관련 정보
      MST_SO_ID: item.MST_SO_ID,        // 마스터 지점 ID (장비이관에 필요)
      SO_ID: item.SO_ID,                // 지점 ID
      PROD_CD: item.PROD_CD,            // 상품 코드
      ADDR_ORD: item.ADDR_ORD,          // 주소 순번
      CRR_ID: item.CRR_ID,              // 권역/통신사 ID
      BLD_ID: item.BLD_ID,              // 건물 ID
      CUST_ID: item.CUST_ID,            // 고객 ID (계약정보 API 호출에 필요)
      WRKR_ID: item.WRKR_ID,            // 작업자 ID (장비이관에 필요)

      // 계약정보 - 계약 상태
      CTRT_STAT: item.CTRT_STAT,        // 계약상태 (10:설치대기, 20:정상 등)
      CTRT_STAT_NM: item.CTRT_STAT_NM,  // 계약상태명
      SO_NM: item.SO_NM,                // 지사명
      MSO_NM: item.MSO_NM,              // 계약지점명 (본부명)

      // 계약정보 - 납부방법 (API 응답에 이미 있음)
      PYM_MTHD: item.PYM_MTHD,          // 납부방법 (지로, 카드 등)
      PYM_ACNT_ID: item.PYM_ACNT_ID,    // 납부계정ID

      // 계약정보 - 약정정보 (API 응답에 있는 필드)
      APLYMONTH: item.APLYMONTH,        // 약정개월 (36 등)
      PROM_CNT: item.PROM_CNT,          // 프로모션 개월수
      CTRT_APLY_STRT_DT: item.CTRT_APLY_STRT_DT, // 약정시작일
      CTRT_APLY_END_DT: item.CTRT_APLY_END_DT,   // 약정종료일
      VOIP_TEL_NO: item.VOIP_TEL_NO,    // VoIP 번호

      // 계약정보 - 단체정보
      GRP_ID: item.GRP_ID,              // 단체ID
      GRP_NM: item.GRP_NM,              // 단체명

      // 기타 유용한 정보
      CRR_NM: item.CRR_NM,              // 권역명 (신일통신 등)
      PROD_GRP: item.PROD_GRP,          // 상품그룹 (D:DTV, I:ISP 등)
      PROD_GRP_NM: item.PROD_GRP_NM,    // 상품그룹명
      WRKR_NM: item.WRKR_NM,            // 작업자명
      ACNT_PYM_MTHD: item.ACNT_PYM_MTHD, // 납부방법코드 (01 등)
      KPI_PROD_GRP_CD: item.KPI_PROD_GRP_CD, // KPI 상품그룹코드 (인입선로 철거관리 조건)
      PROD_CHG_GB: item.PROD_CHG_GB,    // 상품변경구분 (01:설치, 02:철거)
      CHG_KPI_PROD_GRP_CD: item.CHG_KPI_PROD_GRP_CD, // 변경 KPI 상품그룹코드
      VOIP_CTX: item.VOIP_CTX,          // VoIP 컨텍스트 (T/R이면 인입선로 제외)
      VIP_GB: item.VIP_GB || (direction as any).VIP_GB || '',  // VIP 구분 (item에 없으면 direction에서 복사)
      IS_CERTIFY_PROD: item.IS_CERTIFY_PROD || (uplsProdMap[item.PROD_CD] !== undefined ? '1' : undefined), // LGCT001 enrichment
      OP_LNKD_CD: item.OP_LNKD_CD || uplsProdMap[item.PROD_CD] || undefined,      // LGCT001 ref_code8 enrichment
      VOIP_PROD_CD: item.VOIP_PROD_CD,  // VoIP 상품코드 (결합계약 조건 판단용)
      ISP_PROD_CD: item.ISP_PROD_CD,    // ISP 상품코드 (결합계약 조건 판단용)

      // A/S 망이관 관련
      FMS_AS_WRK_STAT_CD: item.FMS_AS_WRK_STAT_CD,
      WORK_REQ_TEL_NO: item.WORK_REQ_TEL_NO,
      CUST_TEL_NO1: item.CUST_TEL_NO1,
      CUST_TEL_NO2: item.CUST_TEL_NO2,

      // 작업 완료일자 (완료된 작업인 경우)
      WRKR_CMPL_DT: item.WRKR_CMPL_DT,  // 작업자 완료일자 (YYYYMMDD)
      WRK_END_DTTM: item.WRK_END_DTTM,  // 작업 종료일시

      // 설치정보 (완료된 작업 조회 시 사용)
      NET_CL: item.NET_CL,              // 망구분 코드
      NET_CL_NM: item.NET_CL_NM,        // 망구분명
      WRNG_TP: item.WRNG_TP,            // 배선유형 코드
      WRNG_TP_NM: item.WRNG_TP_NM,      // 배선유형명
      INSTL_TP: item.INSTL_TP,          // 설치유형 코드
      INSTL_TP_NM: item.INSTL_TP_NM,    // 설치유형명
      CB_WRNG_TP: item.CB_WRNG_TP,      // 메인보드 배선유형
      CB_INSTL_TP: item.CB_INSTL_TP,    // 메인보드 설치유형
      INOUT_LINE_TP: item.INOUT_LINE_TP, // 실내외 라인 타입
      INOUT_LEN: item.INOUT_LEN,        // 실내외 길이
      DVDR_YN: item.DVDR_YN,            // 분배기 여부
      BFR_LINE_YN: item.BFR_LINE_YN,    // 기존 라인 여부
      CUT_YN: item.CUT_YN,              // 컷 여부
      TERM_NO: item.TERM_NO,            // 터미널 번호
      RCV_STS: item.RCV_STS,            // 수신 상태
      SUBTAP_ID: item.SUBTAP_ID,        // 서브탭 ID
      PORT_NUM: item.PORT_NUM,          // 포트 번호
      EXTN_TP: item.EXTN_TP,            // 확장 타입
      TAB_LBL: item.TAB_LBL,            // TAB 라벨
      CVT_LBL: item.CVT_LBL,            // CVT 라벨
      STB_LBL: item.STB_LBL,            // STB 라벨

      // 작업완료 입력값 (완료된 작업 조회 시 사용)
      CUST_REL: item.CUST_REL,          // 고객관계 코드
      UP_CTRL_CL: item.UP_CTRL_CL,      // 상향제어 코드
      PSN_USE_CORP: item.PSN_USE_CORP,  // 인터넷이용 코드
      VOIP_USE_CORP: item.VOIP_USE_CORP, // VoIP이용 코드
      DTV_USE_CORP: item.DTV_USE_CORP,  // 디지털방송이용 코드
      VIEW_MOD_CD: item.VIEW_MOD_CD,    // 시청모드 코드
      VIEW_MOD_NM: item.VIEW_MOD_NM,    // 시청모드명
      MEMO: item.MEMO,                  // 작업비고

      // 해지작업용 희망일 필드 (Hot Bill 시뮬레이션에 필요)
      TERM_HOPE_DT: item.TERM_HOPE_DT,  // 해지희망일 (YYYYMMDD)
      HOPE_DT: item.HOPE_DT,            // 희망일 (YYYYMMDD)

      // A/S 접수유형 (처리유형 필터에 필요)
      asReasonCode: item.WRK_RCPT_CL,   // A/S 접수 유형 (WRK_RCPT_CL) - 예: JH(전화복구)
      asDetailCode: item.WRK_RCPT_CL_DTL, // A/S 접수 상세 유형 (WRK_RCPT_CL_DTL) - 예: JHA(미방문), JHB(2층1인)

      // 원스톱 작업 가능 상태 (0:불가, 1:철거만가능, 2:철거완료, 3:완료, 4:화면접수불가/설치불가, X:OST아님)
      OST_WORKABLE_STAT: item.OST_WORKABLE_STAT,

      // 작업예정일시 (작업자보정 모달에서 사용)
      WRK_HOPE_DTTM: item.WRK_HOPE_DTTM,  // YYYYMMDDHHMM 형식

      // 재약정 대상 여부
      isRecontract: isRecontract || false,
    };

    console.log('[WorkItemList] handleSelectItem - OST_WORKABLE_STAT:', item.OST_WORKABLE_STAT, '| WRK_CD:', item.WRK_CD);
    console.log('변환된 작업 데이터:', convertedItem);
    if (onNavigateToView) {
      // WorkOrderDetail을 건너뛰고 바로 작업 프로세스로 진입
      onNavigateToView('work-process-flow', convertedItem);
    } else {
      setSelectedItem(convertedItem);
    }
  };

  const handleUpdateItemStatus = (itemId: string, status: WorkOrderStatus) => {
    // 실제로는 상태 업데이트 로직 필요
    console.log(`작업 ${itemId} 상태를 ${status}로 변경`);
  };

  const handleCompleteWork = (item: any) => {
    console.log('진행 버튼 클릭 - 원본 데이터:', item);
    console.log('[handleCompleteWork] RCPT_ID:', item.RCPT_ID, '| direction.RCPT_ID:', (direction as any)?.RCPT_ID);

    // A/S(03) 작업: FMS 망이관 체크 → 이관되었으면 작업완료 불가 (SO_ID=403 제외)
    if (item.WRK_CD === '03' && item.FMS_AS_WRK_STAT_CD && item.SO_ID !== '403') {
      setConfirmModal({
        isOpen: true, title: '작업완료 불가',
        message: `[전송망이관]되어 작업완료가 불가능합니다.\n\n1. 모바일CONA 의뢰서ID와 MOST계측작업ID 일치여부 확인(10자리)\n2. FMS MOST 신규이관 등록 후 MOST AS처리결과 등록 (완료)\n\n[의뢰서 ID: ${item.WRK_DRCTN_ID}]`,
        type: 'warning', showCancel: false,
        onConfirm: () => {},
      });
      return;
    }

    // 이전 작업의 draft 삭제 (다른 작업 선택 시)
    const newWorkId = item.WRK_ID || item.id;
    const prevWorkId = useWorkProcessStore.getState().currentWorkId;
    clearPreviousWorkDraft(newWorkId);

    // 다른 작업으로 전환할 때만 certify/장비 초기화 (같은 작업 재진입 시 보존)
    if (prevWorkId !== newWorkId) {
      useCertifyStore.getState().reset();
      clearAllWorkStates();
    }

    // 상품변경철거(0520)/서비스전환철거(0560)일 때 형제 설치접수의 변경 후 상품명 사용
    let resolvedNewProduct = item.PROD_NM;
    if (item.WRK_DTL_TCD === '0520' || item.WRK_DTL_TCD === '0560') {
      const siblingInstallTcd = item.WRK_DTL_TCD === '0520' ? '0510' : '0550';
      const sibling = workItems.find((w: any) =>
        w.WRK_DTL_TCD === siblingInstallTcd && w.PROD_GRP === item.PROD_GRP
      );
      if (sibling) resolvedNewProduct = sibling.PROD_NM;
    }

    // handleSelectItem과 동일하게 작업 상세 화면으로 이동 (handleCompleteWork)
    const convertedItem: WorkItem = {
      id: item.WRK_ID || item.id,
      directionId: item.WRK_DRCTN_ID || item.directionId,
      type: item.WRK_CD_NM === 'A/S' ? 'A/S' as any : 'Installation' as any,
      typeDisplay: item.WRK_CD_NM || item.typeDisplay || '기타',
      // WRK_STAT_CD: 1=접수, 2=할당, 3=취소, 4=완료, 7=장비철거완료
      status: item.WRK_STAT_CD === '3' ? '취소' as any
            : (item.WRK_STAT_CD === '4' || item.WRK_STAT_CD === '7') ? '완료' as any
            : (item.WRK_STAT_CD === '1' || item.WRK_STAT_CD === '2') ? '진행중' as any
            : (item.WRK_STAT_CD_NM || item.status || '진행중') as any,
      scheduledAt: item.WRK_HOPE_DTTM ?
        `${item.WRK_HOPE_DTTM.slice(0,4)}-${item.WRK_HOPE_DTTM.slice(4,6)}-${item.WRK_HOPE_DTTM.slice(6,8)}T${item.WRK_HOPE_DTTM.slice(8,10)}:${item.WRK_HOPE_DTTM.slice(10,12)}:00` :
        item.scheduledAt || new Date().toISOString(),
      customer: {
        id: item.CUST_ID || item.customer?.id || '',
        name: item.CUST_NM || item.customer?.name || '고객명 없음',
        phone: item.REQ_CUST_TEL_NO || item.customer?.phone,
        address: item.ADDR || item.customer?.address || '주소 정보 없음',
        // VIP 정보 (item에 없으면 direction에서 복사)
        isVip: !!(item.VIP_GB && String(item.VIP_GB).length > 0) || direction.customer?.isVip || false,
        vipLevel: item.VIP_GB === 'VIP_VVIP' ? 'VVIP' : (item.VIP_GB ? 'VIP' : direction.customer?.vipLevel),
      },
      details: item.REQ_CTX || '',
      assignedEquipment: item.assignedEquipment || [],

      // 작업 유형별 분기처리를 위한 필드 추가
      WRK_CD: item.WRK_CD,              // 작업코드 (01:설치, 02:철거, 03:AS, 04:정지, 05:상품변경, 06:댁내이전, 07:이전설치, 08:이전철거, 09:부가상품)
      WRK_DTL_TCD: item.WRK_DTL_TCD,    // 작업 세부 유형 코드
      WRK_STAT_CD: item.WRK_STAT_CD,    // 작업 상태 코드
      WRK_STAT_NM: item.WRK_STAT_CD_NM || item.WRK_STAT_NM,  // 작업 상태명 (이전설치/이전철거 상품정보용)
      WRK_DRCTN_ID: item.WRK_DRCTN_ID,  // 작업지시 ID
      CTRT_ID: item.CTRT_ID,            // 원본 계약 ID (상품변경 시 OLD_CTRT_ID로 사용)
      DTL_CTRT_ID: item.DTL_CTRT_ID,    // 상세 계약 ID (상품변경 시 신규 계약 ID)
      RCPT_ID: item.RCPT_ID || (direction as any)?.RCPT_ID || '',  // 접수 ID (핫빌 재호출 fallback)
      productName: item.PROD_NM,        // 상품명 (레거시 호환)
      PROD_NM: item.PROD_NM,            // 상품명 (장비정보변경 모달에서 사용)
      OLD_PROD_CD: item.OLD_PROD_CD,    // 이전 상품코드 (상품변경 시)
      OLD_PROD_NM: item.OLD_PROD_NM,    // 이전 상품명 (상품변경 시)
      OLD_CTRT_ID: item.OLD_CTRT_ID,    // 이전 계약ID (상품변경 시)
      OLD_CTRT_STAT: item.OLD_CTRT_STAT, // 이전 계약상태코드 (상품변경 시)
      OLD_CTRT_STAT_NM: item.OLD_CTRT_STAT_NM, // 이전 계약상태명 (상품변경 시)
      OLD_PROM_CNT: item.OLD_PROM_CNT,  // 이전 약정기간 (상품변경 시)
      currentProduct: item.OLD_PROD_NM || item.OLD_PROD_CD,  // 현재(이전) 상품 - 상품변경 상세정보용
      newProduct: resolvedNewProduct,    // 변경(새) 상품 - 상품변경철거 시 형제 설치접수 상품명 사용
      installLocation: item.INSTL_LOC,  // 설치위치

      // 추가 작업 관련 정보
      MST_SO_ID: item.MST_SO_ID,        // 마스터 지점 ID (장비이관에 필요)
      SO_ID: item.SO_ID,                // 지점 ID
      PROD_CD: item.PROD_CD,            // 상품 코드
      ADDR_ORD: item.ADDR_ORD,          // 주소 순번
      CRR_ID: item.CRR_ID,              // 권역/통신사 ID
      BLD_ID: item.BLD_ID,              // 건물 ID
      CUST_ID: item.CUST_ID,            // 고객 ID (계약정보 API 호출에 필요)
      WRKR_ID: item.WRKR_ID,            // 작업자 ID (장비이관에 필요)

      // 계약정보 - 계약 상태
      CTRT_STAT: item.CTRT_STAT,        // 계약상태 (10:설치대기, 20:정상 등)
      CTRT_STAT_NM: item.CTRT_STAT_NM,  // 계약상태명
      SO_NM: item.SO_NM,                // 지사명
      MSO_NM: item.MSO_NM,              // 계약지점명 (본부명)

      // 계약정보 - 납부방법 (API 응답에 이미 있음)
      PYM_MTHD: item.PYM_MTHD,          // 납부방법 (지로, 카드 등)
      PYM_ACNT_ID: item.PYM_ACNT_ID,    // 납부계정ID

      // 계약정보 - 약정정보 (API 응답에 있는 필드)
      APLYMONTH: item.APLYMONTH,        // 약정개월 (36 등)
      PROM_CNT: item.PROM_CNT,          // 프로모션 개월수
      CTRT_APLY_STRT_DT: item.CTRT_APLY_STRT_DT, // 약정시작일
      CTRT_APLY_END_DT: item.CTRT_APLY_END_DT,   // 약정종료일
      VOIP_TEL_NO: item.VOIP_TEL_NO,    // VoIP 번호

      // 계약정보 - 단체정보
      GRP_ID: item.GRP_ID,              // 단체ID
      GRP_NM: item.GRP_NM,              // 단체명

      // 기타 유용한 정보
      CRR_NM: item.CRR_NM,              // 권역명 (신일통신 등)
      PROD_GRP: item.PROD_GRP,          // 상품그룹 (D:DTV, I:ISP 등)
      PROD_GRP_NM: item.PROD_GRP_NM,    // 상품그룹명
      WRKR_NM: item.WRKR_NM,            // 작업자명
      ACNT_PYM_MTHD: item.ACNT_PYM_MTHD, // 납부방법코드 (01 등)
      KPI_PROD_GRP_CD: item.KPI_PROD_GRP_CD, // KPI 상품그룹코드 (인입선로 철거관리 조건)
      PROD_CHG_GB: item.PROD_CHG_GB,    // 상품변경구분 (01:설치, 02:철거)
      CHG_KPI_PROD_GRP_CD: item.CHG_KPI_PROD_GRP_CD, // 변경 KPI 상품그룹코드
      VOIP_CTX: item.VOIP_CTX,          // VoIP 컨텍스트 (T/R이면 인입선로 제외)
      VIP_GB: item.VIP_GB || (direction as any).VIP_GB || '',  // VIP 구분 (item에 없으면 direction에서 복사)
      IS_CERTIFY_PROD: item.IS_CERTIFY_PROD || (uplsProdMap[item.PROD_CD] !== undefined ? '1' : undefined), // LGCT001 enrichment
      OP_LNKD_CD: item.OP_LNKD_CD || uplsProdMap[item.PROD_CD] || undefined,      // LGCT001 ref_code8 enrichment
      VOIP_PROD_CD: item.VOIP_PROD_CD,  // VoIP 상품코드 (결합계약 조건 판단용)
      ISP_PROD_CD: item.ISP_PROD_CD,    // ISP 상품코드 (결합계약 조건 판단용)

      // A/S 망이관 관련
      FMS_AS_WRK_STAT_CD: item.FMS_AS_WRK_STAT_CD,
      WORK_REQ_TEL_NO: item.WORK_REQ_TEL_NO,
      CUST_TEL_NO1: item.CUST_TEL_NO1,
      CUST_TEL_NO2: item.CUST_TEL_NO2,

      // 작업 완료일자 (완료된 작업인 경우)
      WRKR_CMPL_DT: item.WRKR_CMPL_DT,  // 작업자 완료일자 (YYYYMMDD)
      WRK_END_DTTM: item.WRK_END_DTTM,  // 작업 종료일시

      // 설치정보 (완료된 작업 조회 시 사용)
      NET_CL: item.NET_CL,              // 망구분 코드
      NET_CL_NM: item.NET_CL_NM,        // 망구분명
      WRNG_TP: item.WRNG_TP,            // 배선유형 코드
      WRNG_TP_NM: item.WRNG_TP_NM,      // 배선유형명
      INSTL_TP: item.INSTL_TP,          // 설치유형 코드
      INSTL_TP_NM: item.INSTL_TP_NM,    // 설치유형명
      CB_WRNG_TP: item.CB_WRNG_TP,      // 메인보드 배선유형
      CB_INSTL_TP: item.CB_INSTL_TP,    // 메인보드 설치유형
      INOUT_LINE_TP: item.INOUT_LINE_TP, // 실내외 라인 타입
      INOUT_LEN: item.INOUT_LEN,        // 실내외 길이
      DVDR_YN: item.DVDR_YN,            // 분배기 여부
      BFR_LINE_YN: item.BFR_LINE_YN,    // 기존 라인 여부
      CUT_YN: item.CUT_YN,              // 컷 여부
      TERM_NO: item.TERM_NO,            // 터미널 번호
      RCV_STS: item.RCV_STS,            // 수신 상태
      SUBTAP_ID: item.SUBTAP_ID,        // 서브탭 ID
      PORT_NUM: item.PORT_NUM,          // 포트 번호
      EXTN_TP: item.EXTN_TP,            // 확장 타입
      TAB_LBL: item.TAB_LBL,            // TAB 라벨
      CVT_LBL: item.CVT_LBL,            // CVT 라벨
      STB_LBL: item.STB_LBL,            // STB 라벨

      // 작업완료 입력값 (완료된 작업 조회 시 사용)
      CUST_REL: item.CUST_REL,          // 고객관계 코드
      UP_CTRL_CL: item.UP_CTRL_CL,      // 상향제어 코드
      PSN_USE_CORP: item.PSN_USE_CORP,  // 인터넷이용 코드
      VOIP_USE_CORP: item.VOIP_USE_CORP, // VoIP이용 코드
      DTV_USE_CORP: item.DTV_USE_CORP,  // 디지털방송이용 코드
      VIEW_MOD_CD: item.VIEW_MOD_CD,    // 시청모드 코드
      VIEW_MOD_NM: item.VIEW_MOD_NM,    // 시청모드명
      MEMO: item.MEMO,                  // 작업비고

      // 해지작업용 희망일 필드 (Hot Bill 시뮬레이션에 필요)
      TERM_HOPE_DT: item.TERM_HOPE_DT,  // 해지희망일 (YYYYMMDD)
      HOPE_DT: item.HOPE_DT,            // 희망일 (YYYYMMDD)

      // A/S 접수유형 (처리유형 필터에 필요)
      asReasonCode: item.WRK_RCPT_CL,   // A/S 접수 유형 (WRK_RCPT_CL) - 예: JH(전화복구)
      asDetailCode: item.WRK_RCPT_CL_DTL, // A/S 접수 상세 유형 (WRK_RCPT_CL_DTL) - 예: JHA(미방문), JHB(2층1인)

      // 원스톱 작업 가능 상태 (0:불가, 1:철거만가능, 2:철거완료, 3:완료, 4:화면접수불가/설치불가, X:OST아님)
      OST_WORKABLE_STAT: item.OST_WORKABLE_STAT,

      // 작업예정일시 (작업자보정 모달에서 사용)
      WRK_HOPE_DTTM: item.WRK_HOPE_DTTM,  // YYYYMMDDHHMM 형식

      // 재약정 대상 여부
      isRecontract: isRecontract || false,
    };

    console.log('[WorkItemList] handleCompleteWork - OST_WORKABLE_STAT:', item.OST_WORKABLE_STAT, '| WRK_CD:', item.WRK_CD);
    console.log('진행 - 작업 프로세스로 이동:', convertedItem);
    if (onNavigateToView) {
      // WorkOrderDetail을 건너뛰고 바로 작업 프로세스로 진입
      onNavigateToView('work-process-flow', convertedItem);
    } else {
      setSelectedItem(convertedItem);
    }
  };

  const handleCancelWork = async (item: any) => {
    console.log('취소 버튼 클릭 - 원본 데이터:', item);

    // 이전철거(08) 취소 블로킹: 같은 CTRT_ID의 이전설치(07)가 완료 상태이면 취소 불가
    if (item.WRK_CD === '08') {
      const siblingInstall = workItems.find(
        (w: any) => w.WRK_CD === '07'
          && w.CTRT_ID === item.CTRT_ID
          && (w.WRK_STAT_CD === '4' || w.WRK_STAT_CD === '7')
      );
      if (siblingInstall) {
        setConfirmModal({
          isOpen: true, title: '작업 취소 불가',
          message: '이전설치가 완료된 상태이므로 이전철거를 취소할 수 없습니다.',
          type: 'error', showCancel: false,
          onConfirm: () => {},
        });
        return;
      }
    }

    // A/S(03) 작업 전용 취소 차단 (레거시 mowoDivA.xml btn_cancel_work_OnClick)
    if (item.WRK_CD === '03') {
      // 1. FMS 망이관 체크: 망이관 되었으면 취소 불가 (SO_ID=403 제외)
      if (item.FMS_AS_WRK_STAT_CD && item.SO_ID !== '403') {
        setConfirmModal({
          isOpen: true, title: '작업취소 불가',
          message: `[전송망이관]되어 작업취소가 불가능합니다.\n\n1. 모바일CONA 의뢰서ID와 MOST계측작업ID 일치여부 확인(10자리)\n2. FMS MOST 신규이관 등록 후 MOST AS처리결과 등록 (완료)\n\n[의뢰서 ID: ${item.WRK_DRCTN_ID}]`,
          type: 'warning', showCancel: false,
          onConfirm: () => {},
        });
        return;
      }

      // 2. 장비구성정보변경 체크: 장비 교체/추가가 진행되었으면 취소 불가
      try {
        const eqtData = await getTechnicianEquipments({
          WRK_ID: item.WRK_ID,
          RCPT_ID: item.RCPT_ID,
          CTRT_ID: item.CTRT_ID,
          CUST_ID: item.CUST_ID,
          WRK_CD: item.WRK_CD,
          WRKR_ID: userId || '',
          SO_ID: item.SO_ID,
        });

        // ds_eqt_info (contractEquipments) 에 해당 RCPT_ID 레코드 존재 여부
        const hasEqtInfo = eqtData.contractEquipments && eqtData.contractEquipments.length > 0;

        if (hasEqtInfo) {
          const custEquip = eqtData.customerEquipments || [];
          let chkFlag = false;

          // 빈 EQT_NO 체크 (새 장비 추가됨)
          if (custEquip.some((e: any) => !e.EQT_NO)) {
            chkFlag = true;
          }
          // EQT_KND='WRKER' 체크 (기사 장비 배정됨)
          if (!chkFlag && custEquip.some((e: any) => e.EQT_KND === 'WRKER')) {
            chkFlag = true;
          }

          if (chkFlag) {
            setConfirmModal({
              isOpen: true, title: '작업 취소 불가',
              message: '장비구성정보변경이 처리되어 작업취소처리 불가합니다.\n작업완료에서 장비구성정보를 원위치시킨뒤 작업완료 진행하시기 바랍니다.',
              type: 'warning', showCancel: false,
              onConfirm: () => {},
            });
            return;
          }
        }
      } catch (error) {
        console.error('장비구성정보 체크 실패:', error);
        // 체크 실패 시에도 취소 진행 허용
      }
    }

    // 실제 API 데이터를 WorkOrder 형태로 변환 (handleCancelWork)
    const convertedItem = {
      id: item.WRK_ID || item.id,
      directionId: item.WRK_DRCTN_ID || item.directionId,
      type: item.WRK_CD_NM === 'A/S' ? 'A/S' as any : 'Installation' as any,
      typeDisplay: item.WRK_CD_NM || item.typeDisplay || '기타',
      // WRK_STAT_CD: 1=접수, 2=할당, 3=취소, 4=완료, 7=장비철거완료
      status: item.WRK_STAT_CD === '3' ? '취소' as any
            : (item.WRK_STAT_CD === '4' || item.WRK_STAT_CD === '7') ? '완료' as any
            : (item.WRK_STAT_CD === '1' || item.WRK_STAT_CD === '2') ? '진행중' as any
            : (item.WRK_STAT_CD_NM || '진행중') as any,
      scheduledAt: item.WRK_HOPE_DTTM ?
        `${item.WRK_HOPE_DTTM.slice(0,4)}-${item.WRK_HOPE_DTTM.slice(4,6)}-${item.WRK_HOPE_DTTM.slice(6,8)}T${item.WRK_HOPE_DTTM.slice(8,10)}:${item.WRK_HOPE_DTTM.slice(10,12)}:00` :
        new Date().toISOString(),
      customer: {
        id: item.CUST_ID || '',
        name: item.CUST_NM || '고객명 없음',
        phone: item.REQ_CUST_TEL_NO,
        address: item.ADDR || '주소 정보 없음',
        // VIP 정보 (item에 없으면 direction에서 복사)
        isVip: !!(item.VIP_GB && String(item.VIP_GB).length > 0) || direction.customer?.isVip || false,
        vipLevel: item.VIP_GB === 'VIP_VVIP' ? 'VVIP' : (item.VIP_GB ? 'VIP' : direction.customer?.vipLevel),
      },
      details: item.REQ_CTX || '',
      assignedEquipment: [],
      WRK_CD: item.WRK_CD,
      CTRT_ID: item.CTRT_ID,
      WRK_STAT_CD: item.WRK_STAT_CD,
      RCPT_ID: item.RCPT_ID,
      SO_ID: item.SO_ID,
      asReasonCode: item.WRK_RCPT_CL,
      asDetailCode: item.WRK_RCPT_CL_DTL,
    };

    console.log('취소 - 변환된 데이터:', convertedItem);
    setCancelTarget(convertedItem);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async (cancelData: any) => {
    if (!cancelTarget) return;

    console.log('취소 확인 - cancelData:', cancelData);
    console.log('취소 대상 - cancelTarget:', cancelTarget);

    setIsLoading(true);
    setShowCancelModal(false);

    try {
      console.log('작업취소 API 호출 - 전체 데이터:', cancelData);

      const result = await cancelWork(cancelData);
      console.log('작업 취소 API 응답:', result);

      if (result.code === "SUCCESS" || result.code === "OK") {
        if (showToast) showToast('작업이 성공적으로 취소되었습니다.', 'success');
        const items = await getWorkReceipts(direction.id);
        const sortedItems = items.sort((a, b) => {
          const getStatusPriority = (status: string) => {
            if (status === '할당' || status === '진행중') return 1;
            if (status === '완료') return 2;
            return 3;
          };
          return getStatusPriority(a.WRK_STAT_CD_NM) - getStatusPriority(b.WRK_STAT_CD_NM);
        });
        setWorkItems(sortedItems);
      } else {
        setConfirmModal({
          isOpen: true, title: '작업 취소 실패',
          message: `작업취소 실패: ${result.message}`,
          type: 'error', showCancel: false,
          onConfirm: () => {},
        });
      }
    } catch (error: any) {
      console.error('작업취소 오류:', error);

      // NetworkError인 경우 사용자 친화적인 메시지 사용
      const errorMessage = error instanceof NetworkError
        ? error.message
        : (error.message || '작업취소 중 오류가 발생했습니다.');

      setConfirmModal({
        isOpen: true, title: '작업 취소 오류',
        message: errorMessage,
        type: 'error', showCancel: false,
        onConfirm: () => {},
      });
    } finally {
      setIsLoading(false);
      setCancelTarget(null);
    }
  };

  // 망이관 실제 API 호출 (ConfirmModal onConfirm 콜백)
  // 레거시 동일구현: mowoDivA.xml btn_net_OnClick
  const executeNetworkTransfer = async (item: any) => {
    const rcptId = item.RCPT_ID;
    if (!rcptId) {
      if (showToast) showToast('접수정보번호가 없습니다.', 'error');
      return;
    }

    let soYn = '';
    let deptCd = '';
    let loginUserId = userId || '';
    let loginUserName = '';
    try {
      const stored = localStorage.getItem('userInfo');
      if (stored) {
        const parsed = JSON.parse(stored);
        soYn = parsed.soYn || '';
        deptCd = parsed.deptCd || '';
        loginUserId = loginUserId || parsed.userId || '';
        loginUserName = parsed.userName || '';
      }
    } catch (e) {
      console.error('userInfo parse error:', e);
    }

    // PROC_CT: 레거시 동일 - "전송망 통보(날짜)\n처리자: 이름(ID)" (mowoDivA.xml:347)
    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const procCt = `전송망 통보(${todayStr}) \n처리자 : ${loginUserName}(${loginUserId})`;

    const params: any = {
      RCPT_ID: rcptId,
      PROC_CT: procCt,
      PROC_PSN_ID: loginUserId,
      USER_ID: 'FMS',  // 레거시 동일: 하드코딩 "FMS"
      CTRT_ID: item.CTRT_ID || '',
      WRK_ID: item.WRK_ID || item.id || '',
      KKO_MSG_ID: 'KKO087_001',  // 레거시 동일: 카카오 메시지 ID
    };

    if (soYn === 'Y') {
      params.SO_ID = item.SO_ID || '';
      params.DEPT_CD = deptCd;
    } else {
      params.CRR_ID = item.CRR_ID || '';
    }

    const mobilePrefixes = ['010', '011', '016', '017', '018', '019'];
    let telNo = '';
    const workReqTel = item.WORK_REQ_TEL_NO || '';
    const custTel2 = item.CUST_TEL_NO2 || '';
    const custTel1 = item.CUST_TEL_NO1 || '';

    if (workReqTel && mobilePrefixes.some(p => workReqTel.startsWith(p))) {
      telNo = workReqTel;
    } else if (custTel2 && mobilePrefixes.some(p => custTel2.startsWith(p))) {
      telNo = custTel2;
    } else if (custTel1 && mobilePrefixes.some(p => custTel1.startsWith(p))) {
      telNo = custTel1;
    }
    params.TEL_NO = telNo;

    try {
      const result = await insertRcptProcInfo(params);
      if (result.code === 'SUCCESS') {
        if (showToast) showToast('작업처리정보 저장되었습니다.', 'success');
        // 레거시 동일: 성공 후 FMS_AS_WRK_STAT_CD 로컬 갱신 (중복 방지)
        if (item.SO_ID !== '403') {
          setWorkItems(prev => prev.map(w =>
            (w.WRK_ID || w.id) === (item.WRK_ID || item.id)
              ? { ...w, FMS_AS_WRK_STAT_CD: '2' }
              : w
          ));
        }
      } else {
        setConfirmModal({
          isOpen: true, title: '망이관 실패',
          message: result.message || '망이관 처리에 실패했습니다.',
          type: 'error', showCancel: false,
          onConfirm: () => {},
        });
      }
    } catch (error: any) {
      console.error('망이관 API 오류:', error);
      setConfirmModal({
        isOpen: true, title: '망이관 오류',
        message: '망이관 처리 중 오류가 발생했습니다.',
        type: 'error', showCancel: false,
        onConfirm: () => {},
      });
    }
  };

  // 망이관 버튼 핸들러 (A/S WRK_CD='03' only) - 레거시 mowoDivA.xml btn_net_OnClick 동일 구현
  const handleNetworkTransfer = (item: any) => {
    console.log('망이관 버튼 클릭:', item);

    // 1. 할당된 작업만 처리 가능
    if (item.WRK_STAT_CD !== '2') {
      setConfirmModal({
        isOpen: true, title: '처리 불가',
        message: '할당된 작업만 처리 가능합니다.',
        type: 'warning', showCancel: false,
        onConfirm: () => {},
      });
      return;
    }

    // 2. 이미 망관리 이관 체크
    if (item.FMS_AS_WRK_STAT_CD && String(item.FMS_AS_WRK_STAT_CD).length > 0 && item.SO_ID !== '403') {
      setConfirmModal({
        isOpen: true, title: '전송망이관',
        message: `이미 전송망 이관되었습니다.\n\n1. 모바일CONA 의뢰서ID와 MOST계측작업ID 일치여부 확인(10자리)\n2. FMS MOST 신규이관 등록 후 MOST AS처리결과 등록 (완료)\n\n[의뢰서 ID: ${item.WRK_DRCTN_ID}]`,
        type: 'warning', showCancel: false,
        onConfirm: () => {},
      });
      return;
    }

    // 3. LGU+ 상품(LGCT001)이면 NetworkTransferModal, 아니면 기존 ConfirmModal
    const isUplsProd = uplsProdCodes.includes(item.PROD_CD);
    if (isUplsProd) {
      setNetworkTransferTarget(item);
      setShowNetworkTransferModal(true);
    } else {
      setConfirmModal({
        isOpen: true,
        title: '망이관',
        message: `전송망통보로 처리내용에 등록하시겠습니까?\n\n[확인] 버튼을 누른 후 모바일 CONA 의뢰서ID와 MOST 계측작업ID 확인(10자리) 후 MOST앱에서 이관 등록 바랍니다.\n\n[의뢰서 ID: ${item.WRK_DRCTN_ID}]`,
        type: 'confirm',
        onConfirm: () => executeNetworkTransfer(item),
      });
    }
  };

  // 장비상태정보 버튼 핸들러 (A/S WRK_CD='03' only, PROD_GRP='V' 제외, 인증상품 제외)
  const handleEquipmentStatus = (item: any) => {
    console.log('장비상태정보 버튼 클릭:', item);
    // Legacy condition: PROD_GRP='V' blocks
    if (item.PROD_GRP === 'V') {
      setConfirmModal({
        isOpen: true, title: '지원 불가',
        message: 'VoIP 서비스를 지원하지 않습니다.',
        type: 'warning', showCancel: false,
        onConfirm: () => {},
      });
      return;
    }
    // FTTH 인증상품(IS_CERTIFY_PROD=1) OR LGU+(LGCT001) → 장비상태 지원 불가
    const isCertifyProd = item.IS_CERTIFY_PROD == 1 || item.IS_CERTIFY_PROD == '1';
    const isUpls = uplsProdCodes.includes(item.PROD_CD) || !!uplsProdMap[item.PROD_CD];
    if (isCertifyProd || isUpls) {
      setConfirmModal({
        isOpen: true, title: '지원 불가',
        message: 'LGU+/FTTH 상품은 장비상태 조회를 지원하지 않습니다.',
        type: 'warning', showCancel: false,
        onConfirm: () => {},
      });
      return;
    }
    setEquipmentStatusTarget(item);
    setShowEquipmentStatusModal(true);
  };

  // 작업 상세 화면들은 이제 App.tsx에서 처리됨

  return (
    <div className="h-[calc(100dvh-64px)] flex flex-col bg-gray-50 overflow-hidden">
      {/* 작업 정보 헤더 - 고정 */}
      <div className="flex-shrink-0 bg-gradient-to-r from-primary-500 to-primary-500 px-4 py-3 shadow-md z-40">
        <div className="flex items-center justify-between gap-3">
          {/* 왼쪽: 고객명 + 고객ID + 작업유형 */}
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white truncate">
                  {workItems[0]?.CUST_NM || direction.customer.name}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-white/20 text-white border border-white/30 flex-shrink-0">
                  {direction.typeDisplay}
                </span>
              </div>
              {direction.customer.id && (
                <p className="text-xs text-white/70 mt-0.5 truncate">
                  고객ID: {direction.customer.id.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')}
                </p>
              )}
            </div>
          </div>
          {/* 오른쪽: VIP뱃지 + 재약정 + 일정 */}
          <div className="flex items-center gap-2 text-white/90 flex-shrink-0">
            <VipBadge customer={direction.customer} />
            {isRecontract && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-300 flex-shrink-0">
                재약정
              </span>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-xs font-medium">
              {formatDateTimeFromISO(direction.scheduledAt)}
            </span>
          </div>
        </div>
        {/* 주소 - 클릭 시 길찾기 */}
        <button
          className="flex items-center gap-2 mt-1.5 bg-white/15 active:bg-white/30 cursor-pointer rounded-lg px-2.5 py-1.5 transition-colors w-full text-left min-h-[36px] border border-white/20"
          onClick={async (e) => {
            e.stopPropagation();
            const address = direction.customer.address;
            if (!address || navLoading) return;
            setNavLoading(true);
            try {
              const ok = await geocodeAndNavigate(address, preferredNavApp);
              if (!ok) {
                setConfirmModal({ isOpen: true, title: '길찾기 실패', message: '주소를 찾을 수 없습니다.\n주소를 확인해 주세요.', type: 'warning', showCancel: false, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
              }
            } catch {
              setConfirmModal({ isOpen: true, title: '길찾기 오류', message: '길찾기 앱 실행에 실패했습니다.', type: 'error', showCancel: false, onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })) });
            } finally {
              setNavLoading(false);
            }
          }}
        >
          <svg className="w-3.5 h-3.5 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs text-white truncate flex-1 underline underline-offset-2 decoration-white/50">{direction.customer.address}</span>
          <span className="flex-shrink-0 bg-white/25 rounded px-1.5 py-0.5 text-[0.6rem] font-bold text-white">길찾기</span>
        </button>
      </div>

      {/* 작업 목록 - 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <LoadingSpinner size="medium" message="작업 목록을 불러오는 중..." />
        ) : error ? (
          <ErrorMessage
            type="error"
            message={error}
            onRetry={() => window.location.reload()}
          />
        ) : workItems.length === 0 ? (
          <div className="text-center py-10 sm:py-12 px-4 sm:px-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
            </div>
            <h4 className="text-sm sm:text-base font-bold text-gray-900 mb-2 whitespace-nowrap">기간내에 작업이 없습니다</h4>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {workItems.map((item, index) => (
              <WorkItemCard
                key={item.WRK_ID || item.id || index}
                item={item}
                index={index + 1}
                onSelect={handleSelectItem}
                onComplete={handleCompleteWork}
                onCancel={handleCancelWork}
                onNetworkTransfer={handleNetworkTransfer}
                onEquipmentStatus={handleEquipmentStatus}
                uplsProdCodes={uplsProdCodes}
                uplsProdMap={uplsProdMap}
              />
            ))}
          </div>
        )}
      </div>

      {/* 작업취소 모달 */}
      {cancelTarget && (
        <WorkCancelModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancelConfirm}
          workOrder={cancelTarget}
          userId={userId}
          showToast={showToast}
        />
      )}

      {/* 장비상태정보 모달 (A/S only) */}
      {equipmentStatusTarget && (
        <EquipmentStatusModal
          isOpen={showEquipmentStatusModal}
          onClose={() => { setShowEquipmentStatusModal(false); setEquipmentStatusTarget(null); }}
          item={equipmentStatusTarget}
          userId={userId}
          showToast={showToast}
        />
      )}

      {/* LGU+ 망이관 모달 */}
      {networkTransferTarget && (
        <NetworkTransferModal
          isOpen={showNetworkTransferModal}
          onClose={() => { setShowNetworkTransferModal(false); setNetworkTransferTarget(null); }}
          item={networkTransferTarget}
          userId={userId}
          showToast={showToast}
        />
      )}

      {/* 확인 모달 (망이관, 에러/경고 알림 등) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        showCancel={confirmModal.showCancel}
      />
    </div>
  );
};

export default WorkItemList;
