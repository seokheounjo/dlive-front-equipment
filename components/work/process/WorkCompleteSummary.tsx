/**
 * WorkCompleteSummary.tsx
 * 작업완료 전 최종 점검 요약 컴포넌트
 *
 * 실제 API로 전송되는 파라미터를 컴팩트하게 보여줌
 */
import React from 'react';
import { CheckCircle, AlertTriangle, Package, MapPin, User, Wifi, FileText, Wrench } from 'lucide-react';

interface SummaryItem {
  label: string;
  value: string | number | undefined | null;
  icon?: React.ReactNode;
  isWarning?: boolean;
}

interface EquipmentSummary {
  type: 'install' | 'remove';
  name: string;
  serialNo?: string;
}

interface WorkCompleteSummaryProps {
  // 기본 정보 (직접 전달 방식)
  workType?: string;           // 작업유형 (설치/철거/AS 등)
  workTypeName?: string;       // 작업유형명

  // 필수 정보
  custRel?: string;           // 고객관계
  custRelName?: string;       // 고객관계명
  networkType?: string;       // 망구분
  networkTypeName?: string;   // 망구분명
  installType?: string;       // 설치유형
  installTypeName?: string;   // 설치유형명

  // 장비 정보 (직접 전달 방식)
  installedEquipments?: any[];  // 설치 장비
  removedEquipments?: any[];    // 철거 장비

  // 위치 정보
  installLocation?: {
    floor?: string;
    room?: string;
    position?: string;
  };

  // 추가 정보
  upCtrlCl?: string;          // 상향제어
  upCtrlClName?: string;      // 상향제어명
  memo?: string;              // 메모

  // 선택적 정보
  kpiProdGrp?: string;        // KPI제품그룹
  kpiProdGrpName?: string;
  obsRcptCd?: string;         // 처리유형
  obsRcptCdName?: string;
  obsRcptDtlCd?: string;      // 처리유형상세
  obsRcptDtlCdName?: string;

  // 기타
  extraItems?: SummaryItem[];  // 추가 항목들

  // 번들 전달 방식 (호환성)
  equipmentData?: {
    installedEquipments?: any[];
    removedEquipments?: any[];
  };
  installInfoData?: {
    networkType?: string;
    networkTypeName?: string;
    installType?: string;
    installTypeName?: string;
    upCtrlCl?: string;
    upCtrlClName?: string;
    floor?: string;
    room?: string;
    position?: string;
    // InstallInfoModal에서 사용하는 필드명
    NET_CL?: string;
    NET_CL_NM?: string;
    INSTL_TP?: string;
    INSTL_TP_NM?: string;
    WRNG_TP?: string;
    WRNG_TP_NM?: string;
  };
  order?: {
    WRK_CD?: string;
    WRK_DTL_TCD?: string;
    WRK_CD_NM?: string;
    WRK_DTL_TCD_NM?: string;
  };
  custRelOptions?: { value: string; label: string }[];
  installLocationText?: string;
}

// 작업유형 코드 -> 이름 매핑
const WRK_CD_NAMES: Record<string, string> = {
  '01': '설치',
  '02': '철거',
  '03': 'A/S',
  '04': '정지',
  '05': '상품변경',
  '06': '댁내이전',
  '07': '이전설치',
  '08': '이전철거',
  '09': '부가상품',
};

// 설치유형(INSTL_TP) 코드 -> 이름 매핑 (CMOT004)
const INSTL_TP_NAMES: Record<string, string> = {
  '11': '신규',
  '22': '단독',
  '33': '연결',
  '44': 'IF',
  '55': 'FTTB',
  '66': 'FTTH',
  '77': '철거',
  '88': '기타',
};

