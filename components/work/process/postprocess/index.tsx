/**
 * PostProcess - 후처리 화면 메인 컴포넌트
 *
 * 작업완료 이후 모든 작업유형에서 표시되는 후처리 화면
 * 완료된 작업 조회 시에도 표시됨
 */
import React, { useState, useEffect } from 'react';
import { WorkOrder } from '../../../../types';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { getAfterProcInfo } from '../../../../services/apiService';

interface PostProcessProps {
  order: WorkOrder;
  onBack: () => void;
  onComplete: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const PostProcess: React.FC<PostProcessProps> = ({
  order,
  onBack,
  onComplete,
  showToast
}) => {
  // 신사업홍보 상태
  const [isNewBusinessExpanded, setIsNewBusinessExpanded] = useState(false);

  // 조건 상태
  const [signTypDisabled, setSignTypDisabled] = useState(true);
  const [recontractDisabled, setRecontractDisabled] = useState(true);
  const [autoTransferDisabled, setAutoTransferDisabled] = useState(true);
  const [autoTransferText, setAutoTransferText] = useState('자동이체현장접수');

  // 작업코드
  const wrkCd = order.WRK_CD || '';

  // 신사업홍보 표시 조건: 설치(01), AS(03), 상변(05), 이전설치(07)
  const showNewBusiness = ['01', '03', '05', '07'].includes(wrkCd);

  // 자동이체현장접수 조건 체크
  useEffect(() => {
    const pymMthd = (order as any).PYM_MTHD || '';
    const atmtYn = (order as any).ATMT_YN || '';

    if (['01', '05', '07'].includes(wrkCd) && pymMthd === '01' && atmtYn === 'Y') {
      setAutoTransferDisabled(false);
      setAutoTransferText('★자동이체/Email청구서현장접수');
    } else {
      setAutoTransferDisabled(true);
      setAutoTransferText('자동이체현장접수');
    }
  }, [wrkCd, order]);

  // getAfterProcInfo 호출하여 버튼 상태 결정 (서버에서 계산된 값 사용)
  useEffect(() => {
    const loadAfterProcInfo = async () => {
      const wrkDrctnId = (order as any).WRK_DRCTN_ID;
      if (!wrkDrctnId) {
        console.log('[PostProcess] WRK_DRCTN_ID 없음, 클라이언트 조건 체크 사용');
        // Fallback: 클라이언트 조건 체크
        const signTyp = (order as any).SIGN_TYP || '';
        const custCl = (order as any).CUST_CL || order.customer?.CUST_CL || '';
        const pdaClickYn = (order as any).PDA_CLICK_YN || '';
        if (signTyp === 'NN' || custCl === 'H' || pdaClickYn === 'Y') {
          setSignTypDisabled(true);
        } else {
          setSignTypDisabled(false);
        }
        return;
      }

      try {
        console.log('[PostProcess] getAfterProcInfo 호출:', wrkDrctnId);
        const result = await getAfterProcInfo(wrkDrctnId);

        if (result) {
          console.log('[PostProcess] getAfterProcInfo 결과:', result);
          // WRK_DRCTN_PRNT_YN: 전자청약 진행여부 (Y면 활성화)
          setSignTypDisabled(result.WRK_DRCTN_PRNT_YN !== 'Y');
          // CLOSE_DANGER: 재약정대상 (Y면 활성화)
          setRecontractDisabled(result.CLOSE_DANGER !== 'Y');
          // AUTO_PAYMENTS_YN: 자동이체 현장접수 (Y면 활성화)
          if (result.AUTO_PAYMENTS_YN === 'Y') {
            setAutoTransferDisabled(false);
            setAutoTransferText('★자동이체/Email청구서현장접수');
          }
        } else {
          // API 실패 시 클라이언트 조건 체크
          const signTyp = (order as any).SIGN_TYP || '';
          const custCl = (order as any).CUST_CL || order.customer?.CUST_CL || '';
          const pdaClickYn = (order as any).PDA_CLICK_YN || '';
          if (signTyp === 'NN' || custCl === 'H' || pdaClickYn === 'Y') {
            setSignTypDisabled(true);
          } else {
            setSignTypDisabled(false);
          }
        }
      } catch (error) {
        console.error('[PostProcess] getAfterProcInfo 실패:', error);
      }
    };

    loadAfterProcInfo();
  }, [order]);

  // 버튼 핸들러들
  const handleConsultationClick = () => {
    showToast?.('상담접수 기능은 고객관리 탭에서 이용 가능합니다.', 'info');
  };

  const handleAsReceiptClick = () => {
    showToast?.('AS접수 기능은 고객관리 탭에서 이용 가능합니다.', 'info');
  };

  const handleSignatureClick = () => {
    if (signTypDisabled) {
      showToast?.('전자서명 대상이 아닙니다.', 'warning');
      return;
    }
    showToast?.('전자서명(모두싸인) 기능 연동 예정', 'info');
  };

  const handleRecontractClick = () => {
    if (recontractDisabled) {
      showToast?.('재약정 대상이 아닙니다.', 'warning');
      return;
    }
    showToast?.('재약정(모두싸인) 기능 연동 예정', 'info');
  };

  const handleAutoTransferClick = () => {
    if (autoTransferDisabled) {
      showToast?.('자동이체현장접수 대상이 아닙니다.', 'warning');
      return;
    }
    showToast?.('자동이체현장접수 기능 연동 예정', 'info');
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* 작업 정보 카드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3">
          <h3 className="text-sm font-bold text-white">작업 정보</h3>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-xs text-gray-500">고객명</span>
            <span className="text-sm font-semibold text-gray-900">{order.customer?.name || order.CUST_NM || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-xs text-gray-500">작업유형</span>
            <span className="text-sm font-medium text-gray-800">{order.typeDisplay || order.WRK_CD_NM || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
            <span className="text-xs text-gray-500">상품명</span>
            <span className="text-sm font-medium text-gray-800 text-right max-w-[60%] truncate">{order.PROD_NM || '-'}</span>
          </div>
          <div className="flex justify-between items-start py-1.5">
            <span className="text-xs text-gray-500 flex-shrink-0">주소</span>
            <span className="text-xs text-gray-700 text-right ml-2">{order.customer?.address || (order as any).ST_ADDR || '-'}</span>
          </div>
        </div>
      </div>

      {/* 고객 서비스 버튼 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
          <h3 className="text-sm font-bold text-white">고객 서비스</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleConsultationClick}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 rounded-lg font-semibold transition-all text-sm border border-blue-200"
            >
              <span>상담접수</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleAsReceiptClick}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 active:bg-orange-200 text-orange-700 rounded-lg font-semibold transition-all text-sm border border-orange-200"
            >
              <span>AS접수</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 전자계약 버튼 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3">
          <h3 className="text-sm font-bold text-white">전자계약</h3>
        </div>
        <div className="p-4 space-y-3">
          <button
            type="button"
            onClick={handleSignatureClick}
            disabled={signTypDisabled}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-semibold transition-all text-sm ${
              signTypDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white shadow-sm'
            }`}
          >
            <span>전자서명 (모두싸인)</span>
            {!signTypDisabled && <ExternalLink className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleRecontractClick}
            disabled={recontractDisabled}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-semibold transition-all text-sm ${
              recontractDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white shadow-sm'
            }`}
          >
            <span>재약정대상 (모두싸인)</span>
            {!recontractDisabled && <ExternalLink className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 자동이체 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-3">
          <h3 className="text-sm font-bold text-white">결제/납부</h3>
        </div>
        <div className="p-4">
          <button
            type="button"
            onClick={handleAutoTransferClick}
            disabled={autoTransferDisabled}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg font-semibold transition-all text-sm ${
              autoTransferDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white shadow-sm'
            }`}
          >
            <span>{autoTransferText}</span>
            {!autoTransferDisabled && <ExternalLink className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 신사업홍보 여부 (설치/AS/상변/이전설치만) */}
      {showNewBusiness && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsNewBusinessExpanded(!isNewBusinessExpanded)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <span className="text-sm font-semibold text-amber-800">신사업홍보 여부</span>
            {isNewBusinessExpanded ? (
              <ChevronUp className="w-5 h-5 text-amber-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-amber-600" />
            )}
          </button>
          {isNewBusinessExpanded && (
            <div className="p-4 bg-white border-t border-amber-100">
              <p className="text-sm text-gray-500 text-center py-4">신사업홍보 항목이 표시됩니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 목록으로 버튼 */}
      <div className="pt-2 pb-4">
        <button
          type="button"
          onClick={onComplete}
          className="w-full px-4 py-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 active:from-slate-900 active:to-black text-white rounded-xl font-bold text-base shadow-lg transition-all"
        >
          목록으로
        </button>
      </div>
    </div>
  );
};

export default PostProcess;
