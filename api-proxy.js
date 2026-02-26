// EC2 API Proxy (Express.js Router) - Fixed Version
// Routes to /api/* servlet (our custom controllers) instead of *.req (CONA servlet)
const express = require('express');
const router = express.Router();
const iconv = require('iconv-lite');

const DLIVE_API_BASE = process.env.DLIVE_API_BASE || 'http://58.143.140.222:8080';

// CONA JSESSIONID 저장 (로그인 시 캡처, 이후 모든 요청에 주입)
let storedJSessionId = null;
let storedUserId = null;  // 로그인한 사용자 ID (ACCESS_TICKET용)

// Path mapping from frontend API to D'Live legacy API
const PATH_MAPPING = {
  "/login": "/api/login",   // TaskAuthController로 라우팅 (CONA 세션 생성)
  "/ping": "/ping",
  "/work/directions": "/api/work/directions",
  "/work/receipts": "/api/work/receipts",
  "/work/cancel": "/api/work/cancel",
  "/work/complete": "/api/work/complete",
  "/customer/work/getEquipLossInfo_ForM": "/api/customer/work/getEquipLossInfo",  // 어댑터 경유 (레거시 .req는 CONA 세션 필요)
};

// Routes that should go directly to legacy .req servlet (bypass our adapter)
// NOTE: getEquipmentHistoryInfo removed - our adapter handles it with getEquipmentHistoryInfo_2
// NOTE: _m APIs go through EC2 /api/* (D'Live requires separate session we don't have)
const LEGACY_REQ_ROUTES = [

  // Equipment Processing 3 APIs - Route directly to legacy .req servlet
  "/customer/phoneNumber/getOwnEqtLstForMobile_3",  // 장비반납
  "/customer/equipment/getAuthSoList",  // SO 권한 목록
  "/customer/equipment/getEqtTrnsList",  // 장비이동내역
  "/customer/work/getProd_Grp",  // AS접수 콤보상세 (상품그룹)
  // getEquipLossInfo_ForM → PATH_MAPPING으로 어댑터 경유 (레거시 .req CONA 세션 인증 실패)
];

// Parse MiPlatform XML response to JSON
function parseMiPlatformXMLtoJSON(xmlString) {
  try {
    // Extract record data from XML
    const records = [];
    const recordRegex = /<record>([\s\S]*?)<\/record>/gi;
    let match;

    while ((match = recordRegex.exec(xmlString)) !== null) {
      const recordContent = match[1];
      const record = {};

      // Extract each field: <FIELD_NAME>value</FIELD_NAME>
      const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
      let fieldMatch;

      while ((fieldMatch = fieldRegex.exec(recordContent)) !== null) {
        const fieldName = fieldMatch[1];
        let fieldValue = fieldMatch[2];
        // Decode XML entities
        fieldValue = fieldValue
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        record[fieldName] = fieldValue;
      }

      if (Object.keys(record).length > 0) {
        records.push(record);
      }
    }

    // If single record, return as object; otherwise return array
    if (records.length === 1) {
      return records[0];
    }
    return records.length > 0 ? records : null;
  } catch (e) {
    console.error('[PROXY] XML parsing error:', e.message);
    return null;
  }
}

// Parse MiPlatform XML <params> response to JSON
// This handles responses like: <params><RESULT>0</RESULT><MSG>Success</MSG></params>
// Or: <param name="RESULT">0</param> format
// Or: <param id="RESULT" type="STRING">0</param> format (CONA style)
function parseMiPlatformParamsXMLtoJSON(xmlString) {
  try {
    const result = {};

    // Decode HTML entities for better parsing
    const decodeEntities = (str) => {
      return str
        .replace(/&#32;/g, ' ')
        .replace(/&#10;/g, '\n')
        .replace(/&#9;/g, '\t')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    };

    // Try format 1: <param id="KEY" type="...">value</param> (CONA MiPlatform style)
    const paramIdRegex = /<param\s+id="(\w+)"[^>]*>([^<]*)<\/param>/gi;
    let match;
    while ((match = paramIdRegex.exec(xmlString)) !== null) {
      result[match[1]] = decodeEntities(match[2]);
    }

    // Try format 2: <param name="KEY">value</param>
    if (Object.keys(result).length === 0) {
      const paramNameRegex = /<param\s+name="(\w+)"[^>]*>([^<]*)<\/param>/gi;
      while ((match = paramNameRegex.exec(xmlString)) !== null) {
        result[match[1]] = decodeEntities(match[2]);
      }
    }

    // Try format 3: <KEY>value</KEY> inside <params>
    if (Object.keys(result).length === 0) {
      const paramsMatch = xmlString.match(/<params>([\s\S]*?)<\/params>/i);
      if (paramsMatch) {
        const paramsContent = paramsMatch[1];
        const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(paramsContent)) !== null) {
          result[fieldMatch[1]] = decodeEntities(fieldMatch[2]);
        }
      }
    }

    // Try format 4: Direct field tags in root (for simple responses)
    if (Object.keys(result).length === 0) {
      const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(xmlString)) !== null) {
        const fieldName = fieldMatch[1];
        // Skip XML declaration and root tags
        if (fieldName === 'xml' || fieldName === 'Root' || fieldName === 'Dataset' ||
            fieldName === 'ColumnInfo' || fieldName === 'Rows' || fieldName === 'Row' ||
            fieldName === 'Column' || fieldName === 'Col' || fieldName === 'root' ||
            fieldName === 'params') continue;
        result[fieldName] = decodeEntities(fieldMatch[2]);
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (e) {
    console.error('[PROXY] Params XML parsing error:', e.message);
    return null;
  }
}

// Convert JSON to MiPlatform XML Dataset format
function jsonToMiPlatformXML(datasetName, jsonData) {
  // Build column info from JSON keys
  const columns = Object.keys(jsonData);
  let columnInfo = '';
  columns.forEach(col => {
    columnInfo += `<Column id="${col}" type="STRING" size="256"/>`;
  });

  // Build row data
  let rowData = '<Row>';
  columns.forEach(col => {
    const value = jsonData[col] || '';
    rowData += `<Col id="${col}">${escapeXml(value)}</Col>`;
  });
  rowData += '</Row>';

  // Full XML structure (euc-kr: CONA PlatformRequest uses euc-kr charset)
  return `<?xml version="1.0" encoding="euc-kr"?>
<Root xmlns="http://www.tobesoft.com/platform/dataset">
<Dataset id="${datasetName}">
<ColumnInfo>${columnInfo}</ColumnInfo>
<Rows>${rowData}</Rows>
</Dataset>
</Root>`;
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Build multi-dataset MiPlatform XML (원본 CONA 클라이언트 형식)
// D'Live .req 서블릿은 여러 데이터셋을 하나의 XML에서 읽음
function buildMultiDatasetXML(datasets) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Root xmlns="http://www.tobesoft.com/platform/dataset">\n';

  for (const [name, data] of Object.entries(datasets)) {
    if (!data || typeof data !== 'object') continue;
    const columns = Object.keys(data);
    xml += '<Dataset id="' + name + '">\n<ColumnInfo>';
    columns.forEach(col => {
      xml += '<Column id="' + col + '" type="STRING" size="256"/>';
    });
    xml += '</ColumnInfo>\n<Rows>';
    if (columns.length > 0) {
      xml += '<Row>';
      columns.forEach(col => {
        xml += '<Col id="' + col + '">' + escapeXml(String(data[col] || '')) + '</Col>';
      });
      xml += '</Row>';
    }
    xml += '</Rows>\n</Dataset>\n';
  }

  xml += '</Root>';
  return xml;
}

// Parse MiPlatform Dataset XML response (<Col id="KEY">value</Col> 형식)
function parseMiPlatformDatasetXMLtoJSON(xmlString) {
  try {
    const decodeEntities = (str) => str
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#32;/g, ' ').replace(/&#10;/g, '\n').replace(/&#9;/g, '\t');

    // Try multi-row parsing first: extract each <Row>...</Row>
    const rowRegex = /<Row>([\s\S]*?)<\/Row>/gi;
    const rows = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(xmlString)) !== null) {
      const rowContent = rowMatch[1];
      const row = {};
      const colRegex = /<Col\s+id="([^"]+)"[^>]*>([^<]*)<\/Col>/gi;
      let colMatch;
      while ((colMatch = colRegex.exec(rowContent)) !== null) {
        row[colMatch[1]] = decodeEntities(colMatch[2]);
      }
      if (Object.keys(row).length > 0) {
        rows.push(row);
      }
    }
    if (rows.length > 0) return rows;

    // Fallback: flat object (single row without <Row> wrapper)
    const result = {};
    const colRegex = /<Col\s+id="([^"]+)"[^>]*>([^<]*)<\/Col>/gi;
    let match;
    while ((match = colRegex.exec(xmlString)) !== null) {
      result[match[1]] = decodeEntities(match[2]);
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch (e) {
    console.error('[PROXY] Dataset XML parsing error:', e.message);
    return null;
  }
}

