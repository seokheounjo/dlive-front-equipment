import React from 'react';
import { CheckCircle, Package, AlertTriangle, Search, CheckSquare, XSquare } from 'lucide-react';
import { WorkOrder } from '../../types';

interface RelocationWorkDetailsProps {
  order: WorkOrder;
}

const InfoRow: React.FC<{ label: string; value?: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`flex py-2 border-b border-gray-100 ${highlight ? 'bg-yellow-50' : ''}`}>
    <div className="w-1/3 text-xs sm:text-sm font-medium text-gray-700">{label}</div>
    <div className="w-2/3 text-xs sm:text-sm text-gray-900">{value || '-'}</div>
  </div>
);

const RelocationWorkDetails: React.FC<RelocationWorkDetailsProps> = ({ order }) => {
  return (
    <div className="space-y-4">
      {/* 이전 작업 정보 */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-teal-800 mb-3 flex items-center">
          <span className="mr-2">🚚</span>
          이전 작업 정보
        </h3>
        <div className="bg-white rounded-lg border border-teal-100 divide-y divide-gray-100">
          <InfoRow
            label="현재 설치 위치"
            value={order.customer.address}
          />
          <InfoRow
            label="새 설치 위치"
            value={order.installLocation || '미입력'}
            highlight={!order.installLocation}
          />
          <InfoRow
            label="상품명"
            value={order.productName || '미입력'}
          />
          <InfoRow
            label="계약 ID"
            value={order.CTRT_ID || '미입력'}
          />
        </div>

        {/* 필수 입력 항목 */}
        <div className="mt-3 bg-teal-100 border border-teal-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-teal-800 mb-2 flex items-center gap-1">
            <CheckCircle size={14} />
            필수 입력 항목
          </h4>
          <ul className="text-xs text-teal-700 space-y-1">
            <li>• 새 설치 위치 주소</li>
            <li>• 이전 설치할 장비 정보</li>
            <li>• 이전 사유</li>
            <li>• 고객 확인 서명</li>
          </ul>
        </div>
      </div>

      {/* 장비 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Package size={16} />
          장비 정보
        </h3>

        {order.assignedEquipment && order.assignedEquipment.length > 0 ? (
          <div className="space-y-2">
            {order.assignedEquipment.map((equipment, index) => (
              <div key={equipment.id || index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">유형:</span>
                    <span className="ml-1 font-semibold text-gray-900">{equipment.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">모델:</span>
                    <span className="ml-1 font-semibold text-gray-900">{equipment.model}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">시리얼:</span>
                    <span className="ml-1 font-semibold text-gray-900">{equipment.serialNumber}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 flex items-center gap-1">
            <AlertTriangle size={14} />
            이전할 장비 정보를 입력해주세요.
          </div>
        )}
      </div>

      {/* 이전 작업 프로세스 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Search size={16} />
          이전 작업 프로세스
        </h4>
        <div className="space-y-3">
          {/* 1단계 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">1</span>
              <h5 className="text-xs font-semibold text-blue-800">기존 위치 철거</h5>
            </div>
            <ul className="text-xs text-blue-700 space-y-1 ml-8">
              <li>• 기존 위치에서 장비를 안전하게 철거합니다</li>
              <li>• 철거한 장비의 상태를 점검합니다</li>
              <li>• 철거 완료 사진을 촬영합니다</li>
            </ul>
          </div>

          {/* 2단계 */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">2</span>
              <h5 className="text-xs font-semibold text-green-800">새 위치 설치</h5>
            </div>
            <ul className="text-xs text-green-700 space-y-1 ml-8">
              <li>• 새 위치에 장비를 재설치합니다</li>
              <li>• 네트워크 연결을 테스트합니다</li>
              <li>• 서비스가 정상 작동하는지 확인합니다</li>
            </ul>
          </div>

          {/* 3단계 */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-2">3</span>
              <h5 className="text-xs font-semibold text-purple-800">고객 확인</h5>
            </div>
            <ul className="text-xs text-purple-700 space-y-1 ml-8">
              <li>• 고객에게 서비스 작동을 확인시킵니다</li>
              <li>• 새 주소로 계약 정보가 변경됨을 안내합니다</li>
              <li>• 고객 확인 서명을 받습니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 자동이체 등록 안내 */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
          <span className="mr-2">💳</span>
          자동이체 등록 확인
        </h3>
        <div className="bg-white rounded-lg border border-green-100 p-3">
          <p className="text-xs text-gray-600 mb-2">
            이전 작업의 경우, 납부방법이 <span className="font-semibold text-green-600">'01'(자동이체)</span>이고 자동대체 등록 여부가 'Y'인 경우 자동이체 등록이 필요합니다.
          </p>
          <div className="mt-2 bg-green-50 border border-green-200 rounded p-2">
            <p className="text-xs font-semibold text-green-700">
              SQL 조건: WRK_CD IN ('01','05','07') AND PYM_MTHD = '01' AND ATMT_YN = 'Y'
            </p>
          </div>
        </div>
      </div>

      {/* 철거 작업 연관 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">🔗 연관 작업 정보</h4>
        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <p className="text-xs text-gray-600 mb-2">
            이전 작업(WRK_CD='04')은 철거 작업과 연관되어 있을 수 있습니다:
          </p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <span className="font-semibold">철거(이전)</span> WRK_CD='07': 이전하기 전에 기존 위치에서 장비 철거</li>
            <li>• <span className="font-semibold">철거(해지)</span> WRK_CD='08': 해지를 위한 장비 철거</li>
          </ul>
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
            <p className="text-xs text-blue-700">
              철거 작업이 먼저 완료되어야 이전 설치 작업을 진행할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 계약 상태 확인 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1">
          <AlertTriangle size={16} className="text-gray-600" />
          계약 상태 확인
        </h4>
        <p className="text-xs text-gray-600 mb-2">
          이전 작업은 계약 상태가 <span className="font-semibold text-teal-600">'20'(정상)</span>인 경우에 진행 가능합니다.
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
          <li>• 철거 작업이 먼저 완료되었는지 확인하세요</li>
          <li>• 새 설치 위치의 네트워크 환경을 사전에 확인하세요</li>
          <li>• 장비 이동 중 파손되지 않도록 주의하세요</li>
          <li>• 고객의 새 주소로 계약서 정보가 자동 변경됩니다</li>
          <li>• 자동이체가 설정된 경우 계좌 정보를 재확인하세요</li>
        </ul>
      </div>
    </div>
  );
};

export default RelocationWorkDetails;
