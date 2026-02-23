/**
 * LGU+/FTTH Certify 전용 상태 관리 Store
 * workProcessStore.ts에서 분리된 인증상품 전용 상태
 *
 * - certifyRegconfInfo: 집선등록 데이터 (CL-03 조회 결과)
 * - ldapResult: LDAP 연동 결과
 * - certifyProdList: 인증 대상 상품 코드 목록
 * - isCertifyProd: 현재 작업이 인증상품인지 여부
 * - certifyOpLnkdCd: 통신방식 코드 (F/FG/Z/ZG=FTTH, N/NG=와이드)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 집선등록 데이터 (레거시: ds_lgu_regconfinfo)
export interface CertifyRegconfInfo {
  T?: string;           // 타입 (L2-IP-PORT, ONT 등)
  ONT_MAC?: string;     // ONT MAC 주소
  ONT_SERIAL?: string;  // ONT 시리얼
  AP_MAC?: string;      // AP MAC 주소
  DEV_ID?: string;      // 장치 ID
  IP?: string;          // IP 주소
  PORT?: string;        // 포트 번호
  MAX_SPEED?: string;   // 최고속도
  ST?: string;          // 상태
  CONT_ID?: string;     // 계약 ID
  // L2/RN equipment info
  EQIP_ID?: string;         // L2/RN 장비번호
  EQIP_PORT_NO?: string;    // L2/RN 포트번호
  EQIP_DIVS?: string;       // 장비구분 (L2 or OLT)
  // FTTH OLT info (mowouDivG01)
  OLT_ID?: string;           // OLT 장비 ID
  OLT_PORT?: string;         // OLT 포트번호
  // FTTH port validation
  EQIP_PORT_USE?: string;    // 포트 사용여부 (PT_USE)
  PORT_ENTR_NO?: string;     // 포트 가입자번호 (중복 검증용)
  DEL_YN?: string;           // 삭제여부 (항상 "N")
}

// LDAP 연동 결과 (LGU+ 전용)
export interface LdapResult {
  ONT_EQT_NO?: string;     // ONT 장비 번호
  ONT_MAC_ADDR?: string;   // ONT MAC 주소
  AP_EQT_NO?: string;      // AP 장비 번호
  AP_MAC_ADDR?: string;    // AP MAC 주소
  PROC_DV_CD?: string;     // 처리 구분 코드
  PRSS_RSLT_CD?: string;   // 처리 결과 코드
  [key: string]: any;
}

interface CertifyStore {
  // 집선등록 데이터 (CL-03 조회 결과)
  certifyRegconfInfo: CertifyRegconfInfo | null;
  setCertifyRegconfInfo: (data: CertifyRegconfInfo | null) => void;

  // LDAP 연동 결과
  ldapResult: LdapResult | null;
  setLdapResult: (data: LdapResult | null) => void;

  // 인증 대상 상품 코드 목록 (getCertifyProdMap 결과 캐시)
  certifyProdList: string[];
  setCertifyProdList: (list: string[]) => void;

  // 현재 작업의 인증상품 여부
  isCertifyProd: boolean;
  setIsCertifyProd: (value: boolean) => void;

  // 통신방식 코드 (F/FG/Z/ZG=FTTH, N/NG=와이드)
  certifyOpLnkdCd: string;
  setCertifyOpLnkdCd: (code: string) => void;

  // 가입자번호 (청약신청 결과)
  entrNo: string | null;
  entrRqstNo: string | null;
  setEntrNo: (entrNo: string | null, entrRqstNo?: string | null) => void;

  // LGU+ 공통코드 (ds_upls_common_cd)
  lguMarketCd: string;
  lguOperatorId: string;
  lguJobType: string;       // REF_CODE4 - LDAP JOB_TYPE
  lguJobTypeConf: string;   // REF_CODE5 - LDAP JOB_TYPE_CONF
  setLguCommonCd: (marketCd: string, operatorId: string, jobType?: string, jobTypeConf?: string) => void;

  // CL-02 포트현황 결과
  cl02PortData: any[] | null;
  setCl02PortData: (data: any[] | null) => void;

  // 청약신청 완료 여부
  isSubscriptionDone: boolean;
  setIsSubscriptionDone: (value: boolean) => void;

  // 집선등록 완료 여부 (레거시: LGU_LINE_INPUT)
  isLineRegistrationDone: boolean;
  setIsLineRegistrationDone: (value: boolean) => void;

  // 전체 초기화
  reset: () => void;
}

export const useCertifyStore = create<CertifyStore>()(
  persist(
    (set) => ({
      certifyRegconfInfo: null,
      ldapResult: null,
      certifyProdList: [],
      isCertifyProd: false,
      certifyOpLnkdCd: '',
      entrNo: null,
      entrRqstNo: null,
      lguMarketCd: '',
      lguOperatorId: '',
      lguJobType: '',
      lguJobTypeConf: '',
      cl02PortData: null,
      isSubscriptionDone: false,
      isLineRegistrationDone: false,

      setCertifyRegconfInfo: (data) => set({ certifyRegconfInfo: data }),
      setLdapResult: (data) => set({ ldapResult: data }),
      setCertifyProdList: (list) => set({ certifyProdList: list }),
      setIsCertifyProd: (value) => set({ isCertifyProd: value }),
      setCertifyOpLnkdCd: (code) => set({ certifyOpLnkdCd: code }),
      setEntrNo: (entrNo, entrRqstNo) => set({ entrNo, entrRqstNo: entrRqstNo ?? null }),
      setLguCommonCd: (marketCd, operatorId, jobType, jobTypeConf) => set({
        lguMarketCd: marketCd,
        lguOperatorId: operatorId,
        ...(jobType !== undefined ? { lguJobType: jobType } : {}),
        ...(jobTypeConf !== undefined ? { lguJobTypeConf: jobTypeConf } : {}),
      }),
      setCl02PortData: (data) => set({ cl02PortData: data }),
      setIsSubscriptionDone: (value) => set({ isSubscriptionDone: value }),
      setIsLineRegistrationDone: (value) => set({ isLineRegistrationDone: value }),

      reset: () => set({
        certifyRegconfInfo: null,
        ldapResult: null,
        certifyProdList: [],
        isCertifyProd: false,
        certifyOpLnkdCd: '',
        entrNo: null,
        entrRqstNo: null,
        lguMarketCd: '',
        lguOperatorId: '',
        lguJobType: '',
        lguJobTypeConf: '',
        cl02PortData: null,
        isSubscriptionDone: false,
        isLineRegistrationDone: false,
      }),
    }),
    {
      name: 'dlive-certify-storage',
      partialize: (state) => ({
        certifyRegconfInfo: state.certifyRegconfInfo,
        ldapResult: state.ldapResult,
        entrNo: state.entrNo,
        entrRqstNo: state.entrRqstNo,
        isSubscriptionDone: state.isSubscriptionDone,
        isLineRegistrationDone: state.isLineRegistrationDone,
      }),
    }
  )
);
