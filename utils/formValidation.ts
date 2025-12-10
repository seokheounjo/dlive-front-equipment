/**
 * 폼 입력 검증 유틸리티 함수
 *
 * 다양한 입력값의 형식과 유효성을 검증하는 함수들을 제공합니다.
 */

/**
 * 한국 전화번호 형식 검증
 *
 * 허용 형식:
 * - 010-1234-5678
 * - 01012345678
 * - 02-1234-5678
 * - 0212345678
 *
 * @param phone 검증할 전화번호 문자열
 * @returns 유효한 전화번호이면 true
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // 공백 제거
  const cleaned = phone.replace(/\s/g, '');

  // 하이픈 포함 형식: 010-1234-5678, 02-1234-5678
  const withHyphenPattern = /^0\d{1,2}-\d{3,4}-\d{4}$/;

  // 하이픈 없는 형식: 01012345678, 0212345678
  const withoutHyphenPattern = /^0\d{9,10}$/;

  return withHyphenPattern.test(cleaned) || withoutHyphenPattern.test(cleaned);
};

/**
 * 날짜 형식 검증 (YYYYMMDD)
 *
 * @param dateStr 검증할 날짜 문자열 (예: "20250130")
 * @returns 유효한 날짜 형식이면 true
 */
export const isValidDate = (dateStr: string): boolean => {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }

  // YYYYMMDD 형식 체크
  const pattern = /^\d{8}$/;
  if (!pattern.test(dateStr)) {
    return false;
  }

  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);

  // 년도 범위 체크 (1900 ~ 2100)
  if (year < 1900 || year > 2100) {
    return false;
  }

  // 월 범위 체크
  if (month < 1 || month > 12) {
    return false;
  }

  // 일 범위 체크
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return false;
  }

  return true;
};

/**
 * 장비 시리얼 번호 형식 검증
 *
 * 허용 형식: 영문(대소문자) + 숫자 조합, 최소 6자 이상
 *
 * @param serial 검증할 시리얼 번호
 * @returns 유효한 시리얼 번호이면 true
 */
export const isValidSerialNumber = (serial: string): boolean => {
  if (!serial || typeof serial !== 'string') {
    return false;
  }

  // 최소 6자 이상, 영문과 숫자만 허용 (하이픈 포함 가능)
  const pattern = /^[A-Za-z0-9\-]{6,}$/;

  // 패턴 검증 + 최소 하나의 영문과 숫자 포함 확인
  if (!pattern.test(serial)) {
    return false;
  }

  const hasLetter = /[A-Za-z]/.test(serial);
  const hasNumber = /[0-9]/.test(serial);

  return hasLetter && hasNumber;
};

/**
 * 주소 형식 검증
 *
 * 최소 길이 10자 이상, 한글/영문/숫자 포함
 *
 * @param address 검증할 주소
 * @returns 유효한 주소이면 true
 */
export const isValidAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') {
    return false;
  }

  const trimmed = address.trim();

  // 최소 길이 체크
  if (trimmed.length < 10) {
    return false;
  }

  // 한글, 영문, 숫자가 포함되어 있는지 확인 (최소 하나 이상)
  const hasValidChars = /[가-힣a-zA-Z0-9]/.test(trimmed);

  return hasValidChars;
};

/**
 * 이름 형식 검증
 *
 * 한글 또는 영문, 2-20자
 *
 * @param name 검증할 이름
 * @returns 유효한 이름이면 true
 */
export const isValidName = (name: string): boolean => {
  if (!name || typeof name !== 'string') {
    return false;
  }

  const trimmed = name.trim();

  // 길이 체크 (2-20자)
  if (trimmed.length < 2 || trimmed.length > 20) {
    return false;
  }

  // 한글 이름: 2-10자
  const koreanPattern = /^[가-힣]{2,10}$/;
  // 영문 이름: 2-20자 (공백 허용)
  const englishPattern = /^[a-zA-Z\s]{2,20}$/;

  return koreanPattern.test(trimmed) || englishPattern.test(trimmed);
};

