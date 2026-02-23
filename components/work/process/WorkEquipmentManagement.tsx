/**
 * 작업 프로세스 3단계 전용 장비관리 컴포넌트
 * - 작업 컨텍스트가 필요한 장비 할당
 * - 계약 장비 + 기사 재고 매핑
 * - 작업 완료를 위한 장비 정보 수집
 * - LGU+ 상품: 청약신청 + 포트현황조회 + LDAP 연동 (레거시 mowou03m01.xml)
 *
 * WRK_CD별로 분리된 컴포넌트를 EquipmentRouter가 라우팅
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CheckCircle, Loader2, FileText, Search, X, ChevronDown, Database } from 'lucide-react';
import Select from '../../ui/Select';
import { WorkItem, Equipment } from '../../../types';
import EquipmentRouter from './equipment';
import ConfirmModal from '../../common/ConfirmModal';
import { useWorkProcessStore } from '../../../stores/workProcessStore';
import { useWorkEquipmentStore } from '../../../stores/workEquipmentStore';
import { useCertifyStore } from '../../../stores/certifyStore';
import { useLdapConnect } from '../../../hooks/useLdapConnect';
import {
  getUplsCtrtInfo,
  uplsEntrBgnEstbChg,
  reqUplsHspdLdap,
  requestLGUNetworkFault,
  getUplsEqipInfo,
  getUplsEqipPortInfo,
  setUplsRqstConsReq,
} from '../../../services/certifyApiService';
import { getCommonCodeList, getCodeDetail, CommonCodeDetail } from '../../../services/apiService';

interface WorkEquipmentManagementProps {
  workItem: WorkItem;
  onSave: (data: EquipmentData) => void;
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  preloadedApiData?: any; // WorkProcessFlow에서 Pre-load한 데이터
  onPreloadedDataUpdate?: (newData: any) => void; // Pre-load 데이터 업데이트 콜백
  readOnly?: boolean; // 완료된 작업 - 읽기 전용 모드
  isCertifyProd?: boolean; // LGU+ 인증 상품 여부
  certifyOpLnkdCd?: string; // 통신방식 (F/FG/Z/ZG=FTTH, N/NG=와이드)
}

interface EquipmentData {
  installedEquipments: Equipment[];
  removedEquipments: Equipment[];
}

// 청약신청이 필요한 작업유형 (A/S, 철거는 제외)
const SUBSCRIPTION_WORK_TYPES = ['01', '05', '06', '07']; // 설치, 상품변경, 댁내이전, 이전설치

/**
 * 포트현황 팝업 모달 (레거시: mowou04p04.xml(광랜) / mowou04p05.xml(FTTH) 동일구현)
 * - 장비 선택 콤보 (cmb_lgu_Eqt_Nm) + 장비 상세 + 포트 그리드 (gd_line_eqt_port)
 * - API: getUplsEqipInfo + getUplsEqipPortInfo (CL-02 아님!)
 * - 그리드 컬럼: 포트(PORT_NO), U+가입번호(ENTR_NO), 계약호(CTRT_ID), 상태(PT_USE)
 */
