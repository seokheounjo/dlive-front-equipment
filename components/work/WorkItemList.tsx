import React, { useState, useEffect } from 'react';
import { WorkDirection, WorkItem, WorkOrderStatus } from '../../types';
import WorkItemCard from '../work/WorkItemCard';
import WorkOrderDetail from '../work/WorkOrderDetail';
import WorkCompletionResult from '../work/WorkCompletionResult';
import WorkCancelModal from '../work/WorkCancelModal';
import { cancelWork, getWorkReceipts, NetworkError } from '../../services/apiService';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import VipBadge from '../common/VipBadge';
import { ClipboardList } from 'lucide-react';
import { useWorkProcessStore } from '../../stores/workProcessStore';
import { useCertifyStore } from '../../stores/certifyStore';
import { useWorkEquipmentStore } from '../../stores/workEquipmentStore';
import { formatDateTimeFromISO } from '../../utils/dateFormatter';

interface WorkItemListProps {
  direction: WorkDirection;  // 작업지시서 (부모)
  onBack: () => void;
  onNavigateToView?: (view: string, data?: any) => void;
  userId?: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const WorkItemList: React.FC<WorkItemListProps> = ({ direction, onBack, onNavigateToView, userId, showToast }) => {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);  // 개별 작업 목록
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [showCompleteDetail, setShowCompleteDetail] = useState<WorkItem | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<WorkItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      PROD_NM: item.PROD_NM
    });

    // 이전 작업의 draft 삭제 (다른 작업 선택 시)
    const newWorkId = item.WRK_ID || item.id;
    clearPreviousWorkDraft(newWorkId);
    useCertifyStore.getState().reset(); // certify 상태도 초기화

    // 장비 스토어 초기화 (다른 작업 전환 시 이전 장비 데이터 삭제)
    clearAllWorkStates();

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
      RCPT_ID: item.RCPT_ID,            // 접수 ID
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
      IS_CERTIFY_PROD: item.IS_CERTIFY_PROD, // FTTH 단말인증 대상 (1이면 집선등록 필요)
      OP_LNKD_CD: item.OP_LNKD_CD,      // 통신방식 코드 (F/FG/Z/ZG=FTTH) - 레거시 OpLnkdCd
      VOIP_PROD_CD: item.VOIP_PROD_CD,  // VoIP 상품코드 (결합계약 조건 판단용)
      ISP_PROD_CD: item.ISP_PROD_CD,    // ISP 상품코드 (결합계약 조건 판단용)

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

    // 이전 작업의 draft 삭제 (다른 작업 선택 시)
    const newWorkId = item.WRK_ID || item.id;
    clearPreviousWorkDraft(newWorkId);
    useCertifyStore.getState().reset(); // certify 상태도 초기화

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
      RCPT_ID: item.RCPT_ID,            // 접수 ID
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
      IS_CERTIFY_PROD: item.IS_CERTIFY_PROD, // FTTH 단말인증 대상 (1이면 집선등록 필요)
      OP_LNKD_CD: item.OP_LNKD_CD,      // 통신방식 코드 (F/FG/Z/ZG=FTTH) - 레거시 OpLnkdCd
      VOIP_PROD_CD: item.VOIP_PROD_CD,  // VoIP 상품코드 (결합계약 조건 판단용)
      ISP_PROD_CD: item.ISP_PROD_CD,    // ISP 상품코드 (결합계약 조건 판단용)

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

  const handleCancelWork = (item: any) => {
    console.log('취소 버튼 클릭 - 원본 데이터:', item);

    // 이전철거(08) 취소 블로킹: 같은 CTRT_ID의 이전설치(07)가 완료 상태이면 취소 불가
    if (item.WRK_CD === '08') {
      const siblingInstall = workItems.find(
        (w: any) => w.WRK_CD === '07'
          && w.CTRT_ID === item.CTRT_ID
          && (w.WRK_STAT_CD === '4' || w.WRK_STAT_CD === '7')
      );
      if (siblingInstall) {
        if (showToast) {
          showToast('이전설치가 완료된 상태이므로 이전철거를 취소할 수 없습니다.', 'error');
        }
        return;
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
        if (showToast) showToast(`작업취소 실패: ${result.message}`, 'error', true);
      }
    } catch (error: any) {
      console.error('작업취소 오류:', error);

      // NetworkError인 경우 사용자 친화적인 메시지 사용
      const errorMessage = error instanceof NetworkError
        ? error.message
        : (error.message || '작업취소 중 오류가 발생했습니다.');

      if (showToast) showToast(errorMessage, 'error', true);
    } finally {
      setIsLoading(false);
      setCancelTarget(null);
    }
  };

  // 작업 상세 화면들은 이제 App.tsx에서 처리됨

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50 overflow-hidden">
      {/* 작업 정보 헤더 - 고정 */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 shadow-md z-40">
        <div className="flex items-center justify-between gap-3">
          {/* 왼쪽: 고객명 + 작업유형 */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              {workItems[0]?.CUST_NM || direction.customer.name}
              {direction.customer.id && (
                <span className="font-normal ml-1">({direction.customer.id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')})</span>
              )}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-white/20 text-white border border-white/30 flex-shrink-0">
              {direction.typeDisplay}
            </span>
          </div>
          {/* 오른쪽: VIP뱃지 + 일정 */}
          <div className="flex items-center gap-2 text-white/90 flex-shrink-0">
            <VipBadge customer={direction.customer} />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-xs font-medium">
              {formatDateTimeFromISO(direction.scheduledAt)}
            </span>
          </div>
        </div>
        {/* 주소 - 한 줄로 */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <svg className="w-3.5 h-3.5 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs text-white/80 truncate">{direction.customer.address}</span>
        </div>
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
    </div>
  );
};

export default WorkItemList;