const WorkCompleteSummary: React.FC<WorkCompleteSummaryProps> = ({
  workType,
  workTypeName,
  custRel,
  custRelName,
  networkType,
  networkTypeName,
  installType,
  installTypeName,
  installedEquipments,
  removedEquipments,
  installLocation,
  upCtrlCl,
  upCtrlClName,
  memo,
  kpiProdGrp,
  kpiProdGrpName,
  obsRcptCd,
  obsRcptCdName,
  obsRcptDtlCd,
  obsRcptDtlCdName,
  extraItems = [],
  // 번들 전달 방식
  equipmentData,
  installInfoData,
  order,
  custRelOptions,
  installLocationText,
}) => {
  // 값 추출 (직접 전달 우선, 없으면 번들에서 추출)
  // InstallInfoModal은 NET_CL/NET_CL_NM 필드를 사용하므로 둘 다 체크
  const _workType = workType || order?.WRK_CD || '';
  const _workTypeName = workTypeName || order?.WRK_CD_NM || WRK_CD_NAMES[_workType] || '';
  const _custRelName = custRelName || custRelOptions?.find(o => o.value === custRel)?.label;
  const _networkType = networkType || installInfoData?.networkType || installInfoData?.NET_CL;
  const _networkTypeName = networkTypeName || installInfoData?.networkTypeName || installInfoData?.NET_CL_NM;
  const _installType = installType || installInfoData?.installType || installInfoData?.INSTL_TP;
  const _installTypeName = installTypeName || installInfoData?.installTypeName || installInfoData?.INSTL_TP_NM;
  const _upCtrlCl = upCtrlCl || installInfoData?.upCtrlCl;
  const _upCtrlClName = upCtrlClName || installInfoData?.upCtrlClName;
  const _installedEquipments = installedEquipments || equipmentData?.installedEquipments || [];
  const _removedEquipments = removedEquipments || equipmentData?.removedEquipments || [];

  // 설치위치 처리
  const _installLocation = installLocation || (installInfoData ? {
    floor: installInfoData.floor,
    room: installInfoData.room,
    position: installInfoData.position,
  } : undefined);

  // 장비명 추출 헬퍼
  const getEquipmentName = (eq: any): string => {
    // InstalledEquipment 구조 (contractEquipment, actualEquipment)
    if (eq.contractEquipment?.EQT_NM) return eq.contractEquipment.EQT_NM;
    if (eq.contractEquipment?.eqtNm) return eq.contractEquipment.eqtNm;
    if (eq.contractEquipment?.type) return eq.contractEquipment.type;
    if (eq.contractEquipment?.ITEM_MID_NM) return eq.contractEquipment.ITEM_MID_NM;
    if (eq.actualEquipment?.EQT_NM) return eq.actualEquipment.EQT_NM;
    if (eq.actualEquipment?.eqtNm) return eq.actualEquipment.eqtNm;
    if (eq.actualEquipment?.type) return eq.actualEquipment.type;
    if (eq.actualEquipment?.ITEM_MID_NM) return eq.actualEquipment.ITEM_MID_NM;
    // 직접 필드
    if (eq.EQT_NM) return eq.EQT_NM;
    if (eq.eqtNm) return eq.eqtNm;
    if (eq.type) return eq.type;
    if (eq.ITEM_MID_NM) return eq.ITEM_MID_NM;
    return eq.name || '장비';
  };

  const getEquipmentSerial = (eq: any): string => {
    // InstalledEquipment 구조
    if (eq.actualEquipment?.EQT_SERNO) return eq.actualEquipment.EQT_SERNO;
    if (eq.actualEquipment?.eqtSerno) return eq.actualEquipment.eqtSerno;
    if (eq.actualEquipment?.serialNumber) return eq.actualEquipment.serialNumber;
    if (eq.contractEquipment?.EQT_SERNO) return eq.contractEquipment.EQT_SERNO;
    if (eq.contractEquipment?.serialNumber) return eq.contractEquipment.serialNumber;
    // 직접 필드
    if (eq.EQT_SERNO) return eq.EQT_SERNO;
    if (eq.eqtSerno) return eq.eqtSerno;
    if (eq.serialNumber) return eq.serialNumber;
    return '';
  };

  // 설치위치 문자열
  const locationString = installLocationText || (_installLocation
    ? [_installLocation.floor, _installLocation.room, _installLocation.position]
        .filter(Boolean)
        .join(' / ') || '-'
    : '-');

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200">
        <CheckCircle className="w-4 h-4 text-blue-600" />
        <span className="font-bold text-blue-800 text-sm">최종 점검</span>
        <span className="text-xs text-blue-600 ml-auto">{_workTypeName}</span>
      </div>

      <div className="space-y-2 text-xs">
        {/* 고객관계 */}
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="text-gray-600 w-16">고객관계</span>
          <span className={`font-medium ${custRel ? 'text-gray-900' : 'text-red-500'}`}>
            {_custRelName || custRel || '미선택'}
          </span>
        </div>

        {/* 망구분 */}
        <div className="flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="text-gray-600 w-16">망구분</span>
          <span className={`font-medium ${_networkType ? 'text-gray-900' : 'text-red-500'}`}>
            {_networkTypeName || _networkType || '미선택'}
          </span>
        </div>

        {/* 설치유형 (철거/정지 등에서 사용) */}
        {_installType && (
          <div className="flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-gray-600 w-16">설치유형</span>
            <span className="font-medium text-gray-900">
              {_installTypeName || INSTL_TP_NAMES[_installType] || _installType}
            </span>
          </div>
        )}

        {/* 상향제어 */}
        {_upCtrlCl && (
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-gray-600 w-16">상향제어</span>
            <span className="font-medium text-gray-900">
              {_upCtrlClName || _upCtrlCl}
            </span>
          </div>
        )}

        {/* 설치위치 - 데이터 없으면 숨김 */}
        {locationString && locationString !== '-' && (
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-gray-600 w-16">설치위치</span>
            <span className="font-medium text-gray-900 truncate max-w-[180px]">
              {locationString}
            </span>
          </div>
        )}

        {/* KPI제품그룹 (AS) */}
        {kpiProdGrp && (
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-gray-600 w-16">KPI제품</span>
            <span className="font-medium text-gray-900">
              {kpiProdGrpName || kpiProdGrp}
            </span>
          </div>
        )}

        {/* 처리유형 (AS) */}
        {obsRcptCd && (
          <div className="flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-gray-600 w-16">처리유형</span>
            <span className="font-medium text-gray-900">
              {obsRcptCdName || obsRcptCd}
              {obsRcptDtlCd && ` > ${obsRcptDtlCdName || obsRcptDtlCd}`}
            </span>
          </div>
        )}

        {/* 장비 목록 */}
        {(_installedEquipments.length > 0 || _removedEquipments.length > 0) && (
          <div className="mt-2 pt-2 border-t border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-600 font-medium">장비</span>
            </div>
            <div className="space-y-2">
              {/* 설치장비 섹션 */}
              {_installedEquipments.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                  <div className="mb-1.5">
                    <span className="text-green-600 font-semibold text-xs">설치장비</span>
                  </div>
                  <div className="space-y-1">
                    {_installedEquipments.map((eq, idx) => (
                      <div key={`install-${idx}`} className="text-green-700">
                        <div className="flex items-center gap-1">
                          <span className="text-green-500 font-bold">+</span>
                          <span className="font-medium text-xs">{getEquipmentName(eq)}</span>
                        </div>
                        {getEquipmentSerial(eq) && (
                          <div className="ml-4 text-green-600/70 text-[0.625rem] break-all">
                            S/N: {getEquipmentSerial(eq)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 철거장비 섹션 */}
              {_removedEquipments.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <div className="mb-1.5">
                    <span className="text-red-600 font-semibold text-xs">철거장비</span>
                  </div>
                  <div className="space-y-1">
                    {_removedEquipments.map((eq, idx) => (
                      <div key={`remove-${idx}`} className="text-red-700">
                        <div className="flex items-center gap-1">
                          <span className="text-red-500 font-bold">-</span>
                          <span className="font-medium text-xs">{getEquipmentName(eq)}</span>
                        </div>
                        {getEquipmentSerial(eq) && (
                          <div className="ml-4 text-red-600/70 text-[0.625rem] break-all">
                            S/N: {getEquipmentSerial(eq)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 추가 항목들 */}
        {extraItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {item.icon || <FileText className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
            <span className="text-gray-600 w-16">{item.label}</span>
            <span className={`font-medium ${item.isWarning ? 'text-orange-600' : 'text-gray-900'}`}>
              {item.value || '-'}
            </span>
          </div>
        ))}

        {/* 메모 */}
        {memo && (
          <div className="mt-2 pt-2 border-t border-blue-200">
            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-gray-500 mt-0.5" />
              <span className="text-gray-600 w-16">메모</span>
              <span className="font-medium text-gray-900 flex-1 break-all line-clamp-2">
                {memo}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkCompleteSummary;