const PortStatusModal: React.FC<{
  equipList: any[];
  portList: any[];
  isFtth: boolean;
  onEquipChange: (eqipId: string) => void;
  selectedEqipId: string;
  onClose: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  entrNo?: string;
  entrRqstNo?: string;
  workItem?: any;
}> = ({ equipList, portList, isFtth, onEquipChange, selectedEqipId, onClose, showToast, entrNo, entrRqstNo, workItem: parentWorkItem }) => {
  const selectedEquip = equipList.find(e => e.EQIP_ID === selectedEqipId);

  // 장비 선택 옵션 (커스텀 Select 컴포넌트용)
  const equipOptions = useMemo(() =>
    equipList.map((eq) => ({
      value: eq.EQIP_ID,
      label: `${eq.EQIP_ID} - ${eq.ESTB_PLC_NM || eq.EQIP_NM || ''}`,
    })),
    [equipList]
  );

  // L2 기준정보 상태 (광랜 전용, 레거시: mowou04p06)
  const [showL2Ref, setShowL2Ref] = useState(false);
  const [l2RefData, setL2RefData] = useState<CommonCodeDetail[]>([]);
  const [l2RefLoading, setL2RefLoading] = useState(false);

  // Port공사요청 상태 (레거시: mowou04p01/02/03)
  const [showConsReq, setShowConsReq] = useState(false);
  const [consReqReasonCodes, setConsReqReasonCodes] = useState<any[]>([]);
  const [consReqReason, setConsReqReason] = useState('');
  const [consReqDetail, setConsReqDetail] = useState('');
  const [consReqLoading, setConsReqLoading] = useState(false);

  // L2 기준정보 조회 (LGCT015)
  const handleOpenL2Ref = async () => {
    setShowL2Ref(true);
    if (l2RefData.length > 0) return;
    setL2RefLoading(true);
    try {
      const data = await getCodeDetail({ COMMON_GRP: 'LGCT015' });
      setL2RefData(data || []);
    } catch (e) {
      console.error('[PortStatusModal] LGCT015 조회 실패:', e);
    } finally {
      setL2RefLoading(false);
    }
  };

  // Port공사요청 화면 열기 (LGWO001 공통코드 로드)
  const handleOpenConsReq = async () => {
    setShowConsReq(true);
    if (consReqReasonCodes.length > 0) return;
    try {
      const result = await getCommonCodeList(['LGWO001']);
      const codes = result?.['LGWO001'] || result?.output13 || [];
      setConsReqReasonCodes(Array.isArray(codes) ? codes : []);
    } catch (e) {
      console.error('[PortStatusModal] LGWO001 조회 실패:', e);
    }
  };

  // Port공사요청 등록 (레거시: btn_work_ins_OnClick)
  const handleConsReqSubmit = async (workItem: any, userInfo: any) => {
    if (!consReqReason) {
      showToast?.('청약사유를 선택하세요.', 'warning');
      return;
    }
    if (!consReqDetail.trim()) {
      showToast?.('작업내용 상세기술을 입력하세요.', 'warning');
      return;
    }

    setConsReqLoading(true);
    try {
      const result = await setUplsRqstConsReq({
        ENTR_RQST_NO: workItem.entrRqstNo || '',
        CONS_REQ_RSN_CD: consReqReason,
        HSVC_INCR_RSN_CNTN: consReqDetail,
        HSVC_CONS_RQMN_DIVS_CD: '2',
        SBGN_DEAL_NM: userInfo.crrNm || userInfo.name || '',
        SBGN_DEAL_TLNO: '',
        SBGN_EGNR_NM: userInfo.name || userInfo.userName || '',
        SBGN_EGNR_HPHN_TLNO: userInfo.phone || userInfo.hpNo || '',
        CTRT_ID: workItem.ctrtId || '',
        RCPT_ID: workItem.rcptId || '',
        WRK_ID: workItem.wrkId || '',
        ENTR_NO: entrNo || '',
      });

      if (result.RESULT_CD && !result.RESULT_CD.startsWith('N')) {
        showToast?.('공사청약이 처리되었습니다.', 'success');
        setShowConsReq(false);
        setConsReqReason('');
        setConsReqDetail('');
      } else {
        showToast?.(result.RESULT_MSG || '공사청약 처리에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      console.error('[PortStatusModal] Port공사요청 실패:', error);
      showToast?.(error.message || '공사청약 등록에 실패했습니다.', 'error');
    } finally {
      setConsReqLoading(false);
    }
  };

  // L2 기준정보 화면
  if (showL2Ref) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">LGU+ L2 장비 기준정보</h3>
            <button onClick={() => setShowL2Ref(false)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {l2RefLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : l2RefData.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">데이터가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: '400px' }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">모델명</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">최고속도</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">제조사</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l2RefData.map((item, idx) => (
                      <tr key={idx} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-2 py-2 text-gray-900 whitespace-nowrap">{item.COMMON_CD_NM || '-'}</td>
                        <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{item.REF_CODE || '-'}</td>
                        <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{item.REF_CODE2 || '-'}</td>
                        <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{item.REF_CODE3 || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-200 flex justify-end">
            <button onClick={() => setShowL2Ref(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700">닫기</button>
          </div>
        </div>
      </div>
    );
  }

  // Port공사요청 화면 (레거시: mowou04p01 동일구현)
  if (showConsReq) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-900">Port증설 공사요청 등록</h3>
            <button onClick={() => setShowConsReq(false)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {/* 한국통신청구번호 (읽기전용) */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">한국통신청구번호</label>
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-800 font-mono">{entrNo || '-'}</div>
            </div>
            {/* 청약담당자 (읽기전용) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">청약담당자</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-800">
                  {(() => { try { const u = JSON.parse(localStorage.getItem('userInfo') || '{}'); return u.name || u.userName || '-'; } catch { return '-'; } })()}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">청약담당자전화</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-800 font-mono">
                  {(() => { try { const u = JSON.parse(localStorage.getItem('userInfo') || '{}'); return u.phone || u.hpNo || '-'; } catch { return '-'; } })()}
                </div>
              </div>
            </div>
            {/* 청약사유 (필수, 콤보 - LGWO001) */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">청약사유 <span className="text-red-500">*</span></label>
              <Select
                value={consReqReason}
                onChange={(val) => setConsReqReason(val)}
                placeholder="선택하세요"
                options={consReqReasonCodes.map((code: any, idx: number) => ({
                  value: code.COMMON_CD || code.code || '',
                  label: code.COMMON_CD_NM || code.name || code.COMMON_CD || '',
                }))}
              />
            </div>
            {/* 작업내용 상세기술 (필수, 텍스트에어리어) */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">작업내용 상세기술 <span className="text-red-500">*</span></label>
              <textarea
                value={consReqDetail}
                onChange={(e) => setConsReqDetail(e.target.value.slice(0, 512))}
                placeholder="공사 수행을 위한 상세 내용을 입력하세요"
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:border-orange-400 focus:outline-none"
              />
              <div className="text-right text-xs text-gray-400 mt-0.5">{consReqDetail.length}/512</div>
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              onClick={() => {
                const userInfo = (() => { try { return JSON.parse(localStorage.getItem('userInfo') || '{}'); } catch { return {}; } })();
                const workInfo = {
                  entrRqstNo: entrRqstNo || '',
                  ctrtId: parentWorkItem?.CTRT_ID || parentWorkItem?.ctrtId || '',
                  rcptId: parentWorkItem?.RCPT_ID || parentWorkItem?.rcptId || parentWorkItem?.receiptId || '',
                  wrkId: parentWorkItem?.id || parentWorkItem?.WRK_ID || '',
                  crrNm: parentWorkItem?.CRR_NM || '',
                };
                handleConsReqSubmit({ ...workInfo, crrNm: workInfo.crrNm }, { ...userInfo, crrNm: workInfo.crrNm });
              }}
              disabled={consReqLoading}
              className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
                consReqLoading ? 'bg-gray-300 text-gray-500' : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {consReqLoading ? '처리 중...' : '공사청약 등록'}
            </button>
            <button
              onClick={() => setShowConsReq(false)}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
            >
              돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-900 whitespace-nowrap">LGU+ {isFtth ? 'RN' : 'L2'} 포트현황조회</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {equipList.length === 0 ? (
            <div className="text-center text-gray-500 py-8">장비 데이터가 없습니다.</div>
          ) : (
            <>
              {/* FTTH: 상단에 LGU+ 가입번호 표시 (레거시: mowou04p05) */}
              {isFtth && entrNo && (
                <div className="bg-purple-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-xs text-purple-600 font-semibold whitespace-nowrap">LGU+ 가입번호</span>
                  <span className="text-xs font-mono font-bold text-purple-900 whitespace-nowrap">{entrNo}</span>
                </div>
              )}

              {/* 장비 선택 콤보 (레거시: cmb_lgu_Eqt_Nm) - 커스텀 셀렉트 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">장비 선택</label>
                <Select
                  value={selectedEqipId}
                  onValueChange={onEquipChange}
                  options={equipOptions}
                  placeholder="장비를 선택하세요"
                />
              </div>

              {/* 장비 상세 - 광랜(L2) vs FTTH(RN) 분기 (세로 배치) */}
              {selectedEquip && (
                <div className="bg-blue-50 rounded-lg p-3">
                  {isFtth ? (
                    /* FTTH(RN): 모델명, 설치장소 (레거시: mowou04p05) */
                    <div className="space-y-1.5 text-xs">
                      <div className="whitespace-nowrap"><span className="text-gray-500">모델명: </span><span className="font-semibold truncate">{selectedEquip.MDL_NM || '-'}</span></div>
                      <div className="whitespace-nowrap"><span className="text-gray-500">설치장소: </span><span className="truncate">{selectedEquip.EQIP_ESTB_FLOO_NM || '-'}</span></div>
                    </div>
                  ) : (
                    /* 광랜(L2): 건물명, 모델명, 설치장소 (레거시: mowou04p04) */
                    <div className="space-y-1.5 text-xs">
                      <div className="whitespace-nowrap"><span className="text-gray-500">건물명: </span><span className="font-semibold truncate">{selectedEquip.ESTB_PLC_NM || '-'}</span></div>
                      <div className="whitespace-nowrap"><span className="text-gray-500">모델명: </span><span className="font-semibold truncate">{selectedEquip.MDL_NM || '-'}</span></div>
                      <div className="whitespace-nowrap"><span className="text-gray-500">설치장소: </span><span className="truncate">{selectedEquip.EQIP_ESTB_FLOO_NM || '-'}</span></div>
                    </div>
                  )}
                </div>
              )}

              {/* 포트 그리드 (레거시: gd_line_eqt_port) - mowou04p04/05 동일 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">포트 목록</label>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{portList.length}건</span>
                </div>
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  {/* 컬럼: 포트, U+가입번호, 계약호, 상태 (레거시 mowou04p04/05 동일) */}
                  <div className="grid grid-cols-4 bg-gray-100 text-xs font-semibold text-gray-600 px-2 py-2 border-b min-w-[320px]">
                    <div className="whitespace-nowrap">포트</div>
                    <div className="whitespace-nowrap">U+가입번호</div>
                    <div className="whitespace-nowrap">계약호</div>
                    <div className="text-center whitespace-nowrap">상태</div>
                  </div>
                  {portList.length === 0 ? (
                    <div className="text-center text-gray-400 text-xs py-4">포트 없음</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y">
                      {portList.map((port: any, idx: number) => (
                        <div key={idx} className={`grid grid-cols-4 text-xs px-2 py-2 hover:bg-gray-50 min-w-[320px] ${port.PT_USE === 'Y' ? 'bg-red-50/50' : ''}`}>
                          <div className="font-mono whitespace-nowrap">{port.PORT_NO || '-'}</div>
                          <div className="font-mono text-gray-600 whitespace-nowrap truncate">{port.ENTR_NO || '-'}</div>
                          <div className="font-mono text-gray-600 whitespace-nowrap truncate">{port.CTRT_ID || '-'}</div>
                          <div className="text-center whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-medium whitespace-nowrap ${
                              port.PT_USE === 'Y' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {port.PT_USE === 'Y' ? '사용' : '빈포트'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 하단 버튼 영역 */}
        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            {/* L2 기준정보 버튼 - 광랜(L2)일 때만 표시 (레거시: mowou04p06) */}
            {!isFtth && (
              <button
                onClick={handleOpenL2Ref}
                className="flex-1 py-2 bg-purple-500 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-purple-600 transition-colors whitespace-nowrap"
              >
                <Database className="w-4 h-4 flex-shrink-0" />
                L2 기준정보
              </button>
            )}
            {/* Port공사요청 버튼 (광랜/FTTH 모두, 레거시: mowou04p01) */}
            <button
              onClick={handleOpenConsReq}
              className="flex-1 py-2 bg-orange-500 text-white rounded-lg font-semibold text-sm hover:bg-orange-600 transition-colors whitespace-nowrap"
            >
              Port공사요청
            </button>
          </div>
          <button onClick={onClose} className="w-full py-2 bg-gray-600 text-white rounded-lg font-semibold">닫기</button>
        </div>
      </div>
    </div>
  );
};

/**
 * 작업 프로세스 3단계: 장비 정보
 */
const WorkEquipmentManagement: React.FC<WorkEquipmentManagementProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData,
  onPreloadedDataUpdate,
  readOnly = false,
  isCertifyProd = false,
  certifyOpLnkdCd = '',
}) => {
  // Work Process Store
  const { setEquipmentData } = useWorkProcessStore();

  // Certify Store
  const {
    entrNo, entrRqstNo, setEntrNo,
    lguMarketCd, lguOperatorId, lguJobType, lguJobTypeConf, setLguCommonCd,
    cl02PortData, setCl02PortData,
    isSubscriptionDone, setIsSubscriptionDone,
  } = useCertifyStore();

  // 장비 Store에서 설치장비 가져오기 (LDAP 장비 검증용)
  const workId = workItem.id || (workItem as any).WRK_ID || '';
  const installedEquipments = useWorkEquipmentStore(
    (state) => state.workStates[workId]?.installedEquipments || []
  );

  // LDAP 연동 (useLdapConnect 훅)
  const { handleLdapConnect, ldapLoading, ldapResult, isLdapDone } = useLdapConnect({
    ctrtId: (workItem as any).DTL_CTRT_ID || workItem.CTRT_ID || '',
    certifyOpLnkdCd,
    installedEquipments,
    showToast,
  });

  // 청약신청 로딩 상태
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  // 포트현황 모달 상태 (레거시: mowou04p04/05 - getUplsEqipInfo + getUplsEqipPortInfo)
  const [isPortModalOpen, setIsPortModalOpen] = useState(false);
  const [portLoading, setPortLoading] = useState(false);
  const [portEquipList, setPortEquipList] = useState<any[]>([]);
  const [portPortList, setPortPortList] = useState<any[]>([]);
  const [portSelectedEqipId, setPortSelectedEqipId] = useState<string>('');
  const isFtthProd = ['F', 'FG', 'Z', 'ZG'].includes(certifyOpLnkdCd);

  // ConfirmModal 상태 (window.confirm 대체)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
    type?: 'confirm' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const wrkCd = workItem.WRK_CD || '';
  const ctrtId = (workItem as any).DTL_CTRT_ID || workItem.CTRT_ID || '';
  const needsSubscription = SUBSCRIPTION_WORK_TYPES.includes(wrkCd);

  // LDAP 연동 가드: 청약필요 작업유형은 청약신청 선행 필수
  const ldapBlocked = needsSubscription && !isSubscriptionDone;

  // LDAP 연동 확인 모달용 래퍼
  const wrappedLdapConnect = useCallback(() => {
    if (needsSubscription && !isSubscriptionDone) {
      showToast?.('청약신청을 먼저 완료해주세요.', 'warning');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'LDAP 연동',
      message: 'LDAP 연동을 하시겠습니까?',
      type: 'confirm',
      onConfirm: () => handleLdapConnect(true),
    });
  }, [handleLdapConnect, needsSubscription, isSubscriptionDone, cl02PortData, showToast]);

  // 사용자 정보 헬퍼
  const getUserInfo = useCallback(() => {
    try {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) return JSON.parse(userInfo);
    } catch (e) { /* ignore */ }
    return {};
  }, []);

  // LGU+ 공통코드 로드 (LGCT002 → MRKT_CD, OPERATOR_ID)
  useEffect(() => {
    if (!isCertifyProd || lguMarketCd) return;

    const loadCommonCodes = async () => {
      try {
        const result = await getCommonCodeList(['LGCT002']);
        const lgct002 = result?.['LGCT002'] || result?.output13;
        if (lgct002 && Array.isArray(lgct002) && lgct002.length > 0) {
          const item = lgct002[0] as any;
          setLguCommonCd(item.REF_CODE || '', item.REF_CODE2 || '', item.REF_CODE4 || '', item.REF_CODE5 || '');
          console.log('[LGU+] 공통코드 로드: MRKT_CD=', item.REF_CODE, 'OPERATOR_ID=', item.REF_CODE2, 'JOB_TYPE=', item.REF_CODE4, 'JOB_TYPE_CONF=', item.REF_CODE5);
        }
      } catch (error) {
        console.error('[LGU+] 공통코드 로드 실패:', error);
      }
    };

    loadCommonCodes();
  }, [isCertifyProd, lguMarketCd, setLguCommonCd]);

  // 재신청 시 기존 가입자번호 프리페치
  useEffect(() => {
    if (!isCertifyProd || !needsSubscription || !ctrtId) return;
    if (entrNo || isSubscriptionDone) return; // 이미 세팅됨

    const prefetchEntrNo = async () => {
      try {
        const ctrtResult = await getUplsCtrtInfo({ CTRT_ID: ctrtId });
        const existingEntrNo = ctrtResult?.[0]?.ENTR_NO || '';
        if (existingEntrNo) {
          console.log('[LGU+] 기존 가입자번호 프리페치:', existingEntrNo);
          setEntrNo(existingEntrNo, null);
          setIsSubscriptionDone(true);
        }
      } catch (error) {
        console.error('[LGU+] 가입자번호 프리페치 실패:', error);
      }
    };
    prefetchEntrNo();
  }, [isCertifyProd, needsSubscription, ctrtId, entrNo, isSubscriptionDone]);

  /**
   * 청약 실행 (기존 ENTR_NO가 있으면 취소 후 재등록)
   */
  const executeSubscription = async (existingEntrNo: string) => {
    const user = getUserInfo();
    const regUid = user.userId || user.id || '';

    setSubscriptionLoading(true);
    try {
      if (existingEntrNo) {
        // C2: 필수 파라미터 빈값 검증 (CRR_ID, SO_ID)
        const cancelCrrId = (workItem as any).CRR_ID || '';
        const cancelSoId = workItem.SO_ID || '';
        const cancelCustId = workItem.CUST_ID || (workItem as any).customer?.id || '';
        if (!cancelCrrId || !cancelSoId) {
          console.warn('[LGU+] 청약취소 파라미터 부분누락 - CRR_ID:', cancelCrrId, 'SO_ID:', cancelSoId);
        }

        // 기존 청약 취소
        await requestLGUNetworkFault({
          CTRT_ID: ctrtId,
          CUST_ID: cancelCustId,
          WRK_ID: workId,
          CRR_ID: cancelCrrId,
          SO_ID: cancelSoId,
          REG_UID: regUid,
          CANCEL_TYPE: 'SUBSCRIPTION',
          MRKT_CD: lguMarketCd,
          OPERATOR_ID: lguOperatorId,
        });
        console.log('[LGU+] 기존 청약 취소 완료');
      }

      // 2. 청약등록
      const entrResult = await uplsEntrBgnEstbChg({
        WRK_ID: workId,
        CTRT_ID: ctrtId,
        MRKT_CD: lguMarketCd,
        OPERATOR_ID: lguOperatorId,
        REG_UID: regUid,
      });

      if (entrResult.RESULT_CD === 'Y') {
        showToast?.('요청이 정상적으로 등록되었습니다.', 'success');
        setEntrNo(entrResult.ENTR_NO || null, entrResult.ENTR_RQST_NO || null);
        setIsSubscriptionDone(true);

        // 3. 기존 LDAP 이력 있으면 AP/ONT 삭제 요청
        if (ldapResult && !(ldapResult as any)._empty) {
          const ldapSoId = workItem.SO_ID || '';
          if (!ldapSoId) {
            console.warn('[LGU+] LDAP 삭제 요청 - SO_ID 빈값');
          }
          try {
            // AP 삭제 (레거시: LGU_AP_DEL_EVNT_CD = "삭제")
            if (ldapResult.AP_MAC_ADDR || ldapResult.AP_EQT_NO) {
              await reqUplsHspdLdap({
                MSG_ID: 'SMR05',
                EVNT_CD: '삭제',
                CUST_ID: workItem.CUST_ID || (workItem as any).customer?.id || '',
                CTRT_ID: ctrtId,
                SO_ID: ldapSoId,
                AP_MAC: ldapResult.AP_MAC_ADDR || '',
                AP_EQT_NO: ldapResult.AP_EQT_NO || '',
                ONT_MAC: '',
                ONT_EQT_NO: '',
                REG_UID: regUid,
                JOB_TYPE: lguJobType,
                JOB_TYPE_CONF: lguJobTypeConf,
                ENTR_NO: entrResult.ENTR_NO || '',
              });
              console.log('[LGU+] AP 삭제 요청 완료');
            }
            // ONT 삭제 (레거시: LGU_ONT_DEL_EVNT_CD = "FM삭제")
            // 레거시: AP_MAC을 더미값 "000000000000", 나머지는 빈값 전달 (mowou03m01.xml:3328-3377)
            if (ldapResult.ONT_MAC_ADDR || ldapResult.ONT_EQT_NO) {
              await reqUplsHspdLdap({
                MSG_ID: 'SMR05',
                EVNT_CD: 'FM삭제',
                CUST_ID: workItem.CUST_ID || (workItem as any).customer?.id || '',
                CTRT_ID: ctrtId,
                SO_ID: ldapSoId,
                AP_MAC: '000000000000',
                AP_EQT_NO: '',
                ONT_MAC: '',
                ONT_EQT_NO: '',
                REG_UID: regUid,
                JOB_TYPE: lguJobType,
                JOB_TYPE_CONF: lguJobTypeConf,
                ENTR_NO: entrResult.ENTR_NO || '',
              });
              console.log('[LGU+] ONT 삭제 요청 완료');
            }
          } catch (ldapErr) {
            console.warn('[LGU+] LDAP 삭제 요청 실패 (무시):', ldapErr);
          }
        }
      } else {
        showToast?.(entrResult.RESULT_MSG || '청약 등록에 실패했습니다.', 'error');
      }
    } catch (error: any) {
      console.error('[LGU+] 청약신청 실패:', error);
      showToast?.(error.message || '청약신청에 실패했습니다.', 'error');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  /**
   * 청약신청 버튼 클릭 → 계약조회 후 확인 모달 표시
   * (레거시: btn_LGU_Cust_Req_OnClick)
   */
  const handleSubscriptionRequest = async () => {
    if (!ctrtId) {
      showToast?.('계약 ID가 없습니다.', 'error');
      return;
    }

    // C1: LGU+ 공통코드 로드 확인
    if (!lguMarketCd || !lguOperatorId) {
      showToast?.('LGU+ 공통코드를 로드할 수 없습니다. 잠시 후 다시 시도해주세요.', 'error');
      console.error('[LGU+] 공통코드 미로드 - lguMarketCd:', lguMarketCd, 'lguOperatorId:', lguOperatorId);
      return;
    }

    setSubscriptionLoading(true);
    try {
      // 계약조회 → 기존 ENTR_NO 확인
      const ctrtResult = await getUplsCtrtInfo({ CTRT_ID: ctrtId });
      const existingEntrNo = ctrtResult?.[0]?.ENTR_NO || '';

      setSubscriptionLoading(false);

      if (existingEntrNo) {
        setConfirmModal({
          isOpen: true,
          title: 'U+ 청약 재신청',
          message: '청약이 등록되어 있습니다.\n재신청 하시겠습니까?',
          type: 'warning',
          onConfirm: () => executeSubscription(existingEntrNo),
        });
      } else {
        setConfirmModal({
          isOpen: true,
          title: 'U+ 청약 신청',
          message: 'U+ 청약 요청하시겠습니까?',
          type: 'confirm',
          onConfirm: () => executeSubscription(''),
        });
      }
    } catch (error: any) {
      setSubscriptionLoading(false);
      console.error('[LGU+] 계약조회 실패:', error);
      showToast?.(error.message || '계약조회에 실패했습니다.', 'error');
    }
  };

  /**
   * 포트현황조회 (레거시: mowou04p04/05 - getUplsEqipInfo + getUplsEqipPortInfo)
   * CL-02가 아님! 장비목록 + 포트목록 API 호출
   */
  const handlePortStatusQuery = async () => {
    // 이미 조회된 데이터가 있으면 모달만 열기
    if (portEquipList.length > 0) {
      setIsPortModalOpen(true);
      return;
    }

    if (!entrNo) {
      showToast?.('가입자번호(ENTR_NO)가 없습니다. 청약신청을 먼저 완료해주세요.', 'error');
      return;
    }

    // 레거시: ENTR_RQST_NO 없으면 BIZ_TYPE="02", 있으면 "01"
    const bizType = entrRqstNo ? '01' : '02';
    const entrRqstNoParam = entrRqstNo || 'null';

    // 레거시: fn_get_CommondForEqip(g_Oplnkdcd)
    const command = isFtthProd ? 'ftthEqipList' : 'opticEqipList';

    setPortLoading(true);
    try {
      // 1. 장비 목록 조회 (레거시: fn_eqip_list / fn_upls_EqipList)
      const eqipResult = await getUplsEqipInfo({
        COMMAND: command,
        ENTR_NO: entrNo,
        ENTR_RQST_NO: entrRqstNoParam,
        BIZ_TYPE: bizType,
        CTRT_ID: ctrtId,
      });

      if (!eqipResult || eqipResult.length === 0) {
        showToast?.('조회된 장비정보가 없습니다.', 'info');
        setPortLoading(false);
        return;
      }

      // RESULT_CD 체크 (N이면 실패)
      if (eqipResult[0]?.RESULT_CD && eqipResult[0].RESULT_CD.startsWith('N')) {
        showToast?.(`장비조회 실패: ${eqipResult[0].RESULT_MSG || ''}`, 'error');
        setPortLoading(false);
        return;
      }

      setPortEquipList(eqipResult);

      // 2. 첫번째 장비의 포트 목록 조회 (레거시: fn_lgu_eqip_port_info / fn_upls_EqipPortList)
      const firstEqipId = eqipResult[0].EQIP_ID;
      setPortSelectedEqipId(firstEqipId);

      const portCommand = isFtthProd ? 'ftthEqipPortList' : 'opticEqipPortList';
      const portResult = await getUplsEqipPortInfo({
        COMMAND: portCommand,
        EQIP_ID: firstEqipId,
        CTRT_ID: ctrtId,
      });

      setPortPortList(portResult || []);
      setIsPortModalOpen(true);
    } catch (error: any) {
      console.error('[LGU+] 포트현황조회 실패:', error);
      showToast?.(error.message || '포트현황조회에 실패했습니다.', 'error');
    } finally {
      setPortLoading(false);
    }
  };

  /**
   * 포트현황 팝업에서 장비 선택 변경 → 해당 장비 포트 조회
   */
  const handlePortEquipChange = async (eqipId: string) => {
    setPortSelectedEqipId(eqipId);
    const portCommand = isFtthProd ? 'ftthEqipPortList' : 'opticEqipPortList';
    try {
      const portResult = await getUplsEqipPortInfo({
        COMMAND: portCommand,
        EQIP_ID: eqipId,
        CTRT_ID: ctrtId,
      });
      setPortPortList(portResult || []);
    } catch (error) {
      console.error('[LGU+] 포트 조회 실패:', error);
      setPortPortList([]);
    }
  };

  // 장비 저장 핸들러
  const handleSave = (data: EquipmentData) => {
    console.log('[WorkEquipmentManagement] 장비 저장:', data);
    setEquipmentData(data);
    onSave(data);
  };

  return (
    <div className="work-equipment-management">
      {/* ========== LGU+ 청약신청 + 포트현황 섹션 (최상단) ========== */}
      {isCertifyProd && !readOnly && needsSubscription && (
        <div className="mx-3 mt-2 mb-1">
          <div className={`rounded-lg border p-3 ${isSubscriptionDone ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className={`w-5 h-5 flex-shrink-0 ${isSubscriptionDone ? 'text-green-600' : 'text-orange-600'}`} />
                <div className="min-w-0">
                  <div className={`text-sm font-semibold whitespace-nowrap ${isSubscriptionDone ? 'text-green-800' : 'text-orange-800'}`}>
                    U+ 청약신청
                  </div>
                  {entrNo && (
                    <div className="text-xs text-gray-600 truncate">
                      가입자번호: <span className="font-mono font-semibold">{entrNo}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 청약신청 버튼 */}
                <button
                  onClick={handleSubscriptionRequest}
                  disabled={subscriptionLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors bg-orange-500 text-white hover:bg-orange-600 ${subscriptionLoading ? 'opacity-50' : ''}`}
                >
                  {subscriptionLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      처리중...
                    </span>
                  ) : (
                    '청약신청'
                  )}
                </button>
                {/* 포트현황조회 버튼 */}
                <button
                  onClick={handlePortStatusQuery}
                  disabled={portLoading}
                  className="px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  {portLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      조회중
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Search className="w-3 h-3" />
                      포트현황
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 읽기전용: 청약 결과 표시 */}
      {isCertifyProd && readOnly && entrNo && (
        <div className="mx-3 mt-2 mb-1">
          <div className="rounded-lg border p-3 bg-green-50 border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">청약완료</span>
              <span className="text-xs text-gray-600 font-mono">{entrNo}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========== WRK_CD별 분리된 장비관리 컴포넌트 라우터 ========== */}
      <EquipmentRouter
        workItem={workItem}
        onSave={handleSave}
        onBack={onBack}
        showToast={showToast}
        preloadedApiData={preloadedApiData}
        onPreloadedDataUpdate={onPreloadedDataUpdate}
        readOnly={readOnly}
        isCertifyProd={isCertifyProd}
        certifyOpLnkdCd={certifyOpLnkdCd}
        onLdapConnect={wrappedLdapConnect}
        isLdapDone={isLdapDone}
        ldapLoading={ldapLoading}
        ldapBlocked={ldapBlocked}
      />

      {/* ========== 포트현황조회 팝업 모달 (레거시: mowou04p04/05 동일구현) ========== */}
      {isPortModalOpen && (
        <PortStatusModal
          equipList={portEquipList}
          portList={portPortList}
          isFtth={isFtthProd}
          onEquipChange={handlePortEquipChange}
          selectedEqipId={portSelectedEqipId}
          onClose={() => setIsPortModalOpen(false)}
          showToast={showToast}
          entrNo={entrNo || ''}
          entrRqstNo={entrRqstNo || ''}
          workItem={workItem}
        />
      )}

      {/* ========== 확인 모달 (window.confirm 대체) ========== */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
};

export default WorkEquipmentManagement;
