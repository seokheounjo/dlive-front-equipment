/**
 * use2PairCheck - 2Pair UTP area check hook
 *
 * Legacy: mowoa03m01/05/06.xml fn_opt_typ(BLD_ID)
 * Added 2024.10.30 per team lead request
 *
 * Shows info-only warning modal when:
 * - WRK_CD is 01(install), 05(product change), or 07(relocation install)
 * - Building OPT_TYP is "2Pair" and PROD_GRP is "I" (Internet)
 * - For LGU+ products: REF_CODE2=="500M" && REF_CODE6=="N" && LGU_NET_YN=="Y"
 * - For own products: DLV_NET_YN=="Y" && KPI_SVC_GRP_CD first char != "5"
 *
 * Does NOT block save - info only.
 */
import { useState, useEffect, useRef } from 'react';
import { getBldEtcInfo, getTpProdSvc } from '../services/apiService';
import { UplsProdItem } from './useCertifyDetection';

interface Use2PairCheckParams {
  bldId: string;
  prodCd: string;
  prodGrp: string;
  wrkCd: string;
  uplsProdList: UplsProdItem[];
  isLoaded: boolean;
}

export const TWO_PAIR_WARNING_MSG =
  '500M 속도는 K2787 모델 설치가 필요합니다\n' +
  ' - 해당 주소지는\n' +
  '   2Pair UTP 배선입니다\n' +
  ' - WiFi6 K2789 모델\n' +
  '   2P 500M 속도 (최대 100M)';

export const use2PairCheck = ({
  bldId,
  prodCd,
  prodGrp,
  wrkCd,
  uplsProdList,
  isLoaded,
}: Use2PairCheckParams) => {
  const [showWarning, setShowWarning] = useState(false);
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only for install(01), product change(05), relocation install(07)
    if (wrkCd !== '01' && wrkCd !== '05' && wrkCd !== '07') return;
    if (!bldId || !isLoaded || hasChecked.current) return;

    hasChecked.current = true;

    const check2Pair = async () => {
      try {
        console.log('[2PairCheck] Start: BLD_ID=', bldId, 'PROD_CD=', prodCd, 'PROD_GRP=', prodGrp);

        // Step 1: Get building ETC info
        const bldEtcList = await getBldEtcInfo(bldId);
        if (!bldEtcList || bldEtcList.length === 0) {
          console.log('[2PairCheck] No building ETC info found');
          return;
        }

        const bldEtc = bldEtcList[0];
        const optTyp = bldEtc.OPT_TYP || '';
        const lguNetYn = bldEtc.LGU_NET_YN || '';
        const dlvNetYn = bldEtc.DLV_NET_YN || '';

        console.log('[2PairCheck] OPT_TYP=', optTyp, 'LGU_NET_YN=', lguNetYn, 'DLV_NET_YN=', dlvNetYn);

        // Step 2: Only check if OPT_TYP is "2Pair" and PROD_GRP is "I" (Internet)
        if (optTyp !== '2Pair' || prodGrp !== 'I') {
          console.log('[2PairCheck] Skip: OPT_TYP != 2Pair or PROD_GRP != I');
          return;
        }

        // Step 3: Check if PROD_CD is in LGCT001 (LGU+ product)
        const uplsItem = uplsProdList.find(item => item.code === prodCd);

        if (uplsItem) {
          // LGU+ product path
          console.log('[2PairCheck] LGU+ product: refCode2=', uplsItem.refCode2, 'refCode6=', uplsItem.refCode6);
          if (uplsItem.refCode2 === '500M' && uplsItem.refCode6 === 'N' && lguNetYn === 'Y') {
            console.log('[2PairCheck] WARNING - LGU+ 2Pair area detected');
            setShowWarning(true);
          }
        } else {
          // Own product (D'Live) path
          console.log('[2PairCheck] Own product: DLV_NET_YN=', dlvNetYn);
          if (dlvNetYn === 'Y') {
            const prodSvcList = await getTpProdSvc(prodCd);
            if (prodSvcList && prodSvcList.length > 0) {
              const kpiSvcGrpCd = prodSvcList[0].KPI_SVC_GRP_CD || '';
              console.log('[2PairCheck] KPI_SVC_GRP_CD=', kpiSvcGrpCd);
              if (kpiSvcGrpCd.length > 0 && kpiSvcGrpCd.substring(0, 1) !== '5') {
                console.log('[2PairCheck] WARNING - Own product 2Pair area detected');
                setShowWarning(true);
              }
            }
          }
        }
      } catch (error) {
        console.error('[2PairCheck] Error:', error);
      }
    };

    check2Pair();
  }, [bldId, prodCd, prodGrp, wrkCd, uplsProdList, isLoaded]);

  return { showWarning, setShowWarning };
};
