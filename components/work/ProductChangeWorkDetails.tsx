import React from 'react';
import { RefreshCw, List, CheckCircle, AlertTriangle, CheckSquare, XSquare } from 'lucide-react';
import { WorkOrder } from '../../types';

interface ProductChangeWorkDetailsProps {
  order: WorkOrder;
}

const InfoRow: React.FC<{ label: string; value?: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`flex py-2 border-b border-gray-100 ${highlight ? 'bg-yellow-50' : ''}`}>
    <div className="w-1/3 text-xs sm:text-sm font-medium text-gray-700">{label}</div>
    <div className="w-2/3 text-xs sm:text-sm text-gray-900">{value || '-'}</div>
  </div>
);

const ProductChangeWorkDetails: React.FC<ProductChangeWorkDetailsProps> = ({ order }) => {
  // 세부 유형 코드에 따른 변경 유형 결정
  const getChangeType = (wrkDtlTcd?: string): string => {
    switch (wrkDtlTcd) {
      case '0510':
      case '0520':
        return '상품 추가';
      case '0550':
      case '0560':
        return '상품 삭제';
      default:
        return '상품 변경';
    }
  };

  const changeType = getChangeType(order.WRK_DTL_TCD);

  return (
    <div className="space-y-4">
      {/* 상품변경 정보 */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
          <RefreshCw size={16} />
          상품변경 정보
        </h3>
        <div className="bg-white rounded-lg border border-purple-100 divide-y divide-gray-100">
          <InfoRow
            label="변경 유형"
            value={changeType}
          />
          <InfoRow
            label="세부 유형 코드"
            value={order.WRK_DTL_TCD || '미확인'}
          />
          <InfoRow
            label="현재 상품"
            value={order.currentProduct || order.productName || '미입력'}
            highlight={!order.currentProduct && !order.productName}
          />
          <InfoRow
            label="변경할 상품"
            value={order.newProduct || '미입력'}
            highlight={!order.newProduct}
          />
          <InfoRow
            label="상품명"
            value={order.productName || '미입력'}
          />
        </div>

        {/* 세부 유형 코드 변환 규칙 안내 */}
        <div className="mt-3 bg-purple-100 border border-purple-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-purple-800 mb-2 flex items-center gap-1">
            <List size={14} />
            세부 유형 코드 매핑
          </h4>
          <ul className="text-xs text-purple-700 space-y-1">
            <li>• <span className="font-semibold">0510</span>: 상품 추가 (기존 상품에 추가)</li>
            <li>• <span className="font-semibold">0520</span>: 상품 변경 → <span className="text-red-600">0510으로 자동 변환</span></li>
            <li>• <span className="font-semibold">0550</span>: 상품 삭제 (부가상품 해지)</li>
            <li>• <span className="font-semibold">0560</span>: 상품 삭제2 → <span className="text-red-600">0550으로 자동 변환</span></li>
          </ul>
        </div>

        {/* 필수 입력 항목 */}
        <div className="mt-3 bg-white border border-purple-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-purple-800 mb-2 flex items-center gap-1">
            <CheckCircle size={14} />
            필수 입력 항목
          </h4>
          <ul className="text-xs text-purple-700 space-y-1">
            <li>• 현재 상품 코드 (BASIC_PROD_CD)</li>
            <li>• 변경할 상품 코드 (NEW_PROD_CD)</li>
            <li>• 변경 사유</li>
            <li>• 변경 내용 상세</li>
          </ul>
        </div>
      </div>

      {/* 자동이체 등록 안내 */}
      {(order.WRK_DTL_TCD === '0510' || order.WRK_DTL_TCD === '0520') && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
            <span className="mr-2">💳</span>
            자동이체 등록 확인
          </h3>
          <div className="bg-white rounded-lg border border-green-100 p-3">
            <p className="text-xs text-gray-600 mb-2">
              상품 추가/변경의 경우, 납부방법이 <span className="font-semibold text-green-600">'01'(자동이체)</span>이고 자동대체 등록 여부가 'Y'인 경우 자동이체 등록이 필요합니다.
            </p>
            <div className="mt-2 bg-green-50 border border-green-200 rounded p-2">
              <p className="text-xs font-semibold text-green-700">
                SQL 조건: WRK_CD IN ('01','05','07') AND PYM_MTHD = '01' AND ATMT_YN = 'Y'
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 부가상품 정보 (SMART) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          <span className="mr-2">📦</span>
          상품 구성 정보
        </h3>
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-600 mb-2">
            상품변경 작업 시 부가상품 구성 요소를 확인합니다.
          </p>
          <div className="mt-2">
            <div className="text-xs font-semibold text-gray-700">조회 조건:</div>
            <ul className="text-xs text-gray-600 mt-1 space-y-1">
              <li>• WRK_CD IN ('01','05','07','09')</li>
              <li>• PROD_CMPS_CL = '21' (부가상품)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 작업 진행 가이드 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">작업 진행 가이드</h4>
        <ul className="text-xs text-gray-600 space-y-2">
          <li className="flex items-start">
            <span className="mr-2">1.</span>
            <span>고객의 현재 이용 중인 상품을 확인합니다.</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">2.</span>
            <span>변경 요청 상품이 고객의 현재 계약과 호환되는지 확인합니다.</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">3.</span>
            <span>상품 변경에 따른 요금 변경 사항을 고객에게 안내합니다.</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">4.</span>
            <span>장비 변경이 필요한 경우, 장비 교체 작업을 진행합니다.</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">5.</span>
            <span>변경된 서비스가 정상 작동하는지 테스트합니다.</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">6.</span>
            <span>고객에게 변경된 서비스 내용과 사용법을 안내합니다.</span>
          </li>
        </ul>
      </div>

      {/* 계약 상태 확인 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1">
          <AlertTriangle size={16} className="text-gray-600" />
          계약 상태 확인
        </h4>
        <p className="text-xs text-gray-600 mb-2">
          상품변경은 계약 상태가 <span className="font-semibold text-purple-600">'20'(정상)</span>인 경우에 진행 가능합니다.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs flex items-center gap-1">
          <span className="text-gray-600">현재 계약 상태: </span>
          <span className={`font-semibold flex items-center gap-1 ${order.CTRT_STAT === '20' ? 'text-green-600' : 'text-red-600'}`}>
            {order.CTRT_STAT || '미확인'}
            {order.CTRT_STAT === '20' ? <CheckSquare size={14} /> : <XSquare size={14} />}
          </span>
        </div>
      </div>

      {/* 주의사항 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-1">
          <AlertTriangle size={16} />
          주의사항
        </h4>
        <ul className="text-xs text-yellow-700 space-y-1">
          <li>• 세부 유형 코드 0520과 0560은 시스템에서 자동으로 변환됩니다</li>
          <li>• 상품 삭제 시 부가상품만 해지 가능하며, 기본 상품은 해지할 수 없습니다</li>
          <li>• 상품 변경 시 프로모션 혜택이 유지되는지 확인이 필요합니다</li>
          <li>• 상품 추가 시 장비가 필요한 경우 장비 할당을 먼저 진행해야 합니다</li>
        </ul>
      </div>
    </div>
  );
};

export default ProductChangeWorkDetails;