// DIRECT_REQ_ROUTES: .req 서블릿 직접 라우팅 (현재 비활성)
// 상담등록은 어댑터(/api/...) 경로 사용 - TaskAuthController 세션이 .req 서블릿에서 인식 안됨
// .req 서블릿은 CONA 원본 MiPlatform 로그인 세션만 인식
const DIRECT_REQ_ROUTES = {};

// Proxy routes
router.post('/login', handleProxy);
router.post('/work/directions', handleProxy);
router.post('/work/receipts', handleProxy);
router.post('/work/cancel', handleProxy);
router.post('/work/complete', handleProxy);
router.get('/work/safety-checks', handleProxy);
router.post('/work/safety-check', handleProxy);
router.get('/work/safety-check/status', handleProxy);
router.get('/signal/ens-history', handleProxy);
router.get('/work/result-signals', handleProxy);
router.post('/lgu/construction-request', handleProxy);
router.post('/lgu/network-fault', handleProxy);
router.get('/ping', handleProxy);

// Customer/Work API
router.post('/customer/work/getCustProdInfo', handleProxy);
router.post('/customer/work/eqtCmpsInfoChg', handleProxy);
router.post('/customer/work/signalCheck', handleProxy);
router.post('/customer/work/workComplete', handleProxy);
router.post('/customer/work/saveInstallInfo', handleProxy);
router.post('/customer/work/insertWorkRemoveStat', handleProxy);
router.post('/customer/work/modAsPdaReceipt', handleProxy);
router.post('/customer/work/getProd_Grp', handleProxy);
router.post('/customer/work/getEquipLossInfo', handleProxy);
router.post('/customer/work/getEquipLossInfo_ForM', handleProxy);
router.post('/customer/work/modEquipLoss', handleProxy);
router.post('/customer/work/modEquipLoss_ForM', handleProxy);

// Customer/Receipt/Contract API
router.post('/customer/receipt/contract/getEquipmentNmListOfProd', handleProxy);
router.post('/customer/receipt/contract/getContractEqtList', handleProxy);
router.post('/customer/etc/getPromOfContract', handleProxy);
router.post('/customer/etc/saveCtrtAgreeInfo', handleProxy);
router.post('/customer/work/checkStbServerConnection', handleProxy);

// Common API
router.post('/common/getCommonCodeList', handleProxy);
router.post('/common/getCommonCodes', handleProxy);

// Customer/Negociation API
router.post('/customer/negociation/getCustomerCtrtInfo', handleProxy);

// Customer Management APIs (Legacy CONA paths)
// 1. Customer Search - uses getConditionalCustList2 with SERCH_GB parameter
router.post('/customer/common/customercommon/getConditionalCustList2', handleProxy);
router.post('/customer/negociation/getCustInfo', handleProxy);
// 2. Contract Info
router.post('/customer/negociation/getCustCtrtInfoListCnt_1', handleProxy);
router.post('/customer/negociation/getCustCtrtAll', handleProxy);
router.post('/customer/negociation/getCustSearchCtrt', handleProxy);
router.post('/customer/work/getProdPromotionInfo', handleProxy);
// 3. Payment/Billing Info
router.post('/customer/negociation/getCustAccountInfo', handleProxy);
router.post('/customer/negociation/getCustDpstInfo', handleProxy);
router.post('/customer/negociation/getCustPymInfo', handleProxy);
router.post('/customer/negociation/getHPPayList', handleProxy);
router.post('/customer/negociation/saveHPPayInfo', handleProxy);  // HP Pay apply/cancel
router.post('/billing/unpayment/upreport/getUnpaymentNowList', handleProxy);
router.post('/billing/unpayment/upreport/getUnpaymentNowDtlList', handleProxy);
// 3-1. Card Payment (미납금 카드수납)
router.post('/billing/payment/anony/getCardVendorBySoId', handleProxy);
router.post('/billing/payment/anony/insertDpstAndDTL', handleProxy);
router.post('/billing/payment/anony/insertCardPayStage', handleProxy);
router.post('/billing/payment/anony/processCardPayment', handleProxy);
// 4. History (D'Live: CUST_ID만으로 조회 가능 - LEGACY_REQ_ROUTES로 .req 직접 호출)
router.post('/customer/negociation/getTgtCtrtRcptHist_m', handleProxy);  // 상담이력
router.post('/customer/negociation/getTgtCtrtWorkList_m', handleProxy);  // 작업이력
// 4-1. Payment & Billing (Mobile) - D'Live SQL 스펙
router.post('/customer/negociation/getCustAccountInfo_m', handleProxy);  // 납부정보 조회
router.post('/customer/negociation/getCustBillInfo_m', handleProxy);     // 요금내역 조회
// Legacy (deprecated)
router.post('/customer/negociation/getCallHistory', handleProxy);
router.post('/customer/negociation/getCustWorkList', handleProxy);
// 5. Info Change
router.post('/customer/negociation/updateCustTelDetailInfo', handleProxy);
router.post('/customer/etc/saveMargeAddrOrdInfo', handleProxy);
router.post('/customer/etc/savePymAddrInfo', handleProxy);
router.post('/customer/customer/general/customerPymChgAddManager', handlePaymentMethodChange);  // handlePaymentMethodChange calls .req directly; adapter fallback via handleProxy if needed
router.post('/customer/customer/general/addCustomerPymInfoChange', handleProxy);
router.post('/customer/payment/verifyBankAccount', handleBankAccountVerify);  // KSNET bank account verify (.req direct)
// 6. Consultation/AS
router.post('/customer/negociation/saveCnslRcptInfo', handleProxy);
// 7. Customer Create
router.post('/customer/customer/general/customerManager', handleProxy);
// 8. Electronic Contract
router.post('/customer/contract/requestElectronicSign', handleProxy);
router.post('/customer/contract/getElectronicSignStatus', handleProxy);

// Customer/Contract API
router.post('/customer/contract/getContractInfo', handleProxy);
router.post('/customer/contract/getBillingInfo', handleProxy);
router.post('/customer/contract/getFullContractInfo', handleProxy);

// Integration API
router.post('/integration/history', handleProxy);
router.post('/customer/sigtrans/history', handleProxy);
router.post('/customer/sigtrans/getSendHistory', handleProxy);
router.post('/customer/sigtrans/saveENSSendHist', handleProxy);
router.post('/customer/sigtrans/getENSSendHist', handleProxy);

