// EC2 API Proxy (Express.js Router) - Fixed Version
// Routes to /api/* servlet (our custom controllers) instead of *.req (CONA servlet)
const express = require('express');
const router = express.Router();

const DLIVE_API_BASE = process.env.DLIVE_API_BASE || 'http://58.143.140.222:8080';

// CONA JSESSIONID 저장 (로그인 시 캡처, 이후 모든 요청에 주입)
let storedJSessionId = null;

// Path mapping from frontend API to D'Live legacy API
const PATH_MAPPING = {
  "/login": "/api/login",   // TaskAuthController로 라우팅 (CONA 세션 생성)
  "/ping": "/ping",
  "/work/directions": "/api/work/directions",
  "/work/receipts": "/api/work/receipts",
  "/work/cancel": "/api/work/cancel",
  "/work/complete": "/api/work/complete"
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

  // Full XML structure
  return `<?xml version="1.0" encoding="UTF-8"?>
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
    const result = {};
    const colRegex = /<Col\s+id="(\w+)"[^>]*>([^<]*)<\/Col>/gi;
    let match;
    while ((match = colRegex.exec(xmlString)) !== null) {
      result[match[1]] = match[2]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
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
router.post('/customer/work/modEquipLoss', handleProxy);

// Customer/Receipt/Contract API
router.post('/customer/receipt/contract/getEquipmentNmListOfProd', handleProxy);
router.post('/customer/receipt/contract/getContractEqtList', handleProxy);
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
router.post('/customer/customer/general/customerPymChgAddManager', handleProxy);
router.post('/customer/customer/general/addCustomerPymInfoChange', handleProxy);
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

    // CTRT_ID for history APIs: SQL now uses <isNotEmpty> dynamic filter
    // - CTRT_ID 있으면 계약별 필터링, 없으면 전체 조회
    // - '*' 주입 금지 (SQL이 실제값으로 인식하여 0건 반환됨)
    if ((apiPath.endsWith('/getTgtCtrtRcptHist_m') || apiPath.endsWith('/getTgtCtrtWorkList_m')) && req.body) {
      if (req.body.CTRT_ID === '*' || req.body.CTRT_ID === '') {
        delete req.body.CTRT_ID;
      }
    }

    // 도로명주소 검색: D'Live 서버 버그 우회
    // - STREET_NM 전달 시 무조건 0건 반환 (서버 버그)
    // - BUILD_NM 전달 시 서버 크래시
    // 해결: 요청에서 제거 후 D'Live 전달, 응답에서 서버사이드 필터링
    let streetAddrFilter = null;
    if (apiPath.endsWith('/getStreetAddrList') && req.body) {
      streetAddrFilter = {};
      if (req.body.STREET_NM) {
        streetAddrFilter.STREET_NM = req.body.STREET_NM;
        delete req.body.STREET_NM;
        console.log('[PROXY] 도로명주소: STREET_NM 분리:', streetAddrFilter.STREET_NM);
      }
      if (req.body.BUILD_NM) {
        streetAddrFilter.BUILD_NM = req.body.BUILD_NM;
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
        postData = JSON.stringify(req.body);
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
      timeout: 30000
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData, 'utf8');
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

        // Log response for debugging (pretty print JSON)
        try {
          const jsonResponse = JSON.parse(responseBody);
          console.log('[PROXY] Response:');
          console.log(JSON.stringify(jsonResponse, null, 2));
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
            res.json(jsonData);
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
            // Wrap in standard response format for frontend compatibility
            const isSuccess = (jsonData.MESSAGE === 'SUCCESS' || jsonData.MSGCODE === 'SUCCESS');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(proxyRes.statusCode);
            res.json({
              code: isSuccess ? 'SUCCESS' : (jsonData.MSGCODE || 'ERROR'),
              message: isSuccess ? 'OK' : (jsonData.MESSAGE || 'Unknown error'),
              data: jsonData
            });
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

module.exports = router;
