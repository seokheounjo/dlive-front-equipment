import React, { useEffect, useState } from 'react';
import {
  getMVRemoveEqtInfo,
  getEqtSoMoveInfo,
  getTechnicianEquipments,
  excuteSoMoveEqtChg,
  custEqtInfoDel,
  checkStbServerConnection,
  RemovalEquipmentInfo,
  EqtSoMoveInfo,
} from '../../../../services/apiService';
import ConfirmModal from '../../../common/ConfirmModal';

// 분실 상태 타입
interface LossStatus {
  EQT_LOSS_YN?: string;      // 장비분실
  PART_LOSS_BRK_YN?: string; // 아답터분실
  EQT_BRK_YN?: string;       // 리모콘분실
  EQT_CABL_LOSS_YN?: string; // 케이블분실
  EQT_CRDL_LOSS_YN?: string; // 크래들분실
}

// 장비별 분실 상태
type EquipmentLossStatus = Record<string, LossStatus>;

// removedEquipments에서 전달받는 장비 정보 타입 (EQT_NO 포함)
interface RemovedEquipmentData {
  EQT_NO?: string;
  EQT_SERNO?: string;
  EQT_CL_CD?: string;
  EQT_CL?: string;
  EQT_CL_NM?: string;       // 장비모델명
  ITEM_MID_CD?: string;
  ITEM_MID_NM?: string;     // 장비유형명
  MAC_ADDRESS?: string;     // MAC 주소
  SVC_CMPS_ID?: string;
  BASIC_PROD_CMPS_ID?: string;
  LENT_YN?: string;
  LENT_YN_NM?: string;      // 임대/매각 표시명
  VOIP_CUSTOWN_EQT?: string;
}

// LENT_YN 코드 -> 표시명 변환
const getLentYnName = (lentYn?: string): string => {
  switch (lentYn) {
    case '10': return '임대';
    case '20': return '매각';
    case '40': return '고객소유';
    default: return lentYn || '-';
  }
};

// 분실 상태 저장 데이터 타입 (작업완료 시 사용)
export interface LossStatusData {
  EQT_NO: string;
  EQT_SERNO: string;
  EQT_CL_CD: string;
  EQT_CL: string;
  EQT_CL_NM: string;
  ITEM_MID_CD: string;
  SVC_CMPS_ID: string;
  BASIC_PROD_CMPS_ID: string;
  LENT_YN: string;
  EQT_LOSS_YN: string;
  PART_LOSS_BRK_YN: string;
  EQT_BRK_YN: string;
  EQT_CABL_LOSS_YN: string;
  EQT_CRDL_LOSS_YN: string;
}

interface EquipmentMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 부모 컴포넌트에서 전달받는 removedEquipments (EQT_NO 포함)
  removedEquipmentsData?: RemovedEquipmentData[];
  custId: string;
  rcptId: string;
  wrkId: string;
  ctrtId: string;
  mstSoId?: string;
  soId?: string;
  crrId?: string;
  wrkrId?: string;
  chgUid?: string;
  wrkCd?: string; // 작업코드 (07=이전설치, 05=상품변경 등)
  hideTransfer?: boolean; // true면 이관 기능 숨기고 분실처리만 가능
  deferLossProcessing?: boolean; // true면 분실처리 API 호출하지 않고 상태만 저장 (작업완료 시 호출)
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSuccess?: (transferredSerials: string[]) => void; // Called when equipment transfer succeeds - passes list of transferred equipment serial numbers
  onSaveLossStatus?: (lossStatusList: LossStatusData[]) => void; // deferLossProcessing=true일 때 분실 상태 저장
}

/**
 * Equipment Move Modal
 * Transfers customer equipment to technician equipment for move work (WRK_CD=07)
 * Legacy: mowoa03p10.xml (cmwoa03p10)
 */