// Signal API
router.post('/signal/send', handleProxy);
router.post('/signal/removal', handleProxy);
router.post('/signal/metro', handleProxy);
router.post('/signal/port-close', handleProxy);
router.post('/signal/port-open', handleProxy);
router.post('/signal/port-reset', handleProxy);
router.post('/customer/work/modIfSvc', handleProxy);
router.post('/customer/equipment/callMetroEqtStatusSearch', handleProxy);
router.post('/customer/sigtrans/removal', handleProxy);
router.post('/customer/sigtrans/portClose', handleProxy);
router.post('/customer/sigtrans/portOpen', handleProxy);
router.post('/customer/sigtrans/portReset', handleProxy);

// Customer/Equipment API
router.post('/customer/equipment/getEquipmentOutList', handleProxy);
router.post('/customer/equipment/getOutEquipmentTargetList', handleProxy);     // Out Equipment Target List
router.post('/customer/equipment/getEquipmentProcYnCheck', handleProxy);
router.post('/customer/equipment/addCorporationEquipmentQuota', handleProxy);
router.post('/customer/equipment/getEquipmentReturnRequestList', handleProxy);
router.post('/customer/equipment/getEquipmentReturnRequestCheck', handleProxy);
router.post('/customer/equipment/addEquipmentReturnRequest', handleProxy);
router.post('/customer/equipment/delEquipmentReturnRequest', handleProxy);  // 반납취소
router.post('/customer/equipment/getWrkrHaveEqtList', handleProxy);
router.post('/customer/equipment/cmplEqtCustLossIndem', handleProxy);
router.post('/customer/equipment/setEquipmentChkStndByY', handleProxy);
router.post('/customer/equipment/setEquipmentChkStndByY_ForM', handleProxy);  // 검사대기 -> 사용가능 (ForM)
router.post('/customer/equipment/changeEqtWrkr_3', handleProxy);
router.post('/customer/equipment/changeEqtWrkr_3_ForM', handleProxy);  // 신규 장비이관 (Map 반환)
router.post('/customer/equipment/updateInstlLocFrWrk', handleProxy);
router.post('/customer/equipment/getAuthSoList', handleProxy);
router.post('/customer/equipment/getUserExtendedInfo', handleProxy);

// Equipment Processing APIs (3 categories)
router.post('/customer/equipment/getWrkrHaveEqtList_All', handleProxy);        // My Equipment (보유장비)
router.post('/customer/equipment/searchWorkersByName', handleProxy);        // 기사 이름 검색
router.post("/customer/equipment/getEquipmentChkStndByA_All", handleProxy);  // 검사대기
router.post("/customer/phoneNumber/getOwnEqtLstForMobile_3", handleProxy);  // 장비반납
router.post("/customer/phoneNumber/getCtrtIDforSmartPhone", handleProxy);  // 고객검색 (전화번호)
router.post("/customer/equipment/getOwnEqtLstForMobile_3", handleProxy);  // 반납요청 (equipment 경로)
router.post("/customer/equipment/getEquipmentReturnRequestList_All", handleProxy);  // 반납요청 _All (추가)
router.post("/customer/equipment/getWrkrListDetail", handleProxy);  // 분실처리 상세조회 (추가)
router.post("/customer/equipment/getEquipmentTypeList", handleProxy);  // 장비 소분류 목록 조회
router.post("/customer/equipment/getEqtTrnsList", handleProxy);  // 장비이동내역

// Statistics/Equipment API
router.post('/statistics/equipment/getEquipmentHistoryInfo', handleProxy);

// Statistics/Customer API (Address Search)
router.post('/statistics/customer/getPostList', handleProxy);  // 지번주소 검색

// Customer Common API (Address Search)
router.post('/customer/common/customercommon/getStreetAddrList', handleProxy);  // 도로명주소 검색

// System/CM API
router.post('/system/cm/getFindUsrList3', handleProxy);

// Debug endpoints (GET)
router.get('/debug/equipmentManager/methods', handleProxy);
router.get('/debug/sigtransManagement/methods', handleProxy);
router.get('/debug/workmanAssignManagement/methods', handleProxy);
// Customer Management debug endpoints
router.get('/customer/debug/listBeans', handleProxy);
router.get('/customer/debug/negociationDao/methods', handleProxy);
router.get('/customer/debug/customerManagerService/methods', handleProxy);
router.get('/customer/debug/customerManager/methods', handleProxy);
router.get('/customer/debug/billingManagement/methods', handleProxy);
router.get('/customer/debug/customerEtcManagement/methods', handleProxy);
router.get('/customer/debug/sampleHistoryData', handleProxy);
router.post('/customer/debug/testDao', handleProxy);

