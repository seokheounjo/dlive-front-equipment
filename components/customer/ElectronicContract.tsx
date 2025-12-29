import React, { useState, useEffect } from 'react';
import {
  FileSignature, Send, FileCheck, Download,
  AlertCircle, Loader2, Clock, CheckCircle,
  XCircle, RefreshCw, ExternalLink, ArrowLeft
} from 'lucide-react';
import {
  requestElectronicContract,
  getElectronicSignStatus
} from '../../services/customerApi';

interface ElectronicContractProps {
  onBack: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  selectedCustomer: {
    custId: string;
    custNm: string;
    telNo: string;
  } | null;
  selectedContract: {
    ctrtId: string;
    prodNm: string;
    instAddr: string;
  } | null;
}

interface ContractSignStatus {
  status: 'pending' | 'sent' | 'signed' | 'completed' | 'expired' | 'rejected';
  statusNm: string;
  requestDt?: string;
  signDt?: string;
  docUrl?: string;
}

/**
 * 전자계약 화면
 *
 * 회의록 기준:
 * - 전자계약서 서명 (기존 계약서 서명이 안된 경우)
 * - 모두싸인 API 사용
 * - 전자계약 요청 / 전자서명 진행 / 완료 문서 수신
 */
const ElectronicContract: React.FC<ElectronicContractProps> = ({
  onBack,
  showToast,
  selectedCustomer,
  selectedContract
}) => {
  // 서명 상태
  const [signStatus, setSignStatus] = useState<ContractSignStatus | null>(null);

  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  // 초기 로드
  useEffect(() => {
    if (selectedContract) {
      checkSignStatus();
    }
  }, [selectedContract]);

  // 서명 상태 확인
  const checkSignStatus = async () => {
    if (!selectedContract) return;

    setIsLoading(true);
    try {
      const response = await getElectronicSignStatus(selectedContract.ctrtId);

      if (response.success && response.data) {
        setSignStatus(response.data);
      } else {
        // 상태 없음 = 아직 요청 안함
        setSignStatus(null);
      }
    } catch (error) {
      console.error('Check sign status error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 전자계약 요청
  const handleRequestContract = async () => {
    if (!selectedCustomer || !selectedContract) {
      showToast?.('고객과 계약을 선택해주세요.', 'warning');
      return;
    }

    setIsRequesting(true);
    try {
      const response = await requestElectronicContract(
        selectedContract.ctrtId,
        selectedCustomer.custId
      );

      if (response.success) {
        showToast?.('전자계약 요청이 발송되었습니다.', 'success');
        // 상태 새로고침
        await checkSignStatus();
      } else {
        showToast?.(response.message || '전자계약 요청에 실패했습니다.', 'error');
      }
    } catch (error) {
      console.error('Request contract error:', error);
      showToast?.('전자계약 요청 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsRequesting(false);
    }
  };

  // 상태별 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-6 h-6 text-gray-400" />;
      case 'sent':
        return <Send className="w-6 h-6 text-blue-500" />;
      case 'signed':
        return <FileCheck className="w-6 h-6 text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'expired':
        return <Clock className="w-6 h-6 text-orange-500" />;
      case 'rejected':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <FileSignature className="w-6 h-6 text-gray-400" />;
    }
  };

  // 상태별 배경색
  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-blue-50 border-blue-200';
      case 'signed':
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'expired':
        return 'bg-orange-50 border-orange-200';
      case 'rejected':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // 고객/계약 미선택 안내
  if (!selectedCustomer || !selectedContract) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {!selectedCustomer ? '고객을 먼저 선택해주세요' : '계약을 먼저 선택해주세요'}
          </h3>
          <p className="text-gray-500 mb-4">
            기본조회 탭에서 고객을 검색하고<br />
            계약현황에서 계약을 선택한 후<br />
            전자계약을 진행할 수 있습니다.
          </p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            기본조회로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileSignature className="w-6 h-6 text-purple-500" />
            <h2 className="text-lg font-medium text-gray-800">전자계약</h2>
          </div>

          {/* 선택된 고객/계약 정보 */}
          <div className="space-y-2">
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-800">
                <span className="font-medium">고객:</span>
                <span className="ml-2">{selectedCustomer.custNm}</span>
                <span className="ml-2 text-purple-600">({selectedCustomer.custId})</span>
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-800">
                <span className="font-medium">계약:</span>
                <span className="ml-2">{selectedContract.prodNm}</span>
                <span className="ml-2 text-purple-600">({selectedContract.ctrtId})</span>
              </div>
              <div className="text-xs text-purple-600 mt-1">
                {selectedContract.instAddr}
              </div>
            </div>
          </div>
        </div>

        {/* 서명 상태 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-800">서명 상태</h3>
            <button
              onClick={checkSignStatus}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : signStatus ? (
            <div className={`p-4 rounded-lg border ${getStatusBgColor(signStatus.status)}`}>
              <div className="flex items-center gap-3">
                {getStatusIcon(signStatus.status)}
                <div>
                  <div className="font-medium text-gray-800">{signStatus.statusNm}</div>
                  {signStatus.requestDt && (
                    <div className="text-sm text-gray-500">
                      요청일: {signStatus.requestDt}
                    </div>
                  )}
                  {signStatus.signDt && (
                    <div className="text-sm text-gray-500">
                      서명일: {signStatus.signDt}
                    </div>
                  )}
                </div>
              </div>

              {/* 완료된 경우 문서 다운로드 */}
              {signStatus.status === 'completed' && signStatus.docUrl && (
                <div className="mt-4">
                  <a
                    href={signStatus.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    서명 완료 문서 다운로드
                  </a>
                </div>
              )}

              {/* 만료된 경우 재요청 */}
              {signStatus.status === 'expired' && (
                <div className="mt-4">
                  <button
                    onClick={handleRequestContract}
                    disabled={isRequesting}
                    className="flex items-center justify-center gap-2 w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 transition-colors"
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        요청 중...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        재요청
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileSignature className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">전자계약이 요청되지 않았습니다.</p>
              <button
                onClick={handleRequestContract}
                disabled={isRequesting}
                className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 transition-colors"
              >
                {isRequesting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    요청 중...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    전자계약 요청
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 안내 사항 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 mb-3">전자계약 안내</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">1.</span>
              <span>전자계약 요청 시 고객에게 서명 요청 문자가 발송됩니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">2.</span>
              <span>고객은 문자 링크를 통해 본인인증 후 전자서명을 진행합니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">3.</span>
              <span>서명 완료 시 계약서가 자동으로 저장됩니다.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-500 font-bold">4.</span>
              <span>요청 후 7일 이내 서명하지 않으면 만료됩니다.</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-blue-700">
                모두싸인 서비스를 통해 전자서명이 진행됩니다.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectronicContract;
