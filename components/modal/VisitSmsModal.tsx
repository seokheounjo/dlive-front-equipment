import React, { useState, useEffect, useMemo } from 'react';
import { Send } from 'lucide-react';
import BaseModal from '../common/BaseModal';
import Select from '../ui/Select';
import { sendVisitSms, getFullContractInfo } from '../../services/apiService';
import { SmsSendData, SMS_MESSAGE_TYPES, VisitSmsRequest } from '../../types';
import '../../styles/buttons.css';

interface VisitSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  smsData: SmsSendData | null;
  userId: string;  // REG_UID (current user id)
}

/**
 * VisitSmsModal - SMS Modal (Legacy mowoa01p01.xml)
 *
 * Features:
 * - Message type select (Visit, Delay, NoAnswer, Complete)
 * - Message preview and edit
 * - Byte counter (max 88 bytes for standard SMS template)
 * - Phone number validation
 */
const VisitSmsModal: React.FC<VisitSmsModalProps> = ({
  isOpen,
  onClose,
  smsData,
  userId
}) => {
  const [receiverPhone, setReceiverPhone] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [messageType, setMessageType] = useState('020');  // Default: Visit notification
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);  // Loading state for fetching phone
  const [error, setError] = useState<string | null>(null);

  // Calculate byte length (Korean = 2 bytes, ASCII = 1 byte)
  const byteLength = useMemo(() => {
    let bytes = 0;
    for (let i = 0; i < messageContent.length; i++) {
      const charCode = messageContent.charCodeAt(i);
      bytes += charCode > 127 ? 2 : 1;
    }
    return bytes;
  }, [messageContent]);

  // Max byte limit for SMS template (legacy: 88)
  const maxBytes = 2000;  // LMS allows longer messages
  const isOverLimit = byteLength > maxBytes;

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && smsData) {
      const initModal = async () => {
        setLoading(true);
        setError(null);

        // 수신번호: smsData에 있으면 사용, 없으면 계약정보에서 조회
        let rcvTel = smsData.SMS_RCV_TEL || '';

        if (!rcvTel && smsData.CUST_ID) {
          try {
            const contractInfo = await getFullContractInfo({ CUST_ID: smsData.CUST_ID });
            // currentContract 우선, 없으면 contracts 배열 첫 번째 항목
            const contract = contractInfo.currentContract || contractInfo.contracts?.[0];
            if (contract) {
              // TEL_NO2 (휴대폰) 우선, 없으면 TEL_NO1
              rcvTel = contract.TEL_NO2 || contract.TEL_NO1 || '';
            }
          } catch (e) {
            console.error('[SMS] Failed to get phone from contract:', e);
          }
        }
        setReceiverPhone(rcvTel);

        // 발신번호: localStorage userInfo.telNo2 사용 (레거시 gds_user.TEL_NO2)
        let senderTel = smsData.SMS_SEND_TEL || '';
        if (!senderTel) {
          try {
            const userInfoStr = localStorage.getItem('userInfo');
            if (userInfoStr) {
              const user = JSON.parse(userInfoStr);
              senderTel = user.telNo2 || '';
            }
          } catch (e) {
            console.error('[SMS] Failed to get telNo2 from userInfo:', e);
          }
        }
        setSenderPhone(senderTel);

        setMessageType('020');
        generateMessage('020', smsData);
        setLoading(false);
      };

      initModal();
    }
  }, [isOpen, smsData]);

  // Generate message based on type (Legacy fn_wrk_sms_contents from mowoa01p01.xml)
  const generateMessage = (msgType: string, data: SmsSendData) => {
    if (!data) return;

    // SO_ID 328 = 서초디지털방송
    const soNm = data.SO_ID === '328' ? '[서초디지털방송]' : '[딜라이브]';
    const wrkHopeDttm = data.WRK_HOPE_DTTM || '';
    const wrkTt = wrkHopeDttm.length >= 10 ? wrkHopeDttm.substring(8, 10) : '';  // Hour
    const wrkMm = wrkHopeDttm.length >= 12 ? wrkHopeDttm.substring(10, 12) : ''; // Minute
    const wrkrNmEn = data.WRKR_NM_EN || data.WRKR_NM || '';
    const wrkCdNm = data.WRK_CD_NM || '';
    const telNo = data.SMS_SEND_TEL || '';

    let msg = '';

    if (msgType === '020') {
      // 방문안내문자 (Legacy mowoa01p01.xml)
      msg = `${soNm} 방문안내\n\n`;
      msg += `안녕하세요! 고객과 함께하는 '딜라이브'입니다.\n`;
      msg += `예약하신 작업을 위해 아래와 같이 CS매니저가 방문드릴 예정입니다.\n\n`;
      msg += `▶작업유형 : ${wrkCdNm}\n`;
      // 분이 있으면 "시 분경", 없으면 "시경"
      if (wrkMm && wrkMm !== '00') {
        msg += `▶방문일정 : ${wrkTt}시 ${wrkMm}분경\n`;
      } else {
        msg += `▶방문일정 : ${wrkTt}시경\n`;
      }
      msg += `* CS매니저가 사전에 연락 후 방문드리겠습니다.\n`;
      msg += `▶서비스담당자 : ${wrkrNmEn} CS매니저 ${telNo}\n\n`;
      msg += `[안내사항]\n`;
      msg += `* 파손 및 안전사고 예방을 위해 설치 공간 주변 물건을 미리 정리해주세요.\n`;
      msg += `* CS매니저 방문으로 인해 반려동물이 놀라지 않도록 안전한 장소에서 반려동물을 보호해주세요.\n`;
      msg += `* CS매니저는 누군가의 소중한 가족입니다. 따뜻한 배려로 존중해주세요.\n`;
    } else if (msgType === '021') {
      // 지연양해문자
      msg = `${soNm} 앞작업의 지연으로 약속시간보다 늦겠사오니 양해바랍니다.`;
    } else if (msgType === '027') {
      // 전화부재안내
      msg = `${soNm} ${wrkTt}시경에 ${wrkrNmEn}기사가 방문시간 안내 차 전화드렸습니다.(부재안내)`;
    } else if (msgType === '028') {
      // 방문부재안내
      msg = `${soNm} ${wrkTt}시경에 ${wrkrNmEn} 기사 방문시 부재로 ${wrkCdNm} 처리를 못하고 갑니다.`;
    }

    setMessageContent(msg);
  };

  // Validate phone number (must start with 010, 011, 016, 017, 018, 019)
  const isValidPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/-/g, '').replace(/\s/g, '');
    if (cleaned.length < 10) return false;
    const prefix = cleaned.substring(0, 3);
    return ['010', '011', '016', '017', '018', '019'].includes(prefix);
  };

  // Handle send SMS
  const handleSend = async () => {
    if (!smsData) {
      setError('SMS data missing');
      return;
    }

    // Validation
    if (!isValidPhone(receiverPhone)) {
      setError('유효한 휴대폰 번호를 입력해주세요. (010, 011 등)');
      return;
    }

    if (!senderPhone.trim()) {
      setError('발신번호를 입력해주세요.');
      return;
    }

    if (!messageContent.trim()) {
      setError('메시지 내용을 입력해주세요.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const msgTypeInfo = SMS_MESSAGE_TYPES.find(t => t.code === messageType);

      const request: VisitSmsRequest = {
        SMS_EML_TYPE: messageType.substring(0, 3),
        SO_ID: smsData.SO_ID,
        USER_SMS: receiverPhone,
        SEND_SMS: senderPhone,
        USER_ID: smsData.CUST_ID,
        USER_NAME: smsData.CUST_NM,
        MAP01: messageContent,
        KKO_MSG_ID: msgTypeInfo?.kkoMsgId || 'KKO020_003',
        REG_UID: userId,
        TRANS_YN: 'N',
        SMS_EML_CL: '20'
      };

      const result = await sendVisitSms(request);

      if (result.code === 'SUCCESS') {
        alert('문자 발송이 완료되었습니다.');
        onClose();
      } else {
        setError(result.message || '문자 발송에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('[SMS] Send error:', err);
      setError(err.message || '문자 발송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  // Footer with buttons
  const footer = (
    <div className="flex gap-2 w-full">
      <button
        onClick={onClose}
        className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        disabled={sending}
      >
        닫기
      </button>
      <button
        onClick={handleSend}
        disabled={sending || isOverLimit}
        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {sending ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            발송중...
          </>
        ) : (
          <>
            <Send size={16} />
            발송
          </>
        )}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="방문안내문자"
      size="medium"
      footer={loading ? undefined : footer}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-500 text-sm">정보를 불러오는 중...</p>
        </div>
      ) : (
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Customer info */}
        {smsData && (
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">고객명</span>
              <span className="font-medium">{smsData.CUST_NM}</span>
            </div>
            {smsData.WRK_CD_NM && (
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">작업유형</span>
                <span className="font-medium">{smsData.WRK_CD_NM}</span>
              </div>
            )}
          </div>
        )}

        {/* Receiver phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            수신번호
          </label>
          <input
            type="tel"
            value={receiverPhone}
            onChange={(e) => setReceiverPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Sender phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            발신번호
          </label>
          <input
            type="tel"
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Message type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            메시지유형
          </label>
          <Select
            value={messageType}
            onValueChange={(value) => {
              setMessageType(value);
              if (smsData) {
                generateMessage(value, smsData);
              }
            }}
            options={SMS_MESSAGE_TYPES.map((type) => ({
              value: type.code,
              label: type.name
            }))}
            placeholder="메시지 유형 선택"
          />
        </div>

        {/* Message content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            메시지 내용
          </label>
          <textarea
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            rows={8}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            placeholder="메시지 내용을 입력하세요"
          />
          <div className={`mt-1 text-right text-sm ${isOverLimit ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {byteLength} / {maxBytes} bytes
            {isOverLimit && ' (초과)'}
          </div>
        </div>
      </div>
      )}
    </BaseModal>
  );
};

export default VisitSmsModal;