// === 계좌 실명인증 핸들러 (KSNET) ===
// CONA AddCustomerRlnmAuthCheck.req 직접 호출
// CustomerManagerDelegate.AddCustomerRlnmAuthCheck → CustomerManagerImpl.addCustomerRlnmAuthCheck
// CHECK_TYPE "E": KSNET 계좌인증 (lc.KSNET_ReqAcnt_0610)
// CHECK_TYPE "A": NICE 실명인증 (lc.NICE_ReqNameInfo)
async function handleBankAccountVerify(req, res) {
  try {
    const body = req.body || {};
    console.log('\n========== [BankAccountVerify] ==========');
    console.log('Input params:', JSON.stringify(body, null, 2));

    // JSESSIONID 인증 사용 - USR_ID 체크 불필요 (로그인 세션이 있으면 됨)

    // CONA 파라미터 매핑 (CustomerManagerImpl.addCustomerRlnmAuthCheck 기준)
    const checkType = body.CHECK_TYPE || 'E';  // E=계좌인증, A=실명인증
    const custTp = body.CUST_TP || 'A';
    const custNm = body.CUST_NM || '';
    const rsdtCrrno = body.RSDT_CRRNO || '';
    const cardAcntCd = body.CARD_ACNT_CD || body.BANK_CD || '';
    const cardAcntNo = body.CARD_ACNT_NO || body.ACNT_NO || '';
    const pymAcntId = body.PYM_ACNT_ID || '';

    const reqParams = {
      CHECK_TYPE: checkType,
      CUST_TP: custTp,
      CUST_NM: custNm,
      RSDT_CRRNO: rsdtCrrno,
      CARD_ACNT_CD: cardAcntCd,
      CARD_ACNT_NO: cardAcntNo,
      PYM_ACNT_ID: pymAcntId,
      SUB_RSDT: body.SUB_RSDT || '',
      CDTCD_EXP_DT: body.CDTCD_EXP_DT || '',
      CARD_PASS: body.CARD_PASS || '',
      RFND_GUBUN: body.RFND_GUBUN || '',
      PAGE_GB: body.PAGE_GB || 'MOBILE'
    };

    console.log('[BankAccountVerify] CHECK_TYPE=' + checkType + ' CUST_TP=' + custTp + ' BANK=' + cardAcntCd + ' ACNT=****' + cardAcntNo.slice(-4));

    // .req 엔드포인트 직접 호출 (ARGUMENT_VARIABLES 형식)
    const xmlBody = jsonToMiPlatformXML('DS_INPUT', reqParams);
    const postData = iconv.encode(xmlBody, 'euc-kr');

    // JSESSIONID required (from login session) - ACCESS_TICKET has WebSphere %2F issue
    const reqPath = '/customer/customer/general/addCustomerRlnmAuthCheck.req';
    if (!storedJSessionId) {
      console.log('[BankAccountVerify] No JSESSIONID - login required');
      return res.json({ success: false, code: 'NO_SESSION', message: 'Login session required for bank verification', data: {} });
    }
    const targetUrl = DLIVE_API_BASE + reqPath;
    console.log('[BankAccountVerify] URL:', targetUrl, '(JSESSIONID auth)');

    const http = require('http');

    const options = {
      hostname: '58.143.140.222',
      port: 8080,
      path: reqPath,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=euc-kr',
        'Content-Length': postData.length,
        'Cookie': storedJSessionId ? 'JSESSIONID=' + storedJSessionId : ''
      },
      timeout: 30000
    };

    const proxyReq = http.request(options, (proxyRes) => {
      let chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let responseText;
        try {
          responseText = iconv.decode(rawBuffer, 'euc-kr');
        } catch (e) {
          responseText = rawBuffer.toString('utf-8');
        }
        console.log('[BankAccountVerify] Status:', proxyRes.statusCode);
        console.log('[BankAccountVerify] Response:', responseText.substring(0, 800));

        // JSESSIONID 캡처
        const setCookies = proxyRes.headers['set-cookie'];
        if (setCookies) {
          (Array.isArray(setCookies) ? setCookies : [setCookies]).forEach(c => {
            const m = c.match(/JSESSIONID=([^;]+)/);
            if (m) { storedJSessionId = m[1]; }
          });
        }

        // CONA 에러 코드 확인
        const errorCodeMatch = responseText.match(/ErrorCode[^>]*>([^<]+)/);
        const errorReasonMatch = responseText.match(/ExceptionReason[^>]*>([^<]+)/);
        const errorCode = errorCodeMatch ? errorCodeMatch[1].trim() : null;
        const errorReason = errorReasonMatch ? errorReasonMatch[1].replace(/&#32;/g, ' ').replace(/&#10;/g, '\n') : null;

        if (errorCode && errorCode !== '0') {
          console.error('[BankAccountVerify] CONA error: code=' + errorCode + ', reason=' + errorReason);
          return res.json({ success: false, code: 'CONA_ERROR', message: errorReason || 'CONA error (' + errorCode + ')', data: {} });
        }

        // SRVE0255E (servlet not found) 처리
        if (responseText.includes('SRVE0255E') || responseText.includes('SRVE0207E')) {
          console.error('[BankAccountVerify] Servlet error');
          return res.json({ success: false, code: 'SERVLET_ERROR', message: 'CONA verification servlet unavailable', data: {} });
        }

        // MiPlatform dataset 응답 파싱
        const parsed = parseMiPlatformDatasetXMLtoJSON(responseText);
        if (parsed) {
          const data = Array.isArray(parsed) ? parsed[0] : parsed;
          const rspnCd = data.RSPN_CD || '';
          const resMsg = data.RES_MSG || '';
          console.log('[BankAccountVerify] RSPN_CD=' + rspnCd + ' RES_MSG=' + resMsg);
          if (rspnCd === '0000') {
            return res.json({ success: true, code: 'SUCCESS', message: resMsg || 'Verification successful', data: data });
          }
          return res.json({ success: true, code: 'SUCCESS', message: resMsg || 'Verification result', data: data });
        }

        // MiPlatform params 응답 파싱
        const paramsData = parseMiPlatformParamsXMLtoJSON(responseText);
        if (paramsData) {
          return res.json({ success: true, code: 'SUCCESS', message: paramsData.MESSAGE || 'OK', data: paramsData });
        }

        // responseSingleList 뷰
        if (responseText.includes('ErrorCode>0<') || responseText.includes('responseSingleList')) {
          // Record 데이터 파싱
          const records = parseMiPlatformXMLtoJSON(responseText);
          if (records && records.length > 0) {
            return res.json({ success: true, code: 'SUCCESS', message: 'OK', data: records[0] });
          }
          return res.json({ success: true, code: 'SUCCESS', message: 'OK', data: {} });
        }

        // 그 외
        console.log('[BankAccountVerify] Unknown response format');
        return res.json({ success: false, code: 'UNKNOWN', message: 'Unknown response from CONA', data: { raw: responseText.substring(0, 300) } });
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[BankAccountVerify] Request error:', err.message);
      res.json({ success: false, code: 'ERROR', message: err.message, data: {} });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      console.error('[BankAccountVerify] Timeout');
      res.json({ success: false, code: 'TIMEOUT', message: 'Verification request timed out', data: {} });
    });

    proxyReq.write(postData);
    proxyReq.end();

  } catch (error) {
    console.error('[BankAccountVerify] Error:', error.message);
    res.json({ success: false, code: 'ERROR', message: error.message, data: {} });
  }
}

