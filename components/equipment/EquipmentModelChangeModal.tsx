import React, { useState, useEffect, useMemo } from 'react';
import {
  getContractEquipmentList,
  getCommonCodeList,
  getCommonCodeListByGroups,
  getEquipmentModelsForProduct,
  ContractEquipment,
  CommonCode,
  ContractEquipmentListResponse,
  EquipmentSaleProduct
} from '../../services/apiService';
import './EquipmentModelChangeModal.css';
import Select from '../ui/Select';
import BaseModal from '../common/BaseModal';
import '../../styles/buttons.css';

interface EquipmentModelChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  prodCd: string;
  ctrtId: string;
  ctrtStatNm?: string;  // 계약 상태명 (설치예정, 정상, 일시정지 등)
  prodGrp: string;
  prodNm: string;
  wrkCdNm: string;
  onSave: (equipmentData: ContractEquipment[], promotionCount?: string) => Promise<void>;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const EquipmentModelChangeModal: React.FC<EquipmentModelChangeModalProps> = ({
  isOpen,
  onClose,
  prodCd,
  ctrtId,
  ctrtStatNm,
  prodGrp,
  prodNm,
  wrkCdNm,
  onSave,
  showToast,
}) => {
  const [equipmentList, setEquipmentList] = useState<ContractEquipment[]>([]);
  const [supportEquipmentList, setSupportEquipmentList] = useState<ContractEquipment[]>([]);
  const [availableModels, setAvailableModels] = useState<{ [key: string]: Array<{ EQT_CL_CD: string; EQT_CL_NM: string }> }>({});
  const [lentCodes, setLentCodes] = useState<CommonCode[]>([]);
  const [eqtUseStatCodes, setEqtUseStatCodes] = useState<CommonCode[]>([]);
  const [promCntCodes, setPromCntCodes] = useState<CommonCode[]>([]);
  const [saleProducts, setSaleProducts] = useState<EquipmentSaleProduct[]>([]);
  const [selectedPromotionCount, setSelectedPromotionCount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 추가 장비 선택
  const [selectedAddEquipment, setSelectedAddEquipment] = useState<string>('');
  const [addEquipmentCount, setAddEquipmentCount] = useState<string>('1');

  // BaseModal에서 이미 백그라운드 스크롤 잠금 처리하므로 여기서는 제거
  // (중복 처리 시 cleanup 순서 문제로 스크롤 안 되는 버그 발생)

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, prodCd, ctrtId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 [Modal] 장비 구성 정보 로드 시작');
      console.log('  PROD_CD:', prodCd);
      console.log('  CTRT_ID:', ctrtId);

      // 1. 계약 장비 리스트 조회
      const contractData: ContractEquipmentListResponse = await getContractEquipmentList(prodCd, ctrtId);
      console.log('✅ [Modal] 계약 장비 리스트:', contractData);

      // 2. 공통코드 조회 (객체/배열 응답 모두 지원)
      const commonCodesRaw = await getCommonCodeListByGroups('LENT,EQT_USE_STAT,ITLLMT_PRD');
      console.log('✅ [Modal] 공통코드 원본:', commonCodesRaw);

      let lents: CommonCode[] = [];
      let stats: CommonCode[] = [];
      let proms: CommonCode[] = [];

      const normalizeCodes = (arr: any[]): any[] => {
        if (!Array.isArray(arr)) return [];
        return arr.map((item: any) => {
          // 문자열만 오는 경우 처리
          if (typeof item === 'string' || typeof item === 'number') {
            const s = String(item);
            return { COMMON_CD: s, COMMON_CD_NM: s };
          }
          const code = item?.COMMON_CD ?? item?.CODE ?? item?.CD ?? item?.value ?? item?.COMMONCODE ?? item?.code;
          const name = item?.COMMON_CD_NM ?? item?.CD_NM ?? item?.NAME ?? item?.label ?? item?.text ?? item?.COMMONCDNM ?? item?.name;
          const ref = item?.REF_CODE ?? item?.REF ?? item?.refCode ?? item?.ref;
          const group = item?.COMMON_GRP ?? item?.GROUP ?? item?.group; // 그룹 보존(배열 형태 응답용)
          const sortNo = item?.SORT_NO ?? item?.SORT ?? item?.order ?? undefined;
          const defaultYn = item?.DEFAULT_YN ?? item?.DEFAULT ?? item?.default ?? undefined;
          return {
            COMMON_CD: typeof code === 'string' ? code : (code != null ? String(code) : ''),
            COMMON_CD_NM: typeof name === 'string' ? name : (name != null ? String(name) : ''),
            REF_CODE: typeof ref === 'string' ? ref : (ref != null ? String(ref) : undefined),
            COMMON_GRP: group != null ? String(group) : undefined,
            // 추가 메타(정렬/기본값) 보존: 타입 확장은 허용됨
            SORT_NO: typeof sortNo === 'number' ? sortNo : (sortNo != null ? Number(sortNo) : undefined),
            DEFAULT_YN: defaultYn != null ? String(defaultYn) : undefined,
          };
        }).filter(x => x.COMMON_CD);
      };

      // 케이스 A: { LENT: [...], EQT_USE_STAT: [...], ... } 또는 구(레거시) 키 혼재
      if (commonCodesRaw && !Array.isArray(commonCodesRaw) && typeof commonCodesRaw === 'object') {
        // 키 우선: LENT → CMCU027
        const rawLents =
          (Array.isArray((commonCodesRaw as any)['LENT']) ? (commonCodesRaw as any)['LENT'] : undefined) ??
          (Array.isArray((commonCodesRaw as any)['CMCU027']) ? (commonCodesRaw as any)['CMCU027'] : []);
        // 키 우선: EQT_USE_STAT → CMEP314
        const rawStats =
          (Array.isArray((commonCodesRaw as any)['EQT_USE_STAT']) ? (commonCodesRaw as any)['EQT_USE_STAT'] : undefined) ??
          (Array.isArray((commonCodesRaw as any)['CMEP314']) ? (commonCodesRaw as any)['CMEP314'] : []);
        // ⭐️ [수정됨] 'ITLLMT_PRD' 또는 레거시 'CMCU064' 키를 찾습니다.
        const rawProms = 
          (Array.isArray((commonCodesRaw as any)['ITLLMT_PRD']) ? (commonCodesRaw as any)['ITLLMT_PRD'] : undefined) ??
          (Array.isArray((commonCodesRaw as any)['CMCU064']) ? (commonCodesRaw as any)['CMCU064'] : []);
        
        // 1) 그룹명 기반 1차 필터링(대용량 혼합 배열에서 필요한 그룹만 추출)
        const filterByGroupNames = (arr: any[], names: string[]) => {
          if (!Array.isArray(arr)) return [];
          // 데이터에 그룹명이 없으면 필터링 생략
          if (arr.length > 0 && !('COMMON_GRP_NM' in (arr[0] || {}) || 'GROUP_NM' in (arr[0] || {}))) {
            return arr;
          }
          return arr.filter((it: any) => {
            const grpNm = String(it?.COMMON_GRP_NM || it?.GROUP_NM || '');
            return names.some(name => grpNm.indexOf(name) >= 0);
          });
        };
        const lentsRawFiltered = filterByGroupNames(rawLents, ['임대구분']);
        const statsRawFiltered = filterByGroupNames(rawStats, ['사용상태', '장비사용상태']);
        // ⭐️ [수정됨] "프로모션"이 아니라 "약정개월"을 찾습니다.
        const promsRawFiltered = filterByGroupNames(rawProms, ['프로모션', '프로모션개수', '약정개월']);

        // 2) 정규화
        lents = normalizeCodes(lentsRawFiltered.length ? lentsRawFiltered : rawLents);
        stats = normalizeCodes(statsRawFiltered.length ? statsRawFiltered : rawStats);
        proms = normalizeCodes(promsRawFiltered.length ? promsRawFiltered : rawProms);
        
      } else {
        // 케이스 B: 배열 또는 { codes: [] } 형태
      let allCodes: CommonCode[] = [];
      if (Array.isArray(commonCodesRaw)) {
          allCodes = normalizeCodes(commonCodesRaw as unknown as any[]);
        } else if ((commonCodesRaw as any)?.codes && Array.isArray((commonCodesRaw as any).codes)) {
          allCodes = normalizeCodes((commonCodesRaw as any).codes);
        }
        // 그룹 키가 들어있는 경우 필터링
        if (allCodes.length > 0) {
          lents = allCodes.filter((code: any) => (code as any).COMMON_GRP === 'LENT' || (code as any).COMMON_GRP === 'CMCU027');
          stats = allCodes.filter((code: any) => (code as any).COMMON_GRP === 'EQT_USE_STAT' || (code as any).COMMON_GRP === 'CMEP314');
          proms = allCodes.filter((code: any) => (code as any).COMMON_GRP === 'ITLLMT_PRD' || (code as any).COMMON_GRP === 'CMCU064');
        }
      }

      console.log('  임대구분 코드:', lents?.length || 0, '개');
      console.log('  사용상태 코드:', stats?.length || 0, '개');
      console.log('  프로모션 코드:', proms?.length || 0, '개'); // ⭐️ 이제 정상

      setLentCodes(lents || []);
      setEqtUseStatCodes(stats || []);
      setPromCntCodes(proms || []);

      // 3. output2 처리 (계약 장비 리스트)
      const equipments = contractData.output2 || [];
      console.log('  장비 개수:', equipments.length);
      console.log('  장비 샘플 (첫 번째):', equipments[0]);

      // ⭐️ [레거시 로직] 지원 장비 필터링 (cm_lib.js fn_prod_eqt_info 참조)
      // 레거시: PROD_GRP == 'V' → EQT='09'(STB)만, 그 외 → EQT='10'(부가장비/AP)만
      const supportEquipments = equipments.filter(eq => {
        if (!eq.SEL || eq.SEL === '0') {
          if (prodGrp === 'V') {
            return eq.EQT === '09';  // VoD 상품 → STB(09)만 표시
          } else {
            return eq.EQT === '10';  // 그 외 상품 → 부가장비(10)만 표시
          }
        }
        return false;
      });
      setSupportEquipmentList(supportEquipments);
      console.log('  지원 장비 개수:', supportEquipments.length, '(PROD_GRP:', prodGrp, '→ EQT:', prodGrp === 'V' ? '09' : '10', ')');

      // 계약 장비 초기 설정
      const initialEquipments = equipments.map((eq, idx) => {
        console.log(`  장비[${idx}]:`, {
          EQT: eq.EQT,
          PROD_TYP: eq.PROD_TYP,
          EQUIP_SEQ: eq.EQUIP_SEQ,
          SVC_CMPS_ID: (eq as any).SVC_CMPS_ID,
          SEL: eq.SEL
        });
        return {
          ...eq,
          SEL: eq.SEL || '0',
          LENT: eq.LENT || '10',
          EQT_USE_STAT_CD: eq.EQT_USE_STAT_CD || '1',
          ITLLMT_PRD: eq.ITLLMT_PRD || '00',
          // ⭐️ [수정] PROD_TYP, EQUIP_SEQ 보존 (없으면 기본값)
          PROD_TYP: eq.PROD_TYP || '2',  // 기본값 '2' (레거시 기준)
          EQUIP_SEQ: eq.EQUIP_SEQ || (eq as any).SVC_CMPS_ID || String(idx + 1),  // 순번 보장
        };
      });
      setEquipmentList(initialEquipments);

      // output1 처리 (서비스 구성 정보로 선택 상태 업데이트)
      if (contractData.output1 && contractData.output1.length > 0) {
        const svcInfo = contractData.output1[0];
        console.log('🔍 [Modal] 서비스 구성 정보:', svcInfo);

        // 고정길이 파싱
        const itemMidCds = svcInfo.ITEM_MID_CDS || '';
        const eqtCls = svcInfo.EQT_CLS || '';
        const lents = (svcInfo.LENTS || '').replace(/\[|\]/g, '');
        const eqtUseStats = svcInfo.EQT_USE_STATS || '';
        const itllmtPrds = svcInfo.ITLLMT_PRDS || '';
        const eqtSaleAmts = svcInfo.EQT_SALE_AMTS || '';
        const prodCmpsCls = svcInfo.PROD_CMPS_CLS || ''; // ⭐️ [추가] PROD_CMPS_CLS 파싱
        const prodGrps = svcInfo.PROD_GRPS || '';
        const prodCds = svcInfo.PROD_CDS || '';
        const svcCds = svcInfo.SVC_CDS || '';

        console.log('🔍 [Modal] PROD_CMPS_CLS 원본:', prodCmpsCls, '(길이:', prodCmpsCls.length, ')');

        const itemCount = Math.floor(itemMidCds.length / 10);
        const updatedEquipments = [...initialEquipments];

        // ⭐️ [추가] PROD_CMPS_CLS 파싱 (가변 길이: PROD_TYP + EQUIP_SEQ)
        // 레거시 예: "231231231" = ["2","31"] × 3개
        const parseProdCmpsCls = (str: string): Array<{prodTyp: string, equipSeq: string}> => {
          const result = [];
          let i = 0;
          while (i < str.length) {
            // PROD_TYP = 1자리
            const prodTyp = str.charAt(i);
            i++;
            // EQUIP_SEQ = 나머지 (2자리 또는 가변)
            let equipSeq = '';
            while (i < str.length && /\d/.test(str.charAt(i))) {
              equipSeq += str.charAt(i);
              i++;
              // 2자리까지만 (레거시 기준)
              if (equipSeq.length >= 2) break;
            }
            if (prodTyp || equipSeq) {
              result.push({ prodTyp, equipSeq });
            }
          }
          return result;
        };

        const prodCmpsClsArr = parseProdCmpsCls(prodCmpsCls);
        console.log('🔍 [Modal] PROD_CMPS_CLS 파싱:', prodCmpsClsArr);

        // ⭐️ [레거시 로직] 장비 타입별 개수 카운트 (ds_contract_eqt_count 역할)
        const eqtCountMap: { [key: string]: number } = {};
        for (let i = 0; i < itemCount; i++) {
          const itemMidCd = itemMidCds.substr(i * 10, 10).trim();
          if (itemMidCd) {
            eqtCountMap[itemMidCd] = (eqtCountMap[itemMidCd] || 0) + 1;
          }
        }
        console.log('🔍 [Modal] 장비 타입별 개수:', eqtCountMap);

        for (let i = 0; i < itemCount; i++) {
          const itemMidCd = itemMidCds.substr(i * 10, 10).trim();
          const eqtCl = eqtCls.substr(i * 10, 10).trim();
          const lent = lents.substr(i * 2, 2).trim();
          const eqtUseStat = eqtUseStats.substr(i * 1, 1).trim();
          const itllmtPrd = itllmtPrds.substr(i * 2, 2).trim();
          const eqtSaleAmt = eqtSaleAmts.substr(i * 10, 10).trim();
          const prodGrp = prodGrps.charAt(i) || 'D';
          const prodCd = prodCds.substr(i * 10, 10).trim();
          const svcCd = svcCds.substr(i * 10, 10).trim();

          // ⭐️ [추가] PROD_TYP, EQUIP_SEQ from PROD_CMPS_CLS
          const cmpsInfo = prodCmpsClsArr[i] || { prodTyp: '2', equipSeq: String(i + 1) };

          // 해당 장비 찾기 (SEL != '1'인 것 중)
          const idx = updatedEquipments.findIndex(eq => eq.SEL !== '1' && eq.EQT === itemMidCd);
          if (idx > -1) {
            updatedEquipments[idx] = {
              ...updatedEquipments[idx],
              SEL: '1',
              EQT_CL: eqtCl,
              LENT: lent || '10',
              EQT_USE_STAT_CD: eqtUseStat || '1',
              ITLLMT_PRD: itllmtPrd || '00',
              EQT_SALE_AMT: parseInt(eqtSaleAmt) || 0,
              // ⭐️ [중요 수정] output2의 PROD_TYP, EQUIP_SEQ를 절대 덮어쓰지 않음!
              // PROD_CMPS_CLS는 구분자가 없어 파싱 불가능 (예: "231" = "2"+"31" OR "23"+"1")
              // output2에서 받은 원본 값을 그대로 유지해야 함
              PROD_TYP: updatedEquipments[idx].PROD_TYP,  // output2 원본 유지
              EQUIP_SEQ: updatedEquipments[idx].EQUIP_SEQ,  // output2 원본 유지
              PROD_GRP: prodGrp || updatedEquipments[idx].PROD_GRP,
              PROD_CD: prodCd || updatedEquipments[idx].PROD_CD,
              SVC_CD: svcCd || updatedEquipments[idx].SVC_CD,
            };
            console.log(`  장비[${idx}] 선택됨 (output2 원본 값 보존):`, {
              EQT: updatedEquipments[idx].EQT,
              PROD_TYP: updatedEquipments[idx].PROD_TYP,
              EQUIP_SEQ: updatedEquipments[idx].EQUIP_SEQ,
              SEL: '1'
            });
          }
        }

        // ⭐️ [레거시 로직] 추가 장비 자동 추가 (레거시 btn_eqt_add_OnClick 역할)
        // 동일 장비 타입이 2개 이상 필요한 경우 자동으로 행 추가
        Object.entries(eqtCountMap).forEach(([midCd, count]) => {
          if (count > 1) {
            // 하이브리드 상품(CMPS_QTY_FROM==2) 부가장비(10)는 스킵 (레거시 로직)
            const baseEquip = updatedEquipments.find(eq => eq.EQT_CD === '10' || eq.EQT === '10');
            if (midCd === '10' && baseEquip && (baseEquip as any).CMPS_QTY_FROM === '2') {
              console.log(`  [자동추가] 하이브리드 상품 부가장비(10) SKIP`);
              return;
            }

            // 지원 장비에서 해당 타입 찾기
            const supportEquip = supportEquipments.find(eq => eq.EQT === midCd || eq.EQT_CD === midCd);
            if (supportEquip) {
              const addCount = count - 1; // 이미 1개는 선택됨
              console.log(`  [자동추가] ${midCd} 장비 ${addCount}개 추가`);

              for (let j = 0; j < addCount; j++) {
                // 새 장비 행 추가 (지원 장비 복사)
                const newEquip: ContractEquipment = {
                  ...supportEquip,
                  SEL: '1',
                  EQUIP_SEQ: String(updatedEquipments.length + 1),
                  // output1에서 파싱한 값 적용
                  LENT: lents.substr((count - addCount + j) * 2, 2).trim() || '10',
                  EQT_USE_STAT_CD: eqtUseStats.substr(count - addCount + j, 1).trim() || '1',
                  ITLLMT_PRD: itllmtPrds.substr((count - addCount + j) * 2, 2).trim() || '00',
                };
                updatedEquipments.push(newEquip);
                console.log(`    추가된 장비:`, { EQT: newEquip.EQT, EQUIP_SEQ: newEquip.EQUIP_SEQ });
              }
            }
          }
        });

        console.log('✅ [Modal] 선택된 장비 목록 (자동추가 포함):', updatedEquipments.filter(eq => eq.SEL === '1'));
        setEquipmentList(updatedEquipments);
      }

      // output3 처리 (장비 판매 상품 정보)
      setSaleProducts(contractData.output3 || []);

      // 상품별 장비 모델 리스트 조회(레거시 getEquipmentNmListOfProd 대응)
      // - EQT_CD(아이템중분류 코드)별 모델(EQT_CL_CD/EQT_CL_NM) 목록을 구성
      const modelList = await getEquipmentModelsForProduct(prodCd, ctrtId);
      const modelsByEqtFromApi: { [key: string]: Array<{ EQT_CL_CD: string; EQT_CL_NM: string }> } = {};
      modelList.forEach(m => {
        if (!modelsByEqtFromApi[m.EQT_CD]) {
          modelsByEqtFromApi[m.EQT_CD] = [];
        }
        // 중복 방지
        if (!modelsByEqtFromApi[m.EQT_CD].some(x => x.EQT_CL_CD === m.EQT_CL_CD)) {
          modelsByEqtFromApi[m.EQT_CD].push({ EQT_CL_CD: m.EQT_CL_CD, EQT_CL_NM: m.EQT_CL_NM });
        }
      });

      // 계약 리스트에서 제공된 모델 정보도 보강(혹시 API에 누락된 모델 대비)
      equipments.forEach(eq => {
        const key = eq.EQT_CD || eq.EQT;
        if (!key) return;
        if (!modelsByEqtFromApi[key]) modelsByEqtFromApi[key] = [];
        const exists = modelsByEqtFromApi[key].some(m => m.EQT_CL_CD === eq.EQT_CL);
        if (!exists && eq.EQT_CL && eq.EQT_CL_NM) {
          modelsByEqtFromApi[key].push({ EQT_CL_CD: eq.EQT_CL, EQT_CL_NM: eq.EQT_CL_NM });
        }
      });

      setAvailableModels(modelsByEqtFromApi);
      console.log('  모델 그룹(API 병합):', modelsByEqtFromApi);

      console.log('✅ [Modal] 데이터 로드 완료');
    } catch (error) {
      console.error('❌ [Modal] 데이터 로드 실패:', error);
      showToast?.('장비 정보를 불러오는데 실패했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (index: number) => {
    const newList = [...equipmentList];
    const oldSel = newList[index].SEL;
    newList[index].SEL = oldSel === '1' ? '0' : '1';
    console.log(`✅ [Modal] 체크박스 변경: 장비[${index}] ${newList[index].EQT} - SEL: ${oldSel} → ${newList[index].SEL}`);
    setEquipmentList(newList);
    console.log(`   현재 선택된 장비 수: ${newList.filter(eq => eq.SEL === '1').length}개`);
  };

  const handleFieldChange = (index: number, field: keyof ContractEquipment, value: any) => {
    const newList = [...equipmentList];
    (newList[index] as any)[field] = value;

    // 임대구분 변경 시 관련 필드 초기화
    if (field === 'LENT') {
      if (value !== '31') {
        // 할부가 아니면 할부기간 초기화
        newList[index].ITLLMT_PRD = '00';
      }
      if (!['30', '31', '60'].includes(value)) {
        // 렌탈/할부/무상이 아니면 사용상태 초기화
        newList[index].EQT_USE_STAT_CD = '1';
      }
    }

    setEquipmentList(newList);
  };

  const handleAddEquipment = () => {
    if (!selectedAddEquipment) {
      showToast?.('추가할 장비를 선택하세요.', 'warning');
      return;
    }

    const count = parseInt(addEquipmentCount);
    if (isNaN(count) || count < 1) {
      showToast?.('추가할 개수를 입력하세요.', 'warning');
      return;
    }

    const sourceEquipment = supportEquipmentList.find(eq => eq.EQT === selectedAddEquipment);
    if (!sourceEquipment) return;

    const newList = [...equipmentList];
    for (let i = 0; i < count; i++) {
      newList.push({
        ...sourceEquipment,
        SEL: '1',
        LENT: '10',
        EQT_USE_STAT_CD: '1',
        ITLLMT_PRD: '00',
        // ⭐️ [수정] 추가 장비도 PROD_TYP, EQUIP_SEQ 설정
        PROD_TYP: sourceEquipment.PROD_TYP || '2',
        EQUIP_SEQ: sourceEquipment.EQUIP_SEQ || (sourceEquipment as any).SVC_CMPS_ID || String(newList.length + 1),
      });
    }

    setEquipmentList(newList);
    setAddEquipmentCount('1');
  };

  const handleSave = async () => {
    console.log('\n🔥🔥🔥 [Modal] 저장 버튼 클릭 🔥🔥🔥');
    console.log('  equipmentList 전체:', equipmentList.length, '개');
    console.log('  각 장비의 SEL 상태:');
    equipmentList.forEach((eq, idx) => {
      console.log(`    [${idx}] ${eq.EQT} - SEL: "${eq.SEL}" (선택: ${eq.SEL === '1' ? 'O' : 'X'})`);
    });

    const selectedEquipments = equipmentList.filter(eq => eq.SEL === '1');
    console.log('✅ 선택된 장비:', selectedEquipments.length, '개');
    selectedEquipments.forEach((eq, idx) => {
      console.log(`  [${idx}] ${eq.EQT} - PROD_TYP: ${eq.PROD_TYP}, EQUIP_SEQ: ${eq.EQUIP_SEQ}`);
    });

    if (selectedEquipments.length === 0) {
      showToast?.('선택된 장비가 없습니다.', 'warning');
      return;
    }

    // 필수: STB(셋톱박스) 구성 확인 (ITEM_MID_CD/EQT 코드 '05', '5'도 허용 → 2자리 패딩 비교)
    const normalize2 = (v?: any) => (v == null ? '' : String(v).trim()).padStart(2, '0');
    const isStb = (eq: ContractEquipment) => {
      const c1 = normalize2((eq as any).EQT);
      const c2 = normalize2((eq as any).ITM_MID_CD);
      const c3 = normalize2((eq as any).EQT_CD);
      // STB = 04 (Smart card = 05)
      return c1 === '04' || c2 === '04' || c3 === '04';
    };
    const stbItems = selectedEquipments.filter(isStb);
    // STB 사전 경고/차단 제거: 서버 검증에 위임
    // if (stbItems.length === 0) { ... }
    // if (stbWithoutModel) { ... }

    // AP(무선공유기) 개수 검증
    const apCount = selectedEquipments.filter(eq => eq.EQT === '10').length;

    // 유플러스 유아이드 상품: AP 2대 필수
    const firstEquipment = selectedEquipments[0];
    if (firstEquipment && firstEquipment.CMPS_QTY_FROM === '2') {
      if (apCount !== 2) {
        showToast?.('유아이드상품은 무선공유기를 필수 2대를 설치합니다.', 'warning');
        return;
      }
    } else {
      // 일반 상품: AP 1대만 가능
      if (apCount > 1) {
        showToast?.('요청하신 상품은 무선공유기를 기본 1대만 추가가능합니다.', 'warning');
        return;
      }
    }

    // 최대 수량 검증
    const handyCount = selectedEquipments.filter(eq => eq.EQT === '09').length;
    if (handyCount > 180) {
      showToast?.(`최대수량 180대를 초과할수 없습니다. HANDY 요청대수: ${handyCount}`, 'warning');
      return;
    }
    if (apCount > 180) {
      showToast?.(`최대수량 180대를 초과할수 없습니다. 무선공유기(AP) 요청대수: ${apCount}`, 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('📤 [Modal] onSave 호출 - selectedEquipments:', selectedEquipments.length, '개');
      console.log('  전송할 장비 상세:');
      selectedEquipments.forEach((eq, idx) => {
        console.log(`    [${idx}]`, {
          EQT: eq.EQT,
          SEL: eq.SEL,
          PROD_TYP: eq.PROD_TYP,
          EQUIP_SEQ: eq.EQUIP_SEQ,
          PROD_GRP: eq.PROD_GRP,
          PROD_CD: eq.PROD_CD,
          SVC_CD: eq.SVC_CD,
          EQT_CL: eq.EQT_CL,
          LENT: eq.LENT,
          EQT_USE_STAT_CD: eq.EQT_USE_STAT_CD,
          ITLLMT_PRD: eq.ITLLMT_PRD
        });
      });

      await onSave(selectedEquipments, selectedPromotionCount);
      // 성공 토스트는 EquipmentManagement에서 표시
      onClose();
    } catch (error) {
      console.error('❌ [Modal] 저장 실패:', error);
      // 에러 토스트도 EquipmentManagement에서 표시 (onSave에서 throw)
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvailableInstallmentPeriods = (equipment: ContractEquipment): EquipmentSaleProduct[] => {
    return saleProducts.filter(
      sp => sp.PRED === '1' &&
           sp.EQT_USE_STAT_CD === equipment.EQT_USE_STAT_CD &&
           sp.EQT_CL_CD === equipment.EQT_CL
    );
  };

  const getLentName = (code: string) => {
    const found = lentCodes.find(c => c.COMMON_CD === code);
    return found ? found.COMMON_CD_NM : code;
  };

  // ⭐️ [수정됨] 딜라이브 비즈니스 로직(REF_CODE)을 반영한 파서
  const parseAllowedLentCodes = (
    equipment: ContractEquipment, // ⭐️ 장비(eq)를 통째로 받습니다
    allLentCodes: CommonCode[]     // ⭐️ 전체 7개 코드를 받습니다
  ): string[] => {

    const lentYn = (equipment as any).LENT_YN;
    const eqtCl = (equipment as any).EQT_CL; // 현재 장비의 모델 코드 (예: 090403)

    if (!lentYn || typeof lentYn !== 'string' || !allLentCodes || allLentCodes.length === 0) {
      // ⭐️ [수정] LENT_YN이 없으면 빈 배열 반환 (폴백 제거)
      console.log('🔍 [임대구분] LENT_YN 없음 → 빈 배열', { lentYn, allLentCodesCount: allLentCodes.length });
      return [];
    }

    const tokens = lentYn.split('|').map(t => t.trim()).filter(Boolean);
    if (!tokens.length) {
      // ⭐️ [수정] LENT_YN이 비어있으면 빈 배열 반환 (폴백 제거)
      console.log('🔍 [임대구분] LENT_YN 토큰 없음 → 빈 배열', { lentYn });
      return [];
    }

    // 1. 이 장비(eqtCl)에 허용된 꼬리표(REF_CODE) Set을 만듭니다.
    const allowedRefCodes = new Set<string>();
    tokens.forEach(tok => {
      // ⭐️ [수정] 장비모델(EQT_CL)과 매칭되는 토큰만 필터링
      // LENT_YN 형식: |{EQT_CL_CD 6자리}{REF_CODE 1자리}|
      // 예: '0904031' = 모델 '090403' + REF_CODE '1'
      if (tok.length >= 7) {
        const modelPart = tok.substring(0, 6); // 앞 6자리 (장비 모델)
        const refCode = tok.charAt(6); // 7번째 자리 (REF_CODE)

        // ⭐️ [핵심] 현재 장비의 모델 코드(eqtCl)와 일치하는 토큰만 허용
        if (eqtCl && modelPart === eqtCl) {
          allowedRefCodes.add(refCode);
        }
      }
    });

    console.log('🔍 [임대구분] 필터링 정보', {
      eqtCl, // 현재 장비 모델
      lentYn,
      tokens,
      allowedRefCodes: Array.from(allowedRefCodes), // 매칭된 REF_CODE만
      allLentCodes: allLentCodes.map(c => ({
        code: c.COMMON_CD,
        name: c.COMMON_CD_NM,
        refCode: (c as any).REF_CODE
      }))
    });

    // 2. ⭐️ [수정] 꼬리표 Set이 비어있으면 빈 배열 반환 (폴백 제거)
    if (allowedRefCodes.size === 0) {
        console.log('🔍 [임대구분] 허용 REF_CODE 없음 → 빈 배열');
        return [];
    }

    // 3. 7개 공통코드(allLentCodes)를 순회하며, 자신의 REF_CODE가 허용 Set에 있는지 확인합니다.
    const allowed = allLentCodes
      .filter(c => {
        const refCode = (c as any).REF_CODE;
        // ⭐️ '고객소유(40)'가 REF_CODE '1'에 매핑되어 있으므로,
        // '1'이 꼬리표에 포함되면 자동으로 허용됩니다.
        const isAllowed = refCode && allowedRefCodes.has(refCode);
        console.log(`  - ${c.COMMON_CD} (${c.COMMON_CD_NM}): REF_CODE=${refCode} → ${isAllowed ? '✓' : '✗'}`);
        return isAllowed;
      })
      .map(c => c.COMMON_CD);

    console.log('✅ [임대구분] 필터링 결과:', allowed);
    return allowed;
  };

  const getStateName = (code: string) => {
    const found = eqtUseStatCodes.find(c => c.COMMON_CD === code);
    return found ? found.COMMON_CD_NM : code;
  };

  // 임대구분 옵션(기본형): 공통코드 그대로 사용, 폴백 없음
  // ⭐️ [수정] REF_CODE도 포함해야 parseAllowedLentCodes에서 필터링 가능
  const lentOptions = useMemo(() => {
    const opts = (lentCodes || []).map((c: any) => ({
      value: c.COMMON_CD,
      label: c.COMMON_CD_NM || c.COMMON_CD,
      SORT_NO: c.SORT_NO,
      DEFAULT_YN: c.DEFAULT_YN,
      REF_CODE: c.REF_CODE, // ⭐️ 추가
    }));
    return opts;
  }, [lentCodes]);

  // 사용상태 옵션
  const eqtUseStatOptions = useMemo(() => {
    const opts = (eqtUseStatCodes || []).map(c => ({
      value: c.COMMON_CD,
      label: c.COMMON_CD_NM || c.COMMON_CD
    }));
    // ⭐️ [수정됨] 레거시 기준에 맞게 폴백 제거
    return opts;
  }, [eqtUseStatCodes]);

  // 프로모션 개수 옵션
  const promOptions = useMemo(() => {
    const opts = (promCntCodes || []).map(c => ({
      value: c.COMMON_CD,
      label: c.COMMON_CD_NM || c.COMMON_CD
    }));
    return opts;
  }, [promCntCodes]);

  // 지원 장비 옵션
  const supportEquipOptions = useMemo(() => {
    return (supportEquipmentList || []).map(eq => ({
      value: eq.EQT,
      label: eq.EQT_NM
    }));
  }, [supportEquipmentList]);

  // SubHeader - 기본 정보 (레거시: 계약번호, 작업코드, 상품명, 프로모션)
  const subHeader = isLoading ? null : (
    <div className="modal-subheader">
      <div className="info-row">
        <span className="info-label">계약번호</span>
        <span className="info-value" title={ctrtId}>{ctrtId || '-'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">작업코드</span>
        <span className="info-value" title={wrkCdNm}>{wrkCdNm || '-'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">상품명</span>
        <span className="info-value" title={prodNm}>{prodNm || '-'}</span>
      </div>
      {prodGrp === 'V' && promOptions.length > 0 && (
        <div className="info-row">
          <span className="info-label">프로모션</span>
          <div className="info-select">
            <Select
              value={selectedPromotionCount || ''}
              onValueChange={setSelectedPromotionCount}
              options={promOptions}
              placeholder="선택"
            />
          </div>
        </div>
      )}
    </div>
  );

  // Footer - 버튼
  const footer = (
    <>
      <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={isSubmitting}>
        취소
      </button>
      <button
        className="btn btn-primary btn-sm"
        onClick={handleSave}
        disabled={isSubmitting || isLoading}
      >
        {isSubmitting ? '저장 중...' : '저장'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="장비 구성 변경"
      size="large"
      subHeader={subHeader}
      footer={footer}
    >
      <div className="equipment-model-change-modal-content">
          {isLoading ? (
            <div className="loading-message">
              <div className="spinner"></div>
              <p>장비 정보를 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 장비 추가 섹션 */}
              <div className="add-equipment-section">
                <h3>장비 추가</h3>
                <div className="add-equipment-form">
                  <div className="flex-1">
                    <Select
                    value={selectedAddEquipment}
                      onValueChange={setSelectedAddEquipment}
                      options={(() => {
                        // ⭐️ [폴백] 지원 장비 옵션이 없으면 빈 배열 (정상 동작)
                        if (supportEquipOptions.length === 0) {
                          console.warn('⚠️ 지원 장비 옵션이 없습니다.', { supportEquipmentList });
                        }
                        return supportEquipOptions;
                      })()}
                      placeholder="지원 장비 선택"
                    />
                  </div>
                  <input
                    type="number"
                    className="count-input"
                    value={addEquipmentCount}
                    onChange={(e) => setAddEquipmentCount(e.target.value)}
                    min="1"
                    max="99"
                  />
                  <span className="unit">대</span>
                  <button className="add-btn" onClick={handleAddEquipment}>
                    추가
                  </button>
                </div>
              </div>

              {/* 장비 리스트 */}
              <div className="equipment-section">
                <h3>장비 목록 ({equipmentList.filter(eq => eq.SEL === '1').length}개 선택됨)</h3>

                {equipmentList.length === 0 ? (
                  <div className="empty-state">
                    <p>장비 정보가 없습니다.</p>
                  </div>
                ) : (
                  <div className="equipment-list">
                    {equipmentList.map((eq, index) => {
                      const models = availableModels[eq.EQT_CD] || [];
                      const isSelected = eq.SEL === '1';
                      const canEditUseStat = isSelected && ['30', '31', '60'].includes(eq.LENT);
                      const canEditInstallment = isSelected && eq.LENT === '31';
                      const installmentPeriods = getAvailableInstallmentPeriods(eq);

                      return (
                        <div key={index} className={`equipment-item ${isSelected ? 'selected' : ''}`}>
                          <div className="equipment-header">
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleCheckboxChange(index)}
                              />
                              <span className="equipment-title">
                                {eq.EQT_NM}
                                {eq.EQT_BASIC_YN === 'Y' && <span className="badge">기본</span>}
                              </span>
                            </label>
                          </div>

                          {isSelected && (
                            <div className="equipment-details">
                              <div className="detail-row">
                                <label>모델</label>
                                <div style={{ flex: 1 }}>
                                  <Select
                                  value={eq.EQT_CL || ''}
                                    onValueChange={(val) => handleFieldChange(index, 'EQT_CL', val)}
                                    options={(() => {
                                      const modelOptions = (models || []).map(model => ({
                                        value: model.EQT_CL_CD,
                                        label: model.EQT_CL_NM
                                      }));
                                      // ⭐️ [폴백] 모델 옵션이 없으면 빈 배열 반환 (정상 동작)
                                      if (modelOptions.length === 0) {
                                        console.warn('⚠️ 모델 옵션이 없습니다.', { eqtCd: eq.EQT_CD, models });
                                      }
                                      return modelOptions;
                                    })()}
                                    placeholder="선택"
                                  />
                                </div>
                              </div>

                              {/* ⭐️ [수정됨] 동적 필터링 로직 (폴백 제거) */}
                              <div className="detail-row">
                                <label>임대구분</label>
                                <div style={{ flex: 1 }}>
                                  <Select
                                  value={eq.LENT || '10'}
                                    onValueChange={(val) => handleFieldChange(index, 'LENT', val)}
                                    options={((): Array<{ value: string; label: string }> => {
                                      // 1) 허용 임대코드 파싱 (장비와 7개 마스터 목록 전달)
                                      // ⭐️ [수정] lentOptions 대신 lentCodes (REF_CODE 포함)를 전달
                                      let allowed = parseAllowedLentCodes(eq, lentCodes || []);

                                      // 2) 할부(31) 가능 여부 검사: 가능한 할부기간이 없으면 제외
                                      if (allowed.includes('31')) {
                                        const canInstallment = getAvailableInstallmentPeriods(eq).some(sp => sp.PRED === '1');
                                        if (!canInstallment) {
                                          allowed = allowed.filter(code => code !== '31');
                                        }
                                      }

                                      // 3) 허용 목록(allowed)을 기준으로 7개 마스터(lentOptions)에서 필터링
                                      const base = lentOptions.filter(opt => allowed.includes(opt.value));

                                      // ⭐️ [수정] 폴백 제거 - 빈 배열이면 그냥 빈 배열 반환
                                      if (base.length === 0) {
                                        console.warn('⚠️ 임대구분 필터링 결과가 비어있습니다.', { eq, allowed });
                                      }

                                      // 4) 정렬 및 반환
                                      return base.map(opt => ({ value: opt.value, label: opt.label }));
                                    })()}
                                    placeholder="선택"
                                  />
                                </div>
                              </div>
                              {/* ⭐️ [수정 완료] */}

                              {/* 사용상태 필드 숨김 처리 */}
                              {/* <div className="detail-row">
                                <label>사용상태</label>
                                <div style={{ flex: 1, opacity: canEditUseStat ? 1 : 0.6, pointerEvents: canEditUseStat ? 'auto' : 'none' }}>
                                  <Select
                                  value={eq.EQT_USE_STAT_CD || '1'}
                                    onValueChange={(val) => handleFieldChange(index, 'EQT_USE_STAT_CD', val)}
                                    options={(() => {
                                      if (eqtUseStatOptions.length === 0) {
                                        console.warn('⚠️ 사용상태 옵션이 없어 기본값을 사용합니다.');
                                        return [
                                          { value: '1', label: '신규' },
                                          { value: '2', label: '중고' }
                                        ];
                                      }
                                      return eqtUseStatOptions;
                                    })()}
                                    placeholder="선택"
                                  />
                                </div>
                              </div> */}

                              {canEditInstallment && (
                                <div className="detail-row">
                                  <label>할부기간</label>
                                  <div style={{ flex: 1 }}>
                                    <Select
                                    value={eq.ITLLMT_PRD || '00'}
                                      onValueChange={(val) => handleFieldChange(index, 'ITLLMT_PRD', val)}
                                      options={(() => {
                                        const options = [
                                          { value: '00', label: '없음' },
                                          ...installmentPeriods.map(sp => ({
                                            value: sp.INSTL_PERD,
                                            label: `${sp.INSTL_PERD}개월`
                                          }))
                                        ];
                                        // ⭐️ [폴백] 할부기간이 없으면 경고 (정상 동작)
                                        if (installmentPeriods.length === 0) {
                                          console.warn('⚠️ 할부기간 옵션이 없습니다.', { eq, installmentPeriods });
                                        }
                                        return options;
                                      })()}
                                      placeholder="선택"
                                    />
                                  </div>
                                </div>
                              )}

                              {eq.EQT_SALE_AMT > 0 && (
                                <div className="detail-row">
                                  <label>판매가</label>
                                  <span className="price">{eq.EQT_SALE_AMT.toLocaleString()}원</span>
                                </div>
                              )}
                            </div>
                          )}

                          {!isSelected && (
                            <div className="equipment-summary">
                              <span className="tag">{getLentName(eq.LENT)}</span>
                              <span className="tag">{getStateName(eq.EQT_USE_STAT_CD)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
      </div>
    </BaseModal>
  );
};

export default EquipmentModelChangeModal;