export const EquipmentMoveModal: React.FC<EquipmentMoveModalProps> = ({
  isOpen,
  onClose,
  removedEquipmentsData = [],
  custId,
  rcptId,
  wrkId,
  ctrtId,
  mstSoId = '',
  soId = '',
  crrId = '',
  wrkrId = '',
  chgUid = '',
  wrkCd = '07',
  hideTransfer = false,
  deferLossProcessing = false,
  showToast,
  onSuccess,
  onSaveLossStatus,
}) => {
  const [loading, setLoading] = useState(true); // 초기값 true: 모달 열릴 때 로딩 UI 먼저 표시
  const [processing, setProcessing] = useState(false);
  const [removalEquipments, setRemovalEquipments] = useState<RemovalEquipmentInfo[]>([]);
  const [moveResults, setMoveResults] = useState<EqtSoMoveInfo[]>([]);
  const [selectedEquipments, setSelectedEquipments] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // EQT_SERNO -> EQT_CL_NM mapping for display in results
  const [equipmentNameMap, setEquipmentNameMap] = useState<Map<string, string>>(new Map());
  // 분실 상태 (EQT_SERNO -> LossStatus)
  const [lossStatus, setLossStatus] = useState<EquipmentLossStatus>({});
  // 내부에서 조회한 removedEquipments (EQT_NO 포함)
  const [internalRemovedData, setInternalRemovedData] = useState<RemovedEquipmentData[]>([]);
  // 데이터 로드 완료 여부
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 모달이 열릴 때 상태 초기화 및 데이터 로드
  useEffect(() => {
    if (isOpen && custId && rcptId) {
      // 모달 열릴 때 상태 초기화
      setLoading(true);
      setIsDataLoaded(false);
      setError(null);
      setRemovalEquipments([]);
      setMoveResults([]);
      setSelectedEquipments(new Set());
      setLossStatus({});
      loadData();
    }
  }, [isOpen, custId, rcptId, wrkId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load removal equipment list, move results, and technician equipments in parallel
      const [equipmentList, resultList, technicianData] = await Promise.all([
        getMVRemoveEqtInfo({ CUST_ID: custId, RCPT_ID: rcptId }),
        getEqtSoMoveInfo({ WRK_ID: wrkId }),
        getTechnicianEquipments({
          WRK_ID: wrkId,
          WRKR_ID: wrkrId,
          SO_ID: soId,
          CUST_ID: custId,
          CTRT_ID: ctrtId,
          RCPT_ID: rcptId,
        }),
      ]);

      setMoveResults(resultList);

      // getMVRemoveEqtInfo가 비어있으면 removedEquipmentsData (부모에서 전달) 사용 (상품변경 등)
      // API 응답에서도 ITEM_MID_CD 매핑 필요 (API는 ITEM_CD 반환, ITEM_MID_CD는 앞 4자리에서 추출)
      const finalEquipmentList = equipmentList.length > 0
        ? equipmentList.map((eq: any) => ({
            ...eq,
            // ITEM_CD에서 ITEM_MID_CD 추출 (예: "0902020154" -> "02")
            ITEM_MID_CD: eq.ITEM_MID_CD || (eq.ITEM_CD ? eq.ITEM_CD.substring(2, 4) : undefined),
          }))
        : removedEquipmentsData.map((eq: RemovedEquipmentData) => ({
            EQT_NO: eq.EQT_NO,
            EQT_SERNO: eq.EQT_SERNO,
            EQT_CL_CD: eq.EQT_CL_CD || eq.EQT_CL,
            EQT_CL: eq.EQT_CL || eq.EQT_CL_CD,
            EQT_CL_NM: eq.EQT_CL_NM || '',
            ITEM_MID_CD: eq.ITEM_MID_CD,
            ITEM_MID_NM: eq.ITEM_MID_NM || '',
            ITEM_NM: eq.ITEM_MID_NM || '',
            MAC_ADDRESS: eq.MAC_ADDRESS || '',
            SVC_CMPS_ID: eq.SVC_CMPS_ID,
            BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
            LENT_YN: eq.LENT_YN,
            LENT_YN_NM: eq.LENT_YN_NM || getLentYnName(eq.LENT_YN),
            VOIP_CUSTOWN_EQT: eq.VOIP_CUSTOWN_EQT,
          }));

      console.log('[장비이관] 최종 장비 목록:', finalEquipmentList.length, '건',
        equipmentList.length > 0 ? '(API 응답)' : '(부모 전달 데이터)');

      setRemovalEquipments(finalEquipmentList);

      // EQT_NO 등 정보 저장 (분실 처리용)
      if (finalEquipmentList && finalEquipmentList.length > 0) {
        // DEBUG: 원본 응답 확인
        console.log('[장비이관] 장비 데이터 (첫번째):', JSON.stringify(finalEquipmentList[0], null, 2));

        const removed: RemovedEquipmentData[] = finalEquipmentList.map((eq: any) => ({
          EQT_NO: eq.EQT_NO,
          EQT_SERNO: eq.EQT_SERNO,
          EQT_CL_CD: eq.EQT_CL_CD || eq.EQT_CL,
          EQT_CL: eq.EQT_CL || eq.EQT_CL_CD,
          ITEM_MID_CD: eq.ITEM_MID_CD,
          SVC_CMPS_ID: eq.SVC_CMPS_ID,
          BASIC_PROD_CMPS_ID: eq.BASIC_PROD_CMPS_ID,
          LENT_YN: eq.LENT_YN,
        }));
        setInternalRemovedData(removed);
        console.log('[장비이관] EQT_NO 로드:', removed.length, '건');

        // DEBUG: 각 장비의 EQT_NO, EQT_CL_CD 확인
        removed.forEach((r, i) => {
          console.log(`[장비이관] 장비${i+1}: EQT_SERNO=${r.EQT_SERNO}, EQT_NO=${r.EQT_NO}, EQT_CL_CD=${r.EQT_CL_CD}`);
        });
      }

      // Build EQT_SERNO -> EQT_CL_NM map from equipment list
      const nameMap = new Map<string, string>();
      finalEquipmentList.forEach((eq: any) => {
        if (eq.EQT_SERNO) {
          nameMap.set(eq.EQT_SERNO, eq.EQT_CL_NM || eq.ITEM_NM || '-');
        }
      });
      setEquipmentNameMap((prev) => new Map([...prev, ...nameMap]));

      // Check if no equipment found
      if (finalEquipmentList.length === 0) {
        setError('철거계약의 장비가 기철거 되었거나 사용중인 장비가 없습니다.');
      }
    } catch (err: any) {
      console.error('장비이관 데이터 로드 실패:', err);
      setError(err.message || '장비이관 정보 조회에 실패했습니다.');
    } finally {
      setLoading(false);
      // 데이터 로드 완료 후 약간의 지연으로 UI 깜빡임 방지
      requestAnimationFrame(() => {
        setIsDataLoaded(true);
      });
    }
  };

  const handleCheckboxChange = (eqtSerno: string) => {
    setSelectedEquipments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eqtSerno)) {
        newSet.delete(eqtSerno);
        // 선택 해제 시 분실 상태도 초기화
        setLossStatus(prevLoss => {
          const newLoss = { ...prevLoss };
          delete newLoss[eqtSerno];
          return newLoss;
        });
      } else {
        newSet.add(eqtSerno);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedEquipments.size === removalEquipments.length) {
      setSelectedEquipments(new Set());
      setLossStatus({}); // 전체 해제 시 분실 상태도 초기화
    } else {
      const allSernos = removalEquipments
        .filter((eq) => eq.EQT_SERNO)
        .map((eq) => eq.EQT_SERNO!);
      setSelectedEquipments(new Set(allSernos));
    }
  };

  // 분실 상태 토글 핸들러
  const handleLossStatusChange = (eqtSerno: string, field: keyof LossStatus) => {
    setLossStatus(prev => ({
      ...prev,
      [eqtSerno]: {
        ...prev[eqtSerno],
        [field]: prev[eqtSerno]?.[field] === '1' ? '0' : '1',
      },
    }));
  };

  // 장비에 분실 체크가 하나라도 있는지 확인
  const hasAnyLoss = (eqtSerno: string): boolean => {
    const status = lossStatus[eqtSerno];
    if (!status) return false;
    return (
      status.EQT_LOSS_YN === '1' ||
      status.PART_LOSS_BRK_YN === '1' ||
      status.EQT_BRK_YN === '1' ||
      status.EQT_CABL_LOSS_YN === '1' ||
      status.EQT_CRDL_LOSS_YN === '1'
    );
  };

  const handleExecuteMove = () => {
    if (selectedEquipments.size === 0) {
      showToast?.('선택된 장비가 없습니다.', 'error');
      return;
    }

    // hideTransfer=true (분실처리 전용)일 때는 분실 체크 필수
    if (hideTransfer) {
      const equipmentsWithoutLoss: string[] = [];
      selectedEquipments.forEach((serno) => {
        if (!hasAnyLoss(serno)) {
          equipmentsWithoutLoss.push(serno);
        }
      });

      if (equipmentsWithoutLoss.length > 0) {
        showToast?.('분실 유형(장비분실, 아답터분실 등)을 선택해주세요.', 'error');
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleConfirmExecuteMove = async () => {
    setShowConfirmModal(false);
    setProcessing(true);

    try {
      // deferLossProcessing=true: API 호출 대신 분실 상태만 저장하고 모달 닫기
      if (deferLossProcessing && onSaveLossStatus) {
        const lossStatusList: LossStatusData[] = [];

        for (const eqtSerno of selectedEquipments) {
          const eq = removalEquipments.find((e) => e.EQT_SERNO === eqtSerno);
          const eqLossStatus = lossStatus[eqtSerno] || {};

          if (eq) {
            const eqData = internalRemovedData.find(r => r.EQT_SERNO === eqtSerno)
              || removedEquipmentsData.find(r => r.EQT_SERNO === eqtSerno);

            lossStatusList.push({
              EQT_NO: eqData?.EQT_NO || eq.EQT_NO || '',
              EQT_SERNO: eqtSerno,
              EQT_CL_CD: eqData?.EQT_CL_CD || eqData?.EQT_CL || (eq as any).EQT_CL_CD || (eq as any).EQT_CL || '',
              EQT_CL: eqData?.EQT_CL || eqData?.EQT_CL_CD || (eq as any).EQT_CL || (eq as any).EQT_CL_CD || '',
              EQT_CL_NM: eqData?.EQT_CL_NM || (eq as any).EQT_CL_NM || '',
              ITEM_MID_CD: eqData?.ITEM_MID_CD || eq.ITEM_MID_CD || '',
              SVC_CMPS_ID: eqData?.SVC_CMPS_ID || eq.SVC_CMPS_ID || '',
              BASIC_PROD_CMPS_ID: eqData?.BASIC_PROD_CMPS_ID || eq.BASIC_PROD_CMPS_ID || '',
              LENT_YN: eqData?.LENT_YN || eq.LENT_YN || '',
              EQT_LOSS_YN: eqLossStatus.EQT_LOSS_YN || '0',
              PART_LOSS_BRK_YN: eqLossStatus.PART_LOSS_BRK_YN || '0',
              EQT_BRK_YN: eqLossStatus.EQT_BRK_YN || '0',
              EQT_CABL_LOSS_YN: eqLossStatus.EQT_CABL_LOSS_YN || '0',
              EQT_CRDL_LOSS_YN: eqLossStatus.EQT_CRDL_LOSS_YN || '0',
            });
          }
        }

        console.log('[EquipmentMoveModal] 분실 상태 저장 (작업완료 시 처리):', lossStatusList);
        onSaveLossStatus(lossStatusList);
        showToast?.(`분실 상태가 저장되었습니다. (${lossStatusList.length}건)`, 'success');
        setSelectedEquipments(new Set());
        setLossStatus({});
        onClose();
        return;
      }

      // Save equipment names before moving (for result display)
      const newNameMap = new Map(equipmentNameMap);
      selectedEquipments.forEach((serno) => {
        const eq = removalEquipments.find((e) => e.EQT_SERNO === serno);
        if (eq && eq.EQT_SERNO) {
          newNameMap.set(eq.EQT_SERNO, eq.EQT_CL_NM || eq.ITEM_NM || '-');
        }
      });
      setEquipmentNameMap(newNameMap);

      let successCount = 0;
      let failCount = 0;
      let lossSuccessCount = 0;
      let lossFailCount = 0;
      const chargedEquipments: string[] = [];
      const successfulSerials: string[] = []; // Track successfully transferred equipment serials

      // Execute move for each selected equipment
      for (const eqtSerno of selectedEquipments) {
        const eq = removalEquipments.find((e) => e.EQT_SERNO === eqtSerno);
        const eqLossStatus = lossStatus[eqtSerno] || {};
        const hasLoss = hasAnyLoss(eqtSerno);

        // 분실 체크가 있는 경우: 분실 처리 API 호출
        if (hasLoss && eq) {
          console.log(`[장비이관] 분실 처리 - ${eqtSerno}`, eqLossStatus);

          // internalRemovedData 또는 removedEquipmentsData에서 EQT_NO 등 필수 정보 가져오기
          const eqData = internalRemovedData.find(r => r.EQT_SERNO === eqtSerno)
            || removedEquipmentsData.find(r => r.EQT_SERNO === eqtSerno);

          // DEBUG: eqData 확인
          console.log(`[장비이관] eqData 조회:`, eqData);
          console.log(`[장비이관] eq 원본:`, { EQT_NO: eq.EQT_NO, EQT_CL_CD: (eq as any).EQT_CL_CD, EQT_CL: (eq as any).EQT_CL });

          const eqtNo = eqData?.EQT_NO || eq.EQT_NO || '';
          const itemMidCd = eqData?.ITEM_MID_CD || eq.ITEM_MID_CD || '';
          const eqtClCd = eqData?.EQT_CL_CD || eqData?.EQT_CL || (eq as any).EQT_CL_CD || (eq as any).EQT_CL || '';
          // EQT_CL_NM: API fallback용 - getMVRemoveEqtInfo에서 반환 (예: "STB-HD")
          const eqtClNm = eqData?.EQT_CL_NM || (eq as any).EQT_CL_NM || '';
          const svcCmpsId = eqData?.SVC_CMPS_ID || eq.SVC_CMPS_ID || '';
          const basicProdCmpsId = eqData?.BASIC_PROD_CMPS_ID || eq.BASIC_PROD_CMPS_ID || '';
          const lentYn = eqData?.LENT_YN || eq.LENT_YN || '';

          // DEBUG: 최종 사용 값 확인
          console.log(`[장비이관] 최종값: EQT_NO=${eqtNo}, EQT_CL_CD=${eqtClCd}, EQT_CL_NM=${eqtClNm}`);

          if (!eqtNo) {
            console.error(`[장비이관] EQT_NO 없음 - ${eqtSerno}`);
            lossFailCount++;
            continue;
          }

          // EQT_CL_CD가 비어있으면 경고
          if (!eqtClCd) {
            console.error(`[장비이관] EQT_CL_CD 없음 - ${eqtSerno}, API가 EQT_CL_CD를 반환하지 않음`);
          }

          const lossResult = await custEqtInfoDel({
            WRK_ID: wrkId,
            CUST_ID: custId,
            CTRT_ID: ctrtId,
            MST_SO_ID: mstSoId,
            SO_ID: soId,
            EQT_NO: eqtNo,
            ITEM_MID_CD: itemMidCd,
            EQT_CL_CD: eqtClCd,
            EQT_CL: eqtClCd,
            EQT_CL_NM: eqtClNm, // Fallback: API uses this to lookup EQT_CL_CD from TCMEP_EQT_CL
            REG_UID: chgUid,
            WRK_CD: wrkCd, // 작업코드 (07=이전설치, 05=상품변경 등)
            CRR_ID: crrId,
            WRKR_ID: wrkrId,
            RCPT_ID: rcptId,
            SVC_CMPS_ID: svcCmpsId,
            BASIC_PROD_CMPS_ID: basicProdCmpsId,
            OLD_LENT_YN: lentYn,
            EQT_CHG_GB: '02', // 철거
            REUSE_YN: '0',
            // 분실 상태
            EQT_LOSS_YN: eqLossStatus.EQT_LOSS_YN || '0',
            PART_LOSS_BRK_YN: eqLossStatus.PART_LOSS_BRK_YN || '0',
            EQT_BRK_YN: eqLossStatus.EQT_BRK_YN || '0',
            EQT_CABL_LOSS_YN: eqLossStatus.EQT_CABL_LOSS_YN || '0',
            EQT_CRDL_LOSS_YN: eqLossStatus.EQT_CRDL_LOSS_YN || '0',
          });

          if (lossResult?.MSGCODE === 'SUCCESS') {
            lossSuccessCount++;
            successfulSerials.push(eqtSerno);

            // 철거 신호(SMR05) 호출 - 레거시 mowoa03m03.xml fn_delsignal_trans 동일
            try {
              console.log(`[장비이관] 철거 신호(SMR05) 호출 - EQT_NO: ${eqtNo}`);
              await checkStbServerConnection(
                chgUid || wrkrId || '',
                ctrtId,
                wrkId,
                'SMR05',  // 철거 신호
                eqtNo,
                ''
              );
              console.log(`[장비이관] 철거 신호(SMR05) 호출 완료`);
            } catch (signalError) {
              // 신호 실패해도 분실 처리는 이미 성공했으므로 계속 진행 (레거시 동일)
              console.log(`[장비이관] 철거 신호(SMR05) 실패 (무시):`, signalError);
            }
          } else {
            lossFailCount++;
            console.error(`[장비이관] 분실 처리 실패 - ${eqtSerno}:`, lossResult?.MESSAGE);
          }
        } else {
          // 분실 체크가 없는 경우: 이관 API 호출 (hideTransfer면 건너뜀)
          if (hideTransfer) {
            // 상품변경 등에서는 이관 기능 비활성화 - 분실 체크 없으면 처리하지 않음
            console.log(`[장비이관] hideTransfer=true, 분실체크 없음 - ${eqtSerno} 건너뜀`);
            continue;
          }

          const result = await excuteSoMoveEqtChg({
            MST_SO_ID: mstSoId,
            SO_ID: soId,
            CUST_ID: custId,
            CTRT_ID: ctrtId,
            RCPT_ID: rcptId,
            WRK_ID: wrkId,
            WRK_CD: wrkCd, // 작업코드 (07=이전설치, 05=상품변경 등)
            CRR_ID: crrId,
            WRKR_ID: wrkrId,
            EQT_SERNO: eqtSerno,
            CHG_UID: chgUid,
          });

          if (result?.MSGCODE === 'SUCCESS') {
            successCount++;
            successfulSerials.push(eqtSerno);
          } else if (result?.MSGCODE === 'CHARGE') {
            chargedEquipments.push(eqtSerno);
          } else {
            failCount++;
          }
        }
      }

      // Reload data to update both equipment list and results
      await loadData();
      setSelectedEquipments(new Set());
      setLossStatus({}); // 분실 상태 초기화

      // Show result message
      const totalSuccess = successCount + lossSuccessCount;
      const totalFail = failCount + lossFailCount;

      if (chargedEquipments.length > 0) {
        showToast?.(
          `장비 [${chargedEquipments.join(', ')}] 장비분실비가 청구완료된 장비입니다.`,
          'error'
        );
      } else if (totalFail > 0) {
        let msg = `처리 완료 (이관: ${successCount}, 분실처리: ${lossSuccessCount}, 실패: ${totalFail})`;
        showToast?.(msg, 'warning');
      } else if (lossSuccessCount > 0 && successCount > 0) {
        showToast?.(`이관 ${successCount}건, 분실처리 ${lossSuccessCount}건 완료`, 'success');
      } else if (lossSuccessCount > 0) {
        showToast?.(`분실처리 ${lossSuccessCount}건 완료`, 'success');
      } else {
        showToast?.('장비이관이 성공적으로 처리되었습니다.', 'success');
      }

      // Trigger equipment data refresh if any transfer succeeded, passing the list of transferred serials
      if (totalSuccess > 0) {
        onSuccess?.(successfulSerials);
      }
    } catch (err: any) {
      console.error('장비이관 실행 실패:', err);
      showToast?.(err.message || '장비이관 실행에 실패했습니다.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Check if equipment was already moved successfully
  const isEquipmentMoved = (eqtSerno: string): boolean => {
    return moveResults.some(
      (r) => r.EQT_SERNO === eqtSerno && r.SUCCESS_GUBN === 'SUCCESS'
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-purple-600 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold">{hideTransfer ? '철거장비' : '철거장비를 기사장비로 이관'}</h2>
          <button
            onClick={onClose}
            disabled={processing}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1">
          {loading || !isDataLoaded ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600">장비 정보 조회 중...</span>
            </div>
          ) : error && removalEquipments.length === 0 && moveResults.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-2">{error}</div>
              <button
                onClick={() => {
                  setIsDataLoaded(false);
                  loadData();
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Equipment List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">철거장비 목록</h3>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    {selectedEquipments.size === removalEquipments.length ? '전체해제' : '전체선택'}
                  </button>
                </div>

                {removalEquipments.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                    {moveResults.some(r => r.SUCCESS_GUBN === 'SUCCESS')
                      ? '모든 장비가 이관 완료되었습니다.'
                      : '이관할 수 있는 장비가 없습니다.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {removalEquipments.map((eq, index) => {
                      const eqtSerno = eq.EQT_SERNO || '';
                      const isMoved = eqtSerno ? isEquipmentMoved(eqtSerno) : false;
                      const isSelected = eqtSerno ? selectedEquipments.has(eqtSerno) : false;
                      const eqLossStatus = lossStatus[eqtSerno] || {};
                      const hasLossChecked = hasAnyLoss(eqtSerno);

                      return (
                        <div
                          key={eq.EQT_SERNO || index}
                          className={`p-3 rounded-lg border ${
                            isMoved
                              ? 'bg-green-50 border-green-200'
                              : hasLossChecked
                              ? 'bg-orange-50 border-orange-300'
                              : isSelected
                              ? 'bg-purple-50 border-purple-300'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => eqtSerno && handleCheckboxChange(eqtSerno)}
                              disabled={isMoved || processing}
                              className="mt-1 w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 disabled:opacity-50"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{eq.EQT_CL_NM || eq.ITEM_NM || '장비'}</span>
                                {isMoved && (
                                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                    이관완료
                                  </span>
                                )}
                                {hasLossChecked && !isMoved && (
                                  <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                                    분실
                                  </span>
                                )}
                                {isSelected && !hasLossChecked && !isMoved && (
                                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                    재사용
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                <div>S/N: {eq.EQT_SERNO || '-'}</div>
                                <div className="flex gap-4 mt-1">
                                  <span>{eq.LENT_YN_NM || '-'}</span>
                                  <span>{eq.NOTRECEV || '-'}</span>
                                  <span>{eq.EQT_STAT_CD || '-'}</span>
                                </div>
                                {eq.MAC_ADDRESS && (
                                  <div className="text-xs text-gray-500 mt-1">MAC: {eq.MAC_ADDRESS}</div>
                                )}
                              </div>

                              {/* 분실/파손 체크박스 - 선택된 장비만 표시 */}
                              {isSelected && !isMoved && (
                                <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-gray-200">
                                  <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg active:bg-gray-100 whitespace-nowrap cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={eqLossStatus.EQT_LOSS_YN === '1'}
                                      onChange={() => handleLossStatusChange(eqtSerno, 'EQT_LOSS_YN')}
                                      disabled={processing}
                                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-xs text-gray-700 font-medium">장비분실</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg active:bg-gray-100 whitespace-nowrap cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={eqLossStatus.PART_LOSS_BRK_YN === '1'}
                                      onChange={() => handleLossStatusChange(eqtSerno, 'PART_LOSS_BRK_YN')}
                                      disabled={processing}
                                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-xs text-gray-700 font-medium">아답터분실</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg active:bg-gray-100 whitespace-nowrap cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={eqLossStatus.EQT_BRK_YN === '1'}
                                      onChange={() => handleLossStatusChange(eqtSerno, 'EQT_BRK_YN')}
                                      disabled={processing}
                                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-xs text-gray-700 font-medium">리모콘분실</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg active:bg-gray-100 whitespace-nowrap cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={eqLossStatus.EQT_CABL_LOSS_YN === '1'}
                                      onChange={() => handleLossStatusChange(eqtSerno, 'EQT_CABL_LOSS_YN')}
                                      disabled={processing}
                                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-xs text-gray-700 font-medium">케이블분실</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg active:bg-gray-100 whitespace-nowrap cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={eqLossStatus.EQT_CRDL_LOSS_YN === '1'}
                                      onChange={() => handleLossStatusChange(eqtSerno, 'EQT_CRDL_LOSS_YN')}
                                      disabled={processing}
                                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-xs text-gray-700 font-medium">크래들분실</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Move Results - 모바일 카드 형식 */}
              {moveResults.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">처리결과 리스트</h3>
                  <div className="max-h-48 overflow-auto space-y-2">
                    {moveResults.map((result, index) => (
                      <div
                        key={result.EQT_SERNO || index}
                        className={`p-3 rounded-lg border ${
                          result.SUCCESS_GUBN === 'SUCCESS'
                            ? 'bg-green-50 border-green-200'
                            : result.SUCCESS_GUBN === 'CHARGE'
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs text-gray-500 shrink-0">#{index + 1}</span>
                            <span className="font-medium text-gray-900 text-sm truncate">
                              {equipmentNameMap.get(result.EQT_SERNO || '') || result.EQT_CL_NM || result.ITEM_NM || '-'}
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-full whitespace-nowrap shrink-0 ${
                              result.SUCCESS_GUBN === 'SUCCESS'
                                ? 'bg-green-500 text-white'
                                : result.SUCCESS_GUBN === 'CHARGE'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-red-500 text-white'
                            }`}
                          >
                            {result.SUCCESS_GUBN === 'SUCCESS' ? '성공' : result.SUCCESS_GUBN === 'CHARGE' ? '청구' : result.SUCCESS_GUBN || '-'}
                          </span>
                        </div>
                        <div className="mt-1.5 text-xs text-gray-600 font-mono">
                          S/N: {result.EQT_SERNO || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 flex gap-2 flex-shrink-0">
          {/* hideTransfer=true (철거장비 모달)일 때는 분실처리 버튼 숨기고, 닫기 시 자동 저장 */}
          {!hideTransfer && (
            <button
              onClick={handleExecuteMove}
              disabled={processing || selectedEquipments.size === 0}
              className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm sm:text-base font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>처리 중...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <span>장비가져오기 ({selectedEquipments.size})</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={() => {
              // hideTransfer=true (철거장비 모달)일 때 닫기 시 자동 저장
              if (hideTransfer && deferLossProcessing && onSaveLossStatus && selectedEquipments.size > 0) {
                const lossStatusList: LossStatusData[] = [];
                for (const eqtSerno of selectedEquipments) {
                  const eq = removalEquipments.find((e) => e.EQT_SERNO === eqtSerno);
                  const eqLossStatus = lossStatus[eqtSerno] || {};
                  if (eq) {
                    const eqData = internalRemovedData.find(r => r.EQT_SERNO === eqtSerno)
                      || removedEquipmentsData.find(r => r.EQT_SERNO === eqtSerno);
                    lossStatusList.push({
                      EQT_NO: eqData?.EQT_NO || eq.EQT_NO || '',
                      EQT_SERNO: eqtSerno,
                      EQT_CL_CD: eqData?.EQT_CL_CD || eqData?.EQT_CL || (eq as any).EQT_CL_CD || (eq as any).EQT_CL || '',
                      EQT_CL: eqData?.EQT_CL || eqData?.EQT_CL_CD || (eq as any).EQT_CL || (eq as any).EQT_CL_CD || '',
                      EQT_CL_NM: eqData?.EQT_CL_NM || (eq as any).EQT_CL_NM || '',
                      ITEM_MID_CD: eqData?.ITEM_MID_CD || eq.ITEM_MID_CD || '',
                      SVC_CMPS_ID: eqData?.SVC_CMPS_ID || eq.SVC_CMPS_ID || '',
                      BASIC_PROD_CMPS_ID: eqData?.BASIC_PROD_CMPS_ID || eq.BASIC_PROD_CMPS_ID || '',
                      LENT_YN: eqData?.LENT_YN || eq.LENT_YN || '',
                      EQT_LOSS_YN: eqLossStatus.EQT_LOSS_YN || '0',
                      PART_LOSS_BRK_YN: eqLossStatus.PART_LOSS_BRK_YN || '0',
                      EQT_BRK_YN: eqLossStatus.EQT_BRK_YN || '0',
                      EQT_CABL_LOSS_YN: eqLossStatus.EQT_CABL_LOSS_YN || '0',
                      EQT_CRDL_LOSS_YN: eqLossStatus.EQT_CRDL_LOSS_YN || '0',
                    });
                  }
                }
                if (lossStatusList.length > 0) {
                  console.log('[EquipmentMoveModal] 닫기 시 자동 저장:', lossStatusList.length, '건');
                  onSaveLossStatus(lossStatusList);
                  showToast?.(`철거장비 ${lossStatusList.length}건이 저장되었습니다.`, 'success');
                }
              }
              onClose();
            }}
            disabled={processing}
            className={`${hideTransfer ? 'flex-1' : ''} px-3 sm:px-4 py-2 sm:py-2.5 ${
              hideTransfer
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            } rounded-lg text-sm sm:text-base font-semibold transition-colors disabled:opacity-50`}
          >
            {hideTransfer ? '확인' : '닫기'}
          </button>
        </div>
      </div>

      {/* 장비이관 확인 모달 (hideTransfer=false일 때만 사용) */}
      {!hideTransfer && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmExecuteMove}
          title="장비이관"
          message="장비이관을 실행하시겠습니까? 실행시 철거계약의 해지신호처리로 시간이 소요됩니다."
          type="confirm"
          confirmText="실행"
          cancelText="취소"
        />
      )}
    </div>
  );
};

export default EquipmentMoveModal;