// === 납부방법 변경 특별 핸들러 ===
// 어댑터의 addCustomerPymChgInfo (잘못된 메서드명: saveHdcPymAcntInfo로 fallback) 대신
// 레거시 .req 엔드포인트 직접 호출 (ACCESS_TICKET으로 UserVO 인증 우회)
//
// 전략:
// 1차: savePymAtmtApplInfo.req (모바일용, ARGUMENT_VARIABLES 사용, UPPERCASE 파라미터)
// 2차: customerPymChgAddManager.req (데스크톱용, MERGED_LIST 사용, lowercase 파라미터)
// 어댑터 fallback 없음 (어댑터가 saveHdcPymAcntInfo 호출하여 실제 DB 변경 안 됨)
async function handlePaymentMethodChange(req, res) {
  try {
    const body = req.body || {};
    console.log('\n========== [PaymentMethodChange] ==========');
    console.log('Input params:', JSON.stringify(body, null, 2));

    // 1. ACCESS_TICKET 구성 (Authentication.java의 UserVO 자동생성 우회)
    // 형식: userId###fileUUID###expireDate
    const userId = body.USR_ID || storedUserId || '';
    if (!userId) {
      return res.json({ success: false, code: 'NO_USER', message: '로그인이 필요합니다 (USR_ID 없음)', data: {} });
    }
    const accessTicket = encodeURIComponent(userId + '###payment-change###2099/01/01_00:00:00:0000');

    // 2. 파라미터 매핑
    const pymMthCd = body.PYM_MTH_CD || body.PYM_MTHD || '';
    let pymMthd = pymMthCd;
    // 코드 변환: 프론트 01(자동이체)→CONA 02, 프론트 02(카드)→CONA 04
    if (pymMthCd === '01') pymMthd = '02';
    else if (pymMthCd === '02') pymMthd = '04';

    const bankCard = body.BANK_CD || body.CARD_CO_CD || body.BNK_CARD_CD || body.BANK_CARD || '';
    const acntNo = body.ACNT_NO || body.CARD_NO || body.ACNT_CARD_NO || '';
    const ownerNm = body.ACNT_OWNER_NM || body.PYM_CUST_NM || '';
    const cardValidYm = body.CARD_VALID_YM || body.CDTCD_EXP_DT || '';
    const payDay = body.PAY_DAY_CD || body.PYM_CARD_DATE || body.PYM_HOPE_DD || '';
    const birthDt = body.BIRTH_DT || body.PYM_CUST_CRRNO || body.RSDTNO || '';
    const pyrRel = body.PAYER_REL_CD || body.PYR_REL || '';

    // 3. savePymAtmtApplInfo용 UPPERCASE 파라미터 (pcmcu_pym_mthd_mobile_upd 프로시저)
    const mobileParams = {
      PYM_ACNT_ID: body.PYM_ACNT_ID || '',
      RCPT_ID: body.RCPT_ID || '',
      PYM_MTHD: pymMthd,
      ACNT_OWNER_NM: ownerNm,
      BNK_CARD_CD: bankCard,
      ACNT_NO: acntNo,
      RSDTNO: birthDt,
      CARD_CL: body.CARD_CL || '',
      REQR_NM: body.REQR_NM || ownerNm,
      PYR_REL: pyrRel,
      CDTCD_EXP_DT: cardValidYm,
      RLNM_TP_CD: body.RLNM_TP_CD || 'N',
      CORP_CD: body.CORP_CD || '',
      PYM_HOPE_DD: payDay,
      ATRT_CRR_ID: body.ATRT_CRR_ID || body.SO_ID || '',
      ATRT_EMP_ID: body.ATRT_EMP_ID || userId,
      REG_UID: userId
    };

    // 4. addCustomerPymChgInfo용 lowercase 파라미터 (pcmcu_pym_mthd_card_info_upd 프로시저)
    const desktopParams = {
      pym_mthd: pymMthd,
      bank_card: bankCard,
      acnt_card_no: acntNo,
      pym_card_date: payDay,
      pym_cust_nm: ownerNm,
      pym_cust_crrno: birthDt,
      pyr_rel: pyrRel,
      pmc_resn: body.CHG_RESN_M_CD || body.CHG_RESN_L_CD || body.PMC_RESN || '',
      cdtcd_exp_dt: cardValidYm,
      partner_card_cd: body.CARD_CL || '',
      pym_acnt_id: body.PYM_ACNT_ID || '',
      ctrt_id: body.CTRT_ID || '',
      cust_id: body.CUST_ID || '',
      so_id: body.SO_ID || '',
      user_id: userId,
      // 프로시저 필수 기본값들
      bill_mdm_cd: '01',
      bill_mdm_email: '',
      bill_mdm_hp: '',
      bill_mdm_fax: '',
      rlnm_tp_cd: body.RLNM_TP_CD || 'N',
      atrt_crr_id: body.ATRT_CRR_ID || body.SO_ID || '',
      atrt_emp_id: body.ATRT_EMP_ID || userId
    };

    console.log('[PaymentMethodChange] Mobile params:', JSON.stringify(mobileParams, null, 2));
    console.log('[PaymentMethodChange] ACCESS_TICKET userId:', userId);

    // 5. 먼저 어댑터(api-servlet) 경유 시도, 실패 시 .req 직접 호출
    // 어댑터는 negociationDao의 SqlMapClient를 통해 직접 프로시저 호출 가능
    console.log('[PaymentMethodChange] Step 1: Trying adapter path...');
    const adapterBody = JSON.stringify(body);
    const adapterPath = '/api/customer/customer/general/customerPymChgAddManager';
    const adapterUrl = DLIVE_API_BASE + adapterPath;

    const adapterHttp = require('http');
    const adapterUrlMod = require('url');
    const adapterParsedUrl = adapterUrlMod.parse(adapterUrl);

    const adapterReq = adapterHttp.request({
      hostname: adapterParsedUrl.hostname,
      port: adapterParsedUrl.port || 80,
      path: adapterParsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(adapterBody),
        'Cookie': storedJSessionId ? 'JSESSIONID=' + storedJSessionId : ''
      },
      timeout: 30000
    }, (adapterRes) => {
      let chunks = [];
      adapterRes.on('data', (chunk) => chunks.push(chunk));
      adapterRes.on('end', () => {
        const responseText = Buffer.concat(chunks).toString('utf-8');
        console.log('[PaymentMethodChange] Adapter response status:', adapterRes.statusCode);
        console.log('[PaymentMethodChange] Adapter response:', responseText.substring(0, 500));

        try {
          const adapterData = JSON.parse(responseText);
          // 어댑터 성공 시
          if (adapterData.code === 'SUCCESS' || adapterData.code === '0') {
            console.log('[PaymentMethodChange] Adapter SUCCESS!');
            return res.json({ success: true, code: 'SUCCESS', message: adapterData.message || '납부방법이 변경되었습니다', data: adapterData.data || {} });
          }
          // 어댑터 실패 시 .req fallback
          console.log('[PaymentMethodChange] Adapter failed (code=' + adapterData.code + '), falling back to .req endpoints...');
        } catch (e) {
          console.log('[PaymentMethodChange] Adapter parse error, falling back to .req endpoints...');
        }

        // Fallback: .req 직접 호출
        const endpoints = [
          { url: '/customer/customer/general/customerPymChgAddManager.req', params: desktopParams, name: 'addCustomerPymChgInfo' },
          { url: '/customer/customer/general/savePymAtmtApplInfo.req', params: mobileParams, name: 'savePymAtmtApplInfo' }
        ];
        callLegacyReqEndpoint(endpoints, 0, accessTicket, res);
      });
    });
    adapterReq.on('error', (err) => {
      console.error('[PaymentMethodChange] Adapter error:', err.message, ', falling back to .req endpoints...');
      const endpoints = [
        { url: '/customer/customer/general/customerPymChgAddManager.req', params: desktopParams, name: 'addCustomerPymChgInfo' },
        { url: '/customer/customer/general/savePymAtmtApplInfo.req', params: mobileParams, name: 'savePymAtmtApplInfo' }
      ];
      callLegacyReqEndpoint(endpoints, 0, accessTicket, res);
    });
    adapterReq.write(adapterBody);
    adapterReq.end();

  } catch (error) {
    console.error('[PaymentMethodChange] Error:', error.message);
    res.json({ success: false, code: 'ERROR', message: error.message, data: {} });
  }
}

