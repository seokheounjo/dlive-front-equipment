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
  // 전화번호 유형 옵션 (레거시 ds_tel_no_gbn)
  interface PhoneOption {
    type: string;   // 유형명 (전화번호, 휴대폰, 요청번호, 접수번호)
    number: string; // 실제 번호
  }
  const [receiverPhone, setReceiverPhone] = useState('');
  const [phoneOptions, setPhoneOptions] = useState<PhoneOption[]>([]);  // 유형별 번호 옵션
  const [selectedPhoneType, setSelectedPhoneType] = useState('');  // 선택된 유형
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

  // Filter SMS message types based on WRK_CD (레거시 mowoa01p01.xml 로직)
  // WRK_CD='03' (A/S): WK + AS 메시지 모두 표시
  // 그 외: WK 메시지만 표시
  const filteredMessageTypes = useMemo(() => {
    const wrkCd = smsData?.WRK_CD || '';
    if (wrkCd === '03') {
      // A/S 작업: 모든 메시지 표시 (WK + AS)
      return SMS_MESSAGE_TYPES;
    } else {
      // 일반 작업: WK 메시지만 표시
      return SMS_MESSAGE_TYPES.filter(t => t.refCode === 'WK');
    }
  }, [smsData?.WRK_CD]);

  // 전화번호 정규화 (하이픈, 공백, 괄호 제거)
  const normalizePhone = (phone: string): string => {
    return phone.replace(/[-\s\(\)]/g, '');
  };

  // 전화번호 유효성 체크
  const isValidPhone = (phone: string): boolean => {
    const digits = normalizePhone(phone);
    return digits.length >= 9 && /^\d+$/.test(digits);
  };

  // 첫 번째 유효한 전화번호 추출 (한 필드에 여러 번호가 있을 수 있음)
  const extractFirstPhone = (phoneStr: string | undefined): string => {
    if (!phoneStr) return '';
    // [H], [O] 등 태그나 쉼표로 구분된 경우 첫 번째만
    const phones = phoneStr.split(/\s*\[[A-Z]\]|\s*[,\/]\s*/);
    for (const p of phones) {
      const trimmed = p.trim();
      if (isValidPhone(trimmed)) return trimmed;
    }
    return phoneStr.trim();
  };

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && smsData) {
      const initModal = async () => {
        setLoading(true);
        setError(null);

        // 전화번호 유형별 수집 (레거시 ds_tel_no_gbn 방식)
        const options: PhoneOption[] = [];
        const normalizedSet = new Set<string>();  // 중복 체크

        // 번호 추가 헬퍼
        const addOption = (type: string, phone: string | undefined) => {
          if (!phone) return;
          const firstPhone = extractFirstPhone(phone);
          if (!firstPhone || !isValidPhone(firstPhone)) return;
          const normalized = normalizePhone(firstPhone);
          if (normalizedSet.has(normalized)) return;
          normalizedSet.add(normalized);
          options.push({ type, number: firstPhone });
        };

        // 1. 계약정보에서 유형별 전화번호 조회
        if (smsData.CUST_ID) {
          try {
            const contractInfo = await getFullContractInfo({ CUST_ID: smsData.CUST_ID });
            const contract = contractInfo.currentContract || contractInfo.contracts?.[0];
            if (contract) {
              // 레거시 순서: 요청번호(3) → 휴대폰(2) → 전화번호(1)
              addOption('요청번호', (smsData as any).WORK_REQ_TEL_NO || contract.WORK_REQ_TEL_NO);
              addOption('접수번호', (smsData as any).REQ_CUST_TEL_NO || contract.REQ_CUST_TEL_NO);
              addOption('휴대폰', contract.TEL_NO2 || (smsData as any).CUST_TEL_NO2);
              addOption('전화번호', contract.TEL_NO1 || (smsData as any).CUST_TEL_NO1);
            }
          } catch (e) {
            console.error('[SMS] Failed to get phone from contract:', e);
          }
        }

        // 2. smsData에서 직접 전달된 번호가 있으면 추가
        if (smsData.SMS_RCV_TEL && options.length === 0) {
          addOption('연락처', smsData.SMS_RCV_TEL);
        }

        setPhoneOptions(options);
        // 첫 번째 옵션 선택
        if (options.length > 0) {
          setSelectedPhoneType(options[0].type);
          setReceiverPhone(options[0].number);
        } else {
          setSelectedPhoneType('');
          setReceiverPhone('');
        }

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

  // Extract hour and minute from WRK_HOPE_DTTM (supports multiple formats)
  // Legacy format: "YYYY-MM-DD HH:mm" (16 chars) - SubStr(8,2)=DD, SubStr(11,2)=HH, SubStr(14,2)=mm
  // Our format: "YYYYMMDDHHmm" (12 chars) - substring(8,10)=HH, substring(10,12)=mm
  // ISO format: "YYYY-MM-DDTHH:mm:ss" (19 chars)
  const extractTimeFromDttm = (dttm: string): { hour: string; minute: string } => {
    if (!dttm) return { hour: '', minute: '' };

    // Format: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss" (with space)
    if (dttm.includes(' ') && dttm.length >= 16) {
      return {
        hour: dttm.substring(11, 13),    // HH
        minute: dttm.substring(14, 16),  // mm
      };
    }

    // Format: "YYYY-MM-DDTHH:mm:ss" (ISO with T)
    if (dttm.includes('T') && dttm.length >= 16) {
      return {
        hour: dttm.substring(11, 13),    // HH
        minute: dttm.substring(14, 16),  // mm
      };
    }

    // Format: "YYYYMMDDHHmm" (12 chars, no separators)
    if (dttm.length >= 12 && !dttm.includes('-')) {
      return {
        hour: dttm.substring(8, 10),     // HH
        minute: dttm.substring(10, 12),  // mm
      };
    }

    return { hour: '', minute: '' };
  };

  // Generate message based on type (Legacy fn_wrk_sms_contents from mowoa01p01.xml)
  const generateMessage = (msgType: string, data: SmsSendData) => {
    if (!data) return;

    // SO_ID 328 = 서초디지털방송
    const soNm = data.SO_ID === '328' ? '[서초디지털방송]' : '[딜라이브]';
    const wrkHopeDttm = data.WRK_HOPE_DTTM || '';
    const { hour: wrkTt, minute: wrkMm } = extractTimeFromDttm(wrkHopeDttm);
    const wrkrNmEn = data.WRKR_NM_EN || data.WRKR_NM || '';
    const wrkCdNm = data.WRK_CD_NM || '';
    const telNo = data.SMS_SEND_TEL || '';

    let msg = '';

    if (msgType === '020') {
      // 방문안내문자 (Legacy mowoa01p01.xml)
      // PILOT_SO_ID: 100,600,327,210 (대전, 일산, 중앙, 경기)
      const PILOT_SO_ID = ['100', '600', '327', '210'];
      const isPilotSo = PILOT_SO_ID.includes(data.SO_ID) && data.SO_ID !== '201';

      msg = `${soNm} 방문안내\n\n`;
      msg += `안녕하세요! 고객과 함께하는 '딜라이브'입니다.\n`;
      msg += `예약하신 작업을 위해 아래와 같이 CS매니저가 방문드릴 예정입니다.\n\n`;
      msg += `▶작업유형 : ${wrkCdNm}\n`;
      // 레거시: PILOT_SO_ID이고 SO_ID != 201이면 "시 분경", 그 외 "시경"
      if (isPilotSo) {
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
      // 지연양해문자 (레거시: 사용자가 몇 분인지 직접 입력)
      msg = `${soNm} 앞작업의 지연으로 약속시간보다 분 늦겠사오니 양해바랍니다.`;
    } else if (msgType === '027') {
      // 전화부재안내 (레거시: 시간 없이 "시경에"만)
      msg = `${soNm} 시경에 ${wrkrNmEn}기사가 방문시간 안내 차 전화드렸습니다.(부재안내)`;
    } else if (msgType === '028') {
      // 방문부재안내 (레거시: 시간 없이 "시경에"만)
      msg = `${soNm} 시경에 ${wrkrNmEn} 기사 방문시 부재로 ${wrkCdNm} 처리를 못하고 갑니다.`;
    } else if (msgType === '138') {
      // AS 전용: 장애복구안내
      msg = `${soNm}장애가 복구되었습니다. 확인후 이용불가시 연락바랍니다.`;
    } else if (msgType === '139') {
      // AS 전용: 망장애안내
      const senderTel = telNo.replace(/-/g, '').replace(/ /g, '');
      msg = `${soNm}AS신청하신 지역에 장애가 발생하여 외부조치중입니다.점검후 연락예정:${senderTel}`;
    } else if (msgType === '141') {
      // AS 전용: 현장마케팅수신동의
      msg = `${soNm} 고객정보 업데이트 안내\n\n`;
      msg += `항상 고객님의 행복을 생각하는 딜라이브입니다.\n\n`;
      msg += `고객님의 기호에 맞는 맞춤 서비스 제공과 최신 콘텐츠 정보, 이벤트 정보등의 `;
      msg += `정보제공을 위해 고객님의 고객정보를 업데이트 요청드립니다. 아래 URL을 클릭하시고 `;
      msg += `설명에 따라 주시기 바랍니다.\n\n`;
      msg += `저희 딜라이브는 고객님의 소중한 개인정보를 보호하는데 최선의 노력을 다할 것을 다시한번 약속 드립니다. 감사합니다.`;
    } else if (msgType === '059_002') {
      // KB국민카드신청안내
      msg = `${soNm} KB국민카드 신청 안내\n\n`;
      msg += `1. 카드혜택\n`;
      msg += `https://m.dlive.kr/mobile/event/JoinAction.do?method=view\n`;
      msg += `2. 신분증을 미리 준비하시고, 아래 URL을 통해 발급 신청해 주세요. (브라우저 호환을 위해 팝업차단 해제 필요)\n`;
      msg += `3. 카드 발급 후 딜라이브 고객센터(1644-1100)로 딜라이브 요금 자동이체를 꼭 신청해 주세요.\n`;
      msg += `4. 아래 링크를 복사해서 지인에게 전달해 주세요. 발급시 동일한 혜택을 드립니다!\n\n`;
      msg += `<고객님만의 전용 신청 링크>\n`;
      msg += `https://m.kbcard.com/CXHIACRC0002.cms?mainCC=b&allianceCode=04345&solicitorcode=702${userId}\n`;
    } else if (msgType === '059') {
      // 더심플하나카드URL안내
      const custIdSuffix = (data.CUST_ID || '').slice(-5);
      msg = `${soNm} 더 심플 하나카드 신청 안내\n\n`;
      msg += `1. 카드혜택\n`;
      msg += `https://m.dlive.kr/mobile/event/JoinAction.do?method=view\n`;
      msg += `2. 신분증을 미리 준비하시고, 아래 URL을 통해 발급 신청해 주세요. (브라우저 호환을 위해 팝업차단 해제 필요)\n`;
      msg += `3. 카드 발급 후 딜라이브 고객센터(1644-1100)로 딜라이브 요금 자동이체를 꼭 신청해 주세요.\n`;
      msg += `4. 아래 링크를 복사해서 지인에게 전달해 주세요. 발급시 동일한 혜택을 드립니다!\n\n`;
      msg += `<고객님만의 전용 신청 링크>\n`;
      msg += `https://m.hanacard.co.kr/MPACMM101M.web?_frame=no&CD_PD_SEQ=17176&eno=${userId}&${custIdSuffix}`;
    } else if (msgType === '235') {
      // (제휴)하나렌탈플러스카드
      msg = `${soNm} 렌탈플러스 하나카드 신청 안내\n\n`;
      msg += `1. 카드혜택\n`;
      msg += `https://m.dlive.kr/mobile/event/JoinAction.do?method=view\n`;
      msg += `2. 신분증을 미리 준비하시고, 아래 URL을 통해 발급 신청해 주세요. (브라우저 호환을 위해 팝업차단 해제 필요)\n`;
      msg += `3. 카드 발급 후 딜라이브 고객센터(1644-1100)로 딜라이브 요금 자동이체를 꼭 신청해 주세요.\n`;
      msg += `4. 아래 링크를 복사해서 지인에게 전달해 주세요. 발급시 동일한 혜택을 드립니다!\n\n`;
      msg += `<고객님만의 전용 신청 링크>\n`;
      msg += `https://m.hanacard.co.kr/MPACMM101M.web?_frame=no&CD_PD_SEQ=18122&eno=${userId}\n\n`;
      msg += `하나카드 고객센터☎1800-0170`;
    } else if (msgType === '059_005') {
      // (제휴)롯데로카SE카드
      const custId = data.CUST_ID || '';
      msg = `${soNm} 롯데 LOCA X Special SE 카드 신청 안내\n\n`;
      msg += `1. 카드혜택\n`;
      msg += `https://m.dlive.kr/front/join/join/DiscountAction.do?method=view\n`;
      msg += `2. 신분증을 미리 준비하시고, 아래 URL을 통해 발급 신청해 주세요. (브라우저 호환을 위해 팝업차단 해제 필요)\n`;
      msg += `3. 카드 발급 후 딜라이브 고객센터(1644-1100)로 딜라이브 요금 자동이체를 꼭 신청해 주세요.\n`;
      msg += `4. 아래 링크를 복사해서 지인에게 전달해 주세요. 발급시 동일한 혜택을 드립니다!\n\n`;
      msg += `<고객님만의 전용 신청 링크>\n`;
      msg += `http://m.lottecard.co.kr/spa/card/booth?bId=96893&vtCdKndC=P13791-A13791&cInfo=${custId}${userId}\n`;
    } else if (msgType === '271') {
      // AS 전용: 고객센터안내
      msg = `[딜라이브] 고객센터 1644-1100 입니다. 감사합니다.`;
    }

    setMessageContent(msg);
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

        {/* Receiver phone - 유형 Select + 번호 표시 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            수신번호
          </label>
          {phoneOptions.length > 1 ? (
            // 여러 유형이 있으면 Select로 유형 선택 + 오른쪽에 번호 표시
            <div className="flex items-center gap-2">
              <div className="w-24 flex-shrink-0">
                <Select
                  value={selectedPhoneType}
                  onValueChange={(value) => {
                    setSelectedPhoneType(value);
                    const option = phoneOptions.find(o => o.type === value);
                    if (option) setReceiverPhone(option.number);
                  }}
                  options={phoneOptions.map((opt) => ({
                    value: opt.type,
                    label: opt.type
                  }))}
                  placeholder="유형"
                />
              </div>
              <input
                type="tel"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
          ) : (
            // 하나거나 없으면 input만
            <input
              type="tel"
              value={receiverPhone}
              onChange={(e) => setReceiverPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          )}
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
              // 카드/대표번호 유형 선택 시 발신번호를 1644-1100으로 변경 (레거시 로직)
              const cardTypes = ['059_002', '059', '235', '059_005', '271'];
              if (cardTypes.includes(value)) {
                setSenderPhone('1644-1100');
              }
            }}
            options={filteredMessageTypes.map((type) => ({
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
