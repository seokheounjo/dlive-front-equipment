/**
 * 날짜/시간 포맷 유틸리티
 * YYYYMMDDHHMM 형식이나 ISO 형식의 날짜를 사용자 친화적으로 표시
 */

/**
 * YYYYMMDDHHMM 형식을 "11월 5일 오후 2:00" 형식으로 변환
 * @param dateTimeStr - YYYYMMDDHHMM 형식의 날짜/시간 문자열
 * @returns 포맷된 날짜/시간 문자열 (예: "11월 5일 오후 2:00")
 */
export const formatDateTime = (dateTimeStr: string): string => {
  if (!dateTimeStr || dateTimeStr.length < 12) return '시간 정보 없음';

  try {
    // YYYYMMDDHHMM 형식을 파싱
    const year = dateTimeStr.slice(0, 4);
    const month = dateTimeStr.slice(4, 6);
    const day = dateTimeStr.slice(6, 8);
    const hour = dateTimeStr.slice(8, 10);
    const minute = dateTimeStr.slice(10, 12);

    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);

    if (isNaN(date.getTime())) return '시간 정보 없음';

    // 월/일 추출
    const monthNum = date.getMonth() + 1;
    const dayNum = date.getDate();

    // 시간 추출 (12시간제)
    let hourNum = date.getHours();
    const ampm = hourNum >= 12 ? '오후' : '오전';
    hourNum = hourNum % 12 || 12;
    const minuteStr = date.getMinutes().toString().padStart(2, '0');

    return `${monthNum}월 ${dayNum}일 ${ampm} ${hourNum}:${minuteStr}`;
  } catch (e) {
    return '시간 정보 없음';
  }
};

/**
 * ISO 날짜 문자열을 "11월 5일" 형식으로 변환
 * @param isoString - ISO 형식의 날짜 문자열
 * @returns 포맷된 날짜 문자열 (예: "11월 5일")
 */
export const formatDate = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '날짜 정보 없음';

    const monthNum = date.getMonth() + 1;
    const dayNum = date.getDate();

    return `${monthNum}월 ${dayNum}일`;
  } catch (e) {
    return '날짜 정보 없음';
  }
};

/**
 * ISO 날짜 문자열을 "오후 2:00" 형식으로 변환
 * @param isoString - ISO 형식의 날짜 문자열
 * @returns 포맷된 시간 문자열 (예: "오후 2:00")
 */
export const formatTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '시간 정보 없음';

    let hourNum = date.getHours();
    const ampm = hourNum >= 12 ? '오후' : '오전';
    hourNum = hourNum % 12 || 12;
    const minuteStr = date.getMinutes().toString().padStart(2, '0');

    return `${ampm} ${hourNum}:${minuteStr}`;
  } catch (e) {
    return '시간 정보 없음';
  }
};

/**
 * ISO 날짜 문자열을 "11월 5일 오후 2:00" 형식으로 변환
 * @param isoString - ISO 형식의 날짜 문자열
 * @returns 포맷된 날짜/시간 문자열 (예: "11월 5일 오후 2:00")
 */
export const formatDateTimeFromISO = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '시간 정보 없음';

    const monthNum = date.getMonth() + 1;
    const dayNum = date.getDate();

    let hourNum = date.getHours();
    const ampm = hourNum >= 12 ? '오후' : '오전';
    hourNum = hourNum % 12 || 12;
    const minuteStr = date.getMinutes().toString().padStart(2, '0');

    return `${monthNum}월 ${dayNum}일 ${ampm} ${hourNum}:${minuteStr}`;
  } catch (e) {
    return '시간 정보 없음';
  }
};

/**
 * 10자리 ID를 xxx-xxx-xxxx 형식으로 포맷팅
 * @param id - 10자리 숫자 ID (예: "1234567890")
 * @returns 포맷된 ID 문자열 (예: "123-456-7890")
 */
export const formatId = (id: string | number | undefined | null): string => {
  if (!id) return '-';

  const idStr = String(id).replace(/\D/g, ''); // 숫자만 추출

  if (idStr.length !== 10) {
    // 10자리가 아니면 원본 반환
    return String(id);
  }

  // 3-3-4 형식으로 포맷팅
  return `${idStr.slice(0, 3)}-${idStr.slice(3, 6)}-${idStr.slice(6, 10)}`;
};