// .req 엔드포인트를 순차적으로 시도하는 함수
function callLegacyReqEndpoint(endpoints, index, accessTicket, res) {
  if (index >= endpoints.length) {
    return res.json({ success: false, code: 'ALL_FAILED', message: '모든 납부변경 경로가 실패했습니다. CONA 서버 연결을 확인하세요.', data: {} });
  }

  const ep = endpoints[index];
  const xmlBody = jsonToMiPlatformXML('DS_INPUT', ep.params);

  // euc-kr 인코딩 (CONA PlatformRequest가 euc-kr로 읽음)
  const postData = iconv.encode(xmlBody, 'euc-kr');

  const targetUrl = DLIVE_API_BASE + ep.url + '?ACCESS_TICKET=' + accessTicket;
  console.log('[PaymentMethodChange] [' + (index + 1) + '/' + endpoints.length + '] Calling: ' + ep.name);
  console.log('[PaymentMethodChange] URL:', targetUrl);

  const http = require('http');
  const urlMod = require('url');
  const parsedUrl = urlMod.parse(targetUrl);

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=euc-kr',
      'Content-Length': postData.length,
      'Cookie': storedJSessionId ? 'JSESSIONID=' + storedJSessionId : ''
    },
    timeout: 30000
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let chunks = [];
    proxyRes.on('data', (chunk) => chunks.push(chunk));
    proxyRes.on('end', () => {
      const rawBuffer = Buffer.concat(chunks);
      let responseText;
      try {
        responseText = iconv.decode(rawBuffer, 'euc-kr');
      } catch (e) {
        responseText = rawBuffer.toString('utf-8');
      }
      console.log('[PaymentMethodChange] [' + ep.name + '] Status:', proxyRes.statusCode);
      console.log('[PaymentMethodChange] [' + ep.name + '] Response:', responseText.substring(0, 800));

      // JSESSIONID 캡처 (새 세션이 생성될 수 있음)
      const setCookies = proxyRes.headers['set-cookie'];
      if (setCookies) {
        const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
        arr.forEach(c => {
          const match = c.match(/JSESSIONID=([^;]+)/);
          if (match) {
            storedJSessionId = match[1];
            console.log('[PaymentMethodChange] Captured new JSESSIONID');
          }
        });
      }

      // CONA 에러 코드 확인
      const errorCodeMatch = responseText.match(/ErrorCode[^>]*>([^<]+)/);
      const errorReasonMatch = responseText.match(/ExceptionReason[^>]*>([^<]+)/);
      const errorCode = errorCodeMatch ? errorCodeMatch[1].trim() : null;
      const errorReason = errorReasonMatch ? errorReasonMatch[1].replace(/&#32;/g, ' ').replace(/&#10;/g, '\n') : null;

      if (errorCode && errorCode !== '0') {
        console.error('[PaymentMethodChange] [' + ep.name + '] CONA error: code=' + errorCode + ', reason=' + errorReason);
        // 서버 에러(-1: NPE/Exception) 또는 세션/인증 에러(-200)는 다음 엔드포인트로 시도
        if (errorCode === '-1' || errorCode === '-200' ||
            (errorReason && (errorReason.includes('NullPointer') || errorReason.includes('로그인') || errorReason.includes('인증') || errorReason.includes('Exception')))) {
          console.log('[PaymentMethodChange] Server/auth error (code=' + errorCode + '), trying next endpoint...');
          return callLegacyReqEndpoint(endpoints, index + 1, accessTicket, res);
        }
        // 비즈니스 에러는 그대로 반환 (실제 처리가 되었다는 뜻)
        return res.json({ success: false, code: 'CONA_ERROR', message: errorReason || 'CONA error (code: ' + errorCode + ')', data: {} });
      }

      // MiPlatform dataset 응답 파싱
      const parsed = parseMiPlatformDatasetXMLtoJSON(responseText);
      if (parsed) {
        const data = Array.isArray(parsed) ? parsed[0] : parsed;
        const msgCode = data.MSGCODE || data.MSG_CODE || '';
        const message = data.MESSAGE || data.MSG || '';
        console.log('[PaymentMethodChange] [' + ep.name + '] MSGCODE:', msgCode, 'MESSAGE:', message);
        if (msgCode && msgCode !== '' && msgCode !== 'SUCCESS' && msgCode !== '0') {
          return res.json({ success: false, code: msgCode, message: message || '납부변경 실패', data: data });
        }
        return res.json({ success: true, code: msgCode || 'SUCCESS', message: message || '납부방법이 변경되었습니다', data: data });
      }

      // responseSuccess 뷰 (ModelAndView("responseSuccess"))
      if (responseText.includes('responseSuccess') || responseText.includes('ErrorCode>0<')) {
        return res.json({ success: true, code: 'SUCCESS', message: '납부방법이 변경되었습니다', data: {} });
      }

      // MiPlatform <params> 형식 응답
      const paramsData = parseMiPlatformParamsXMLtoJSON(responseText);
      if (paramsData) {
        const msgCode = paramsData.MSGCODE || paramsData.MSG_CODE || '';
        const message = paramsData.MESSAGE || paramsData.MSG || '';
        if (paramsData.ErrorCode === '-200' || msgCode === '') {
          console.log('[PaymentMethodChange] [' + ep.name + '] Empty/error response, trying next...');
          return callLegacyReqEndpoint(endpoints, index + 1, accessTicket, res);
        }
        return res.json({ success: true, code: msgCode || 'SUCCESS', message: message || '납부방법이 변경되었습니다', data: paramsData });
      }

      // 알 수 없는 응답 → 다음 엔드포인트 시도
      console.log('[PaymentMethodChange] [' + ep.name + '] Unknown response format, trying next...');
      callLegacyReqEndpoint(endpoints, index + 1, accessTicket, res);
    });
  });

  proxyReq.on('error', (err) => {
    console.error('[PaymentMethodChange] [' + ep.name + '] Request error:', err.message);
    callLegacyReqEndpoint(endpoints, index + 1, accessTicket, res);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    console.error('[PaymentMethodChange] [' + ep.name + '] Timeout');
    callLegacyReqEndpoint(endpoints, index + 1, accessTicket, res);
  });

  proxyReq.write(postData);
  proxyReq.end();
}

