import React, { useState, useEffect } from 'react';
import { getUplsLdapRslt } from '../../services/certifyApiService';
import BaseModal from '../common/BaseModal';
import { formatId } from '../../utils/dateFormatter';
import '../../styles/buttons.css';

interface LdapQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctrtId: string;
}

interface LdapRecord {
  ONT_EQT_NO?: string;
  ONT_MAC_ADDR?: string;
  AP_EQT_NO?: string;
  AP_MAC_ADDR?: string;
  PROC_DV_CD?: string;
  PRSS_RSLT_CD?: string;
  PRSS_RSLT_MSG?: string;
  REG_DTTM?: string;
  [key: string]: any;
}

const LdapQueryModal: React.FC<LdapQueryModalProps> = ({
  isOpen,
  onClose,
  ctrtId,
}) => {
  const [records, setRecords] = useState<LdapRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLdapResult = async () => {
    if (!ctrtId) {
      console.error('[LDAP조회] 계약ID가 없습니다');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[LDAP조회] 조회 시작 CTRT_ID:', ctrtId);
      const result = await getUplsLdapRslt(ctrtId);
      console.log('[LDAP조회] 조회 완료:', result);

      setRecords(result.data || []);
    } catch (err) {
      console.error('[LDAP조회] 조회 실패:', err);
      setError(err instanceof Error ? err.message : '조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && ctrtId) {
      fetchLdapResult();
    }
  }, [isOpen, ctrtId]);

  const subHeader = (
    <div className="text-xs text-gray-700 space-y-0.5">
      <div className="whitespace-nowrap">
        <span className="text-gray-600">계약ID:</span>{' '}
        <span className="font-medium text-blue-700">{formatId(ctrtId)}</span>
      </div>
      <div className="text-gray-600">LGU+ LDAP 연동 결과</div>
    </div>
  );

  const footer = (
    <button onClick={onClose} className="btn btn-secondary btn-sm">
      닫기
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="LDAP조회"
      size="medium"
      subHeader={subHeader}
      footer={footer}
    >
      <div>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 text-xs">조회 중...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8 px-4">
            <div className="text-red-500 text-xs text-center">{error}</div>
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 text-xs">LDAP 연동이력이 없습니다</div>
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <div className="space-y-2.5 p-2.5">
            {records.map((record, index) => (
              <div
                key={index}
                className={`rounded-lg border shadow-sm p-2.5 ${
                  index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="space-y-1.5">
                  {record.ONT_EQT_NO && (
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">ONT 장비번호:</span> {record.ONT_EQT_NO}
                      </div>
                    </div>
                  )}
                  {record.ONT_MAC_ADDR && (
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">ONT MAC:</span> {record.ONT_MAC_ADDR}
                      </div>
                    </div>
                  )}
                  {record.AP_EQT_NO && (
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">AP 장비번호:</span> {record.AP_EQT_NO}
                      </div>
                    </div>
                  )}
                  {record.AP_MAC_ADDR && (
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">AP MAC:</span> {record.AP_MAC_ADDR}
                      </div>
                    </div>
                  )}
                  {record.PROC_DV_CD && (
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">처리구분:</span> {record.PROC_DV_CD}
                      </div>
                    </div>
                  )}
                  {record.PRSS_RSLT_CD && (
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">처리결과:</span>{' '}
                        <span className={record.PRSS_RSLT_CD === '0000' ? 'text-green-600' : 'text-red-600'}>
                          {record.PRSS_RSLT_CD}
                        </span>
                      </div>
                    </div>
                  )}
                  {record.PRSS_RSLT_MSG && (
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">결과메시지:</span> {record.PRSS_RSLT_MSG}
                      </div>
                    </div>
                  )}
                  {record.REG_DTTM && (
                    <div className="bg-white rounded px-2.5 py-1.5 border border-gray-100">
                      <div className="text-xs text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">등록일시:</span> {record.REG_DTTM}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export default LdapQueryModal;