/**
 * 전화번호 포맷팅
 *
 * 입력된 전화번호를 하이픈이 포함된 형식으로 변환
 *
 * @param phone 포맷팅할 전화번호
 * @returns 포맷팅된 전화번호 (예: "010-1234-5678")
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) {
    return '';
  }

  // 숫자만 추출
  const numbers = phone.replace(/\D/g, '');

  if (numbers.length === 0) {
    return phone;
  }

  // 010으로 시작하는 휴대폰 번호
  if (numbers.startsWith('010') && numbers.length === 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  }

  // 02로 시작하는 서울 번호
  if (numbers.startsWith('02')) {
    if (numbers.length === 9) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
    } else if (numbers.length === 10) {
      return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    }
  }

  // 기타 지역번호 (031, 032 등)
  if (numbers.length === 10) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  } else if (numbers.length === 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  }

  // 포맷팅할 수 없는 경우 원본 반환
  return phone;
};

/**
 * 날짜 포맷팅
 *
 * YYYYMMDD 형식을 YYYY-MM-DD 형식으로 변환
 *
 * @param dateStr 포맷팅할 날짜 문자열 (예: "20250130")
 * @returns 포맷팅된 날짜 문자열 (예: "2025-01-30")
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') {
    return '';
  }

  // 숫자만 추출
  const numbers = dateStr.replace(/\D/g, '');

  if (numbers.length !== 8) {
    return dateStr;
  }

  const year = numbers.slice(0, 4);
  const month = numbers.slice(4, 6);
  const day = numbers.slice(6, 8);

  return `${year}-${month}-${day}`;
};

/**
 * 이메일 형식 검증
 *
 * @param email 검증할 이메일 주소
 * @returns 유효한 이메일이면 true
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
};

/**
 * 비고/메모 입력 검증
 *
 * @param memo 검증할 메모 내용
 * @param minLength 최소 길이 (기본값: 10)
 * @param maxLength 최대 길이 (기본값: 500)
 * @returns 검증 결과
 */
export const isValidMemo = (
  memo: string,
  minLength: number = 10,
  maxLength: number = 500
): { valid: boolean; message?: string } => {
  if (!memo || typeof memo !== 'string') {
    return { valid: false, message: '메모를 입력해주세요.' };
  }

  const trimmed = memo.trim();

  if (trimmed.length < minLength) {
    return { valid: false, message: `최소 ${minLength}자 이상 입력해주세요. (현재 ${trimmed.length}자)` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, message: `최대 ${maxLength}자까지 입력 가능합니다. (현재 ${trimmed.length}자)` };
  }

  return { valid: true };
};

/**
 * 우편번호 형식 검증 (5자리 또는 6자리)
 *
 * @param zipCode 검증할 우편번호
 * @returns 유효한 우편번호이면 true
 */
export const isValidZipCode = (zipCode: string): boolean => {
  if (!zipCode || typeof zipCode !== 'string') {
    return false;
  }

  const numbers = zipCode.replace(/\D/g, '');

  // 5자리 신우편번호 또는 6자리 구우편번호
  return numbers.length === 5 || numbers.length === 6;
};

/**
 * 사업자등록번호 형식 검증
 *
 * @param businessNumber 검증할 사업자등록번호 (10자리)
 * @returns 유효한 사업자등록번호이면 true
 */
export const isValidBusinessNumber = (businessNumber: string): boolean => {
  if (!businessNumber || typeof businessNumber !== 'string') {
    return false;
  }

  const numbers = businessNumber.replace(/\D/g, '');

  // 10자리 검증
  if (numbers.length !== 10) {
    return false;
  }

  // 체크섬 검증
  const checksum = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i], 10) * checksum[i];
  }

  sum += Math.floor((parseInt(numbers[8], 10) * 5) / 10);
  const checkDigit = (10 - (sum % 10)) % 10;

  return checkDigit === parseInt(numbers[9], 10);
};

/**
 * 숫자만 입력 검증
 *
 * @param value 검증할 값
 * @returns 숫자만 포함되어 있으면 true
 */
export const isNumericOnly = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }

  return /^\d+$/.test(value);
};

/**
 * 범위 내 숫자 검증
 *
 * @param value 검증할 숫자
 * @param min 최소값
 * @param max 최대값
 * @returns 범위 내 숫자이면 true
 */
export const isNumberInRange = (
  value: number | string,
  min: number,
  max: number
): boolean => {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return false;
  }

  return num >= min && num <= max;
};