async function handleProxy(req, res) {
  try {
    let apiPath = req.path;

    // Apply path mapping if exists
    if (PATH_MAPPING[apiPath]) {
      const mappedPath = PATH_MAPPING[apiPath];
      console.log('[PROXY] Path mapped: ' + apiPath + ' -> ' + mappedPath);
      apiPath = mappedPath;
    }

    // Transform request body for login API (USR_PW -> PASSWORD)
    if (apiPath === '/login' && req.body) {
      if (req.body.USR_PW && !req.body.PASSWORD) {
        req.body.PASSWORD = req.body.USR_PW;
        delete req.body.USR_PW;
        console.log('[PROXY] Transformed USR_PW to PASSWORD for login');
      }
    }

    // 고객명 1글자 검색 차단 (너무 많은 결과로 타임아웃 발생)
    if (apiPath.endsWith('/getConditionalCustList2') && req.body && req.body.CUST_NM) {
      const nm = req.body.CUST_NM.trim();
      if (nm.length > 0 && nm.length < 2) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: '고객명은 2글자 이상 입력해주세요.', data: [] });
      }
    }

    // CTRT_ID for history APIs: SQL now uses <isNotEmpty> dynamic filter
    // - CTRT_ID 있으면 계약별 필터링, 없으면 전체 조회
    // - '*' 주입 금지 (SQL이 실제값으로 인식하여 0건 반환됨)
    if ((apiPath.endsWith('/getTgtCtrtRcptHist_m') || apiPath.endsWith('/getTgtCtrtWorkList_m')) && req.body) {
      if (req.body.CTRT_ID === '*' || req.body.CTRT_ID === '') {
        delete req.body.CTRT_ID;
      }
    }

    // 도로명주소: BUILD_NM만 제거 (서버 크래시 방지), STREET_NM은 서버에 그대로 전달
    let streetAddrFilter = null;
    if (apiPath.endsWith('/getStreetAddrList') && req.body) {
      if (req.body.BUILD_NM) {
        delete req.body.BUILD_NM;
        console.log('[PROXY] 도로명주소: BUILD_NM 제거 (크래시 방지)');
      }
    }


    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';

    // CRITICAL FIX: Route to api-servlet (/api/*) NOT cona-servlet (*.req)
    // Our custom controllers are mapped under /api/* in web.xml
    let finalPath = apiPath;

    // Check if this route should go directly to legacy .req servlet
    let isLegacyReq = false;
    let directReqConfig = null;

    // DIRECT_REQ_ROUTES: JSESSIONID가 있으면 .req 직접 라우팅
    // 브라우저 쿠키 또는 서버 저장 JSESSIONID 모두 체크
    const hasJSessionId = (req.headers.cookie && req.headers.cookie.includes('JSESSIONID')) || storedJSessionId;
    if (DIRECT_REQ_ROUTES[apiPath] && hasJSessionId) {
      // JSESSIONID 있음: .req로 직접 라우팅 (어댑터 우회, CALLER_UID 전달)
      directReqConfig = DIRECT_REQ_ROUTES[apiPath];
      finalPath = directReqConfig.reqPath;
      isLegacyReq = true;
      console.log('[PROXY] Direct .req route (JSESSIONID available): ' + apiPath + ' -> ' + finalPath);
    } else if (DIRECT_REQ_ROUTES[apiPath]) {
      // JSESSIONID 없음: 어댑터 경유 (폴백)
      finalPath = '/api' + apiPath;
      console.log('[PROXY] No JSESSIONID, falling back to adapter: ' + apiPath + ' -> ' + finalPath);
    } else if (LEGACY_REQ_ROUTES.includes(apiPath)) {
      finalPath = apiPath + '.req';
      isLegacyReq = true;
      console.log('[PROXY] Legacy .req route: ' + apiPath + ' -> ' + finalPath);
    }
    // For /ping - keep as is; /login is now mapped to /api/login via PATH_MAPPING
    // For all other paths - add /api prefix to route to api-servlet
    else if (apiPath !== '/login' && apiPath !== '/ping' && !apiPath.startsWith('/api/')) {
      finalPath = '/api' + apiPath;
      console.log('[PROXY] Added /api prefix: ' + apiPath + ' -> ' + finalPath);
    }

    const targetUrl = DLIVE_API_BASE + finalPath + queryString;

    console.log('\n========================================');
    console.log('[PROXY] ' + req.method + ' ' + targetUrl);
    console.log('========================================');
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Request body:');
      console.log(JSON.stringify(req.body, null, 2));
    }

    const http = require('http');
    const url = require('url');

    const parsedUrl = url.parse(targetUrl);

    let postData = null;
    let contentType = 'application/json; charset=utf-8';

    if (req.method === 'POST' || req.method === 'PUT') {
      if (isLegacyReq && req.body) {
        // Convert JSON to MiPlatform XML format for legacy .req endpoints
        if (directReqConfig) {
          // Multi-dataset XML for direct .req routes (e.g., 상담등록)
          postData = directReqConfig.buildXml(req.body);
          console.log('[PROXY] Multi-dataset XML for .req:', postData.substring(0, 500));
        } else {
          postData = jsonToMiPlatformXML('ds_request', req.body);
          console.log('[PROXY] Converted to MiPlatform XML:', postData.substring(0, 300));
        }
        contentType = 'text/xml; charset=UTF-8';
      } else {
        const jsonStr = JSON.stringify(req.body);
        // 백엔드 어댑터가 UTF-8로 readBody() 변경됨 (commit 062b3f5)
        // EUC-KR 인코딩 제거 → UTF-8 그대로 전송
        postData = jsonStr;
        contentType = 'application/json; charset=utf-8';
      }
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.path,
      method: req.method,
      headers: {
        'Content-Type': contentType,
        'Origin': req.headers.origin || 'http://52.63.232.141:8080',
        'User-Agent': 'EC2-Proxy/1.0',
        'Host': parsedUrl.host,
        'X-Forwarded-For': (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString(),
        'X-Forwarded-Proto': 'http'
      },
      timeout: 60000
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.isBuffer(postData) ? postData.length : Buffer.byteLength(postData, 'utf8');
    }

    // 쿠키 처리: 브라우저 쿠키 + 저장된 JSESSIONID 주입
    {
      let cookie = req.headers.cookie || '';
      // 브라우저에 JSESSIONID가 없으면 서버에 저장된 것을 주입
      if (storedJSessionId && !cookie.includes('JSESSIONID')) {
        cookie = (cookie ? cookie + '; ' : '') + 'JSESSIONID=' + storedJSessionId;
        console.log('[PROXY] Injected stored JSESSIONID');
      }
      if (cookie) {
        options.headers['Cookie'] = cookie;
      }
    }

    console.log('[PROXY] Target:', targetUrl);
    console.log('[PROXY] Method:', req.method);

    const proxyReq = http.request(options, (proxyRes) => {
      console.log('[PROXY] Response status:', proxyRes.statusCode);

      // 로그인 응답에서 JSESSIONID 캡처
      const setCookies = proxyRes.headers['set-cookie'];
      if (setCookies) {
        const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
        arr.forEach(c => {
          const match = c.match(/JSESSIONID=([^;]+)/);
          if (match) {
            storedJSessionId = match[1];
            console.log('[PROXY] Captured JSESSIONID from response: ' + storedJSessionId.substring(0, 20) + '...');
          }
        });
      }

      let chunks = [];
      proxyRes.on('data', (chunk) => {
        chunks.push(chunk);
      });

      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString();

        // ============ ADAPTER FALLBACK: .req 자동 폴백 ============
        // 어댑터 서블릿 에러(SRVE0207E/SRVE0255E) 시 .req 엔드포인트로 자동 재시도
        if (!isLegacyReq && (proxyRes.statusCode === 500 || proxyRes.statusCode === 404) &&
            (responseBody.includes('SRVE0207E') || responseBody.includes('SRVE0255E'))) {
          console.log('[PROXY] ⚠ Adapter servlet error, falling back to .req endpoint');
          const reqPath = apiPath + '.req';
          const reqUrl = DLIVE_API_BASE + reqPath;
          // .req 폴백: STREET_NM 제거 (D'Live .req 버그 - 전달 시 0건 반환)
          const fallbackBody = Object.assign({}, req.body || {});
          if (streetAddrFilter && streetAddrFilter.STREET_NM && fallbackBody.STREET_NM) {
            delete fallbackBody.STREET_NM;
            console.log('[PROXY] .req fallback: STREET_NM 제거 (서버 버그 우회)');
          }
          const xmlData = jsonToMiPlatformXML('DS_INPUT', fallbackBody);
          console.log('[PROXY] Fallback .req:', reqUrl);
          console.log('[PROXY] Fallback XML:', xmlData.substring(0, 300));

          const fbOpts = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: reqPath,
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset=UTF-8',
              'Content-Length': Buffer.byteLength(xmlData, 'utf8'),
              'Host': parsedUrl.host
            },
            timeout: 60000
          };
          // JSESSIONID 주입
          {
            let fbCookie = req.headers.cookie || '';
            if (storedJSessionId && !fbCookie.includes('JSESSIONID')) {
              fbCookie = (fbCookie ? fbCookie + '; ' : '') + 'JSESSIONID=' + storedJSessionId;
            }
            if (fbCookie) fbOpts.headers['Cookie'] = fbCookie;
          }

          const fbReq = http.request(fbOpts, (fbRes) => {
            // Capture JSESSIONID from fallback response
            const fbSetCookies = fbRes.headers['set-cookie'];
            if (fbSetCookies) {
              (Array.isArray(fbSetCookies) ? fbSetCookies : [fbSetCookies]).forEach(c => {
                const m = c.match(/JSESSIONID=([^;]+)/);
                if (m) { storedJSessionId = m[1]; }
              });
            }
            let fbChunks = [];
            fbRes.on('data', c => fbChunks.push(c));
            fbRes.on('end', () => {
              const fbBody = Buffer.concat(fbChunks).toString();
              console.log('[PROXY] Fallback response:', fbRes.statusCode, fbBody.substring(0, 300));

              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
              res.setHeader('Access-Control-Allow-Credentials', 'true');

              // Parse XML <record> format
              if (fbBody.includes('<record>')) {
                const jsonData = parseMiPlatformXMLtoJSON(fbBody);
                if (jsonData) {
                  let dataArr = Array.isArray(jsonData) ? jsonData : [jsonData];
                  if (streetAddrFilter && streetAddrFilter.STREET_NM) {
                    const nm = streetAddrFilter.STREET_NM.toLowerCase();
                    dataArr = dataArr.filter(item => {
                      const a1 = (item.STREET_ADDR || '').toLowerCase();
                      const a2 = (item.ADDR || '').toLowerCase();
                      return a1.includes(nm) || a2.includes(nm);
                    });
                    console.log('[PROXY] 도로명 필터 (.req fallback): ' + dataArr.length + '건');
                  }
                  return res.json({ code: 'SUCCESS', message: 'OK', data: dataArr });
                }
              }
              // Parse XML <params>/<param> format
              if (fbBody.includes('<params>') || fbBody.includes('<param ')) {
                const jsonData = parseMiPlatformParamsXMLtoJSON(fbBody);
                if (jsonData) {
                  const isSuccess = (jsonData.MESSAGE === 'SUCCESS' || jsonData.MSGCODE === 'SUCCESS' || jsonData.RESULT === '0');
                  const isError = (jsonData.ErrorCode === '-200' || jsonData.ExceptionReason);
                  return res.json({
                    code: isError ? 'CONA_ERROR' : (isSuccess ? 'SUCCESS' : (jsonData.MSGCODE || jsonData.RESULT || 'UNKNOWN')),
                    message: isError ? (jsonData.ExceptionReason || 'Error') : (isSuccess ? 'OK' : (jsonData.MESSAGE || '')),
                    data: jsonData
                  });
                }
              }
              // Parse XML <Col> Dataset format
              if (fbBody.includes('<Col ')) {
                const jsonData = parseMiPlatformDatasetXMLtoJSON(fbBody);
                if (jsonData) {
                  let dataArr = Array.isArray(jsonData) ? jsonData : [jsonData];
                  if (streetAddrFilter && streetAddrFilter.STREET_NM) {
                    const nm = streetAddrFilter.STREET_NM.toLowerCase();
                    dataArr = dataArr.filter(item => {
                      const a1 = (item.STREET_ADDR || '').toLowerCase();
                      const a2 = (item.ADDR || '').toLowerCase();
                      return a1.includes(nm) || a2.includes(nm);
                    });
                  }
                  return res.json({ code: 'SUCCESS', message: 'OK', data: dataArr });
                }
              }
              // Fallback: raw response
              if (fbRes.statusCode >= 400) {
                return res.status(fbRes.statusCode).json({
                  code: 'CONA_ERROR',
                  message: fbBody.substring(0, 300),
                  data: null
                });
              }
              res.status(fbRes.statusCode).send(fbBody);
            });
          });
          fbReq.on('error', (err) => {
            console.error('[PROXY] Fallback .req error:', err.message);
            res.status(500).json({ code: 'PROXY_ERROR', message: 'Adapter & .req both failed: ' + err.message });
          });
          fbReq.on('timeout', () => {
            fbReq.destroy();
            console.error('[PROXY] Fallback .req timeout');
            res.status(504).json({ code: 'TIMEOUT', message: '.req fallback timeout' });
          });
          fbReq.write(xmlData);
          fbReq.end();
          return;
        }
        // ============ END ADAPTER FALLBACK ============

        // Log response for debugging (pretty print JSON)
        try {
          const jsonResponse = JSON.parse(responseBody);
          console.log('[PROXY] Response:');
          console.log(JSON.stringify(jsonResponse, null, 2));
          // 로그인 응답에서 userId 캡처
          const capturedId = jsonResponse.userId || jsonResponse.USR_ID || jsonResponse.usrId || jsonResponse.LOGIN_ID;
          if (capturedId && !storedUserId) {
            storedUserId = capturedId;
            console.log('[PROXY] Captured userId: ' + storedUserId);
          }
        } catch (e) {
          // Not JSON, show first 500 chars
          console.log('[PROXY] Response preview:', responseBody.substring(0, 500));
        }

        Object.keys(proxyRes.headers).forEach(key => {
          if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-type') {
            res.setHeader(key, proxyRes.headers[key]);
          }
        });

        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        // For legacy .req routes, parse XML response to JSON
        if (isLegacyReq && responseBody.includes('<record>')) {
          console.log('[PROXY] Parsing XML <record> response to JSON for legacy route');
          const jsonData = parseMiPlatformXMLtoJSON(responseBody);
          if (jsonData) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(proxyRes.statusCode);
            // Wrap in standard response format
            const dataArr = Array.isArray(jsonData) ? jsonData : [jsonData];
            res.json({ code: 'SUCCESS', message: 'OK', data: dataArr });
            return;
          }
        }

        // For legacy .req routes with <params> response (like setEquipmentChkStndByY_ForM)
        if (isLegacyReq && (responseBody.includes('<params>') || responseBody.includes('<param '))) {
          console.log('[PROXY] Parsing XML <params> response to JSON for legacy route');
          const jsonData = parseMiPlatformParamsXMLtoJSON(responseBody);
          if (jsonData) {
            // Wrap in standard response format for frontend compatibility
            const isSuccess = (jsonData.MESSAGE === 'SUCCESS' || jsonData.MSGCODE === 'SUCCESS' || jsonData.RESULT === '0');
            const isError = (jsonData.ErrorCode === '-200' || jsonData.ExceptionReason);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(proxyRes.statusCode);
            res.json({
              code: isError ? 'ERROR' : (isSuccess ? 'SUCCESS' : (jsonData.MSGCODE || jsonData.RESULT || 'UNKNOWN')),
              message: isError ? (jsonData.ExceptionReason || 'Error') : (isSuccess ? 'OK' : (jsonData.MESSAGE || 'Unknown')),
              data: jsonData
            });
            return;
          }
        }

        // For legacy .req routes with Dataset XML response (<Col id="KEY"> format)
        if (isLegacyReq && responseBody.includes('<Col ')) {
          console.log('[PROXY] Parsing XML <Col> Dataset response to JSON');
          const jsonData = parseMiPlatformDatasetXMLtoJSON(responseBody);
          if (jsonData) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(proxyRes.statusCode);
            // If array (multi-row), wrap as data array
            if (Array.isArray(jsonData)) {
              res.json({ code: 'SUCCESS', message: 'OK', data: jsonData });
            } else {
              const isSuccess = (jsonData.MESSAGE === 'SUCCESS' || jsonData.MSGCODE === 'SUCCESS');
              res.json({
                code: isSuccess ? 'SUCCESS' : (jsonData.MSGCODE || 'ERROR'),
                message: isSuccess ? 'OK' : (jsonData.MESSAGE || 'Unknown error'),
                data: jsonData
              });
            }
            return;
          }
        }

        // 도로명주소 응답 필터링 (STREET_NM 서버사이드 처리)
        if (streetAddrFilter && streetAddrFilter.STREET_NM) {
          try {
            const jsonResp = JSON.parse(responseBody);
            let items = jsonResp.data || jsonResp;
            if (Array.isArray(items)) {
              const origCount = items.length;
              const nm = streetAddrFilter.STREET_NM.toLowerCase();
              items = items.filter(item => {
                const addr = (item.STREET_ADDR || '').toLowerCase();
                const addr1 = (item.ADDR || '').toLowerCase();
                return addr.includes(nm) || addr1.includes(nm);
              });
              if (jsonResp.data !== undefined) {
                jsonResp.data = items;
              }
              console.log('[PROXY] 도로명 필터: ' + origCount + '건 -> ' + items.length + '건 (STREET_NM=' + streetAddrFilter.STREET_NM + ')');
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.status(proxyRes.statusCode);
              res.json(jsonResp.data !== undefined ? jsonResp : items);
              return;
            }
          } catch (filterErr) {
            console.log('[PROXY] 도로명 필터링 실패:', filterErr.message);
          }
        }

        res.status(proxyRes.statusCode);
        res.send(responseBody);
      });
    });

    proxyReq.on('error', (error) => {
      console.error('[ERROR] Proxy request error:', error.message);
      res.status(500).json({
        error: 'Proxy Error',
        message: error.message,
        targetUrl: targetUrl
      });
    });

    proxyReq.on('timeout', () => {
      console.error('[ERROR] Proxy timeout:', targetUrl);
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Gateway Timeout', targetUrl });
      }
    });

    if (postData) {
      proxyReq.write(postData, 'utf8');
    }

    proxyReq.end();

  } catch (error) {
    console.error('[ERROR] API proxy error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

// ========== NGII Tile Proxy ==========
// Browser cannot call NGII directly (Referer check), so proxy through our server
router.get('/ngii-tile', async (req, res) => {
  try {
    const { apikey, tilematrix, tilerow, tilecol } = req.query;
    if (!apikey || !tilematrix || !tilerow || !tilecol) {
      return res.status(400).send('Missing params');
    }
    const url = `https://map.ngii.go.kr/openapi/Gettile.do`
      + `?apikey=${apikey}&service=WMTS&request=GetTile&version=1.0.0`
      + `&layer=korean_map&style=korean&format=image/png`
      + `&tilematrixset=korean&tilematrix=${tilematrix}`
      + `&tilerow=${tilerow}&tilecol=${tilecol}`;

    const https = require('https');
    const proxyReq = https.get(url, { headers: { 'Referer': `http://${req.headers.host || 'localhost'}` } }, (proxyRes) => {
      res.set('Content-Type', proxyRes.headers['content-type'] || 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (e) => {
      console.error('[NGII Proxy] Error:', e.message);
      res.status(502).send('Tile fetch failed');
    });
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      res.status(504).send('Timeout');
    });
  } catch (e) {
    res.status(500).send('Proxy error');
  }
});

module.exports = router;
