// EC2 API Proxy (Express.js Router) - Fixed Version
// Routes to /api/* servlet (our custom controllers) instead of *.req (CONA servlet)
const express = require('express');
const router = express.Router();

const DLIVE_API_BASE = process.env.DLIVE_API_BASE || 'http://58.143.140.222:8080';

// Path mapping from frontend API to D'Live legacy API
const PATH_MAPPING = {
  "/login": "/login",
  "/ping": "/ping",
  "/work/directions": "/api/work/directions",
  "/work/receipts": "/api/work/receipts",
  "/work/cancel": "/api/work/cancel",
  "/work/complete": "/api/work/complete"
};

// Routes that should go directly to legacy .req servlet (bypass our adapter)
// NOTE: getEquipmentHistoryInfo removed - our adapter handles it with getEquipmentHistoryInfo_2
const LEGACY_REQ_ROUTES = [

  // Equipment Processing 3 APIs - Route directly to legacy .req servlet

  "/customer/phoneNumber/getOwnEqtLstForMobile_3",  // 장비반납
  // "/statistics/equipment/getEquipmentHistoryInfo"  // Now handled by our adapter
];

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
router.post('/customer/equipment/getEquipmentProcYnCheck', handleProxy);
router.post('/customer/equipment/addCorporationEquipmentQuota', handleProxy);
router.post('/customer/equipment/getEquipmentReturnRequestList', handleProxy);
router.post('/customer/equipment/getEquipmentReturnRequestCheck', handleProxy);
router.post('/customer/equipment/addEquipmentReturnRequest', handleProxy);
router.post('/customer/equipment/getWrkrHaveEqtList', handleProxy);
router.post('/customer/equipment/cmplEqtCustLossIndem', handleProxy);
router.post('/customer/equipment/setEquipmentChkStndByY', handleProxy);
router.post('/customer/equipment/changeEqtWrkr_3', handleProxy);
router.post('/customer/equipment/updateInstlLocFrWrk', handleProxy);
router.post('/customer/equipment/getAuthSoList', handleProxy);
router.post('/customer/equipment/getUserExtendedInfo', handleProxy);

// Equipment Processing APIs (3 categories)
router.post('/customer/equipment/getWrkrHaveEqtList_All', handleProxy);        // My Equipment
router.post("/customer/equipment/getEquipmentChkStndByA_All", handleProxy);  // 검사대기
router.post("/customer/phoneNumber/getOwnEqtLstForMobile_3", handleProxy);  // 장비반납
router.post("/customer/equipment/getOwnEqtLstForMobile_3", handleProxy);  // 반납요청 (equipment 경로)

// Statistics/Equipment API
router.post('/statistics/equipment/getEquipmentHistoryInfo', handleProxy);

// System/CM API
router.post('/system/cm/getFindUsrList3', handleProxy);

// Debug endpoints (GET)
router.get('/debug/equipmentManager/methods', handleProxy);
router.get('/debug/sigtransManagement/methods', handleProxy);
router.get('/debug/workmanAssignManagement/methods', handleProxy);

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

    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';

    // CRITICAL FIX: Route to api-servlet (/api/*) NOT cona-servlet (*.req)
    // Our custom controllers are mapped under /api/* in web.xml
    let finalPath = apiPath;

    // Check if this route should go directly to legacy .req servlet
    let isLegacyReq = false;
    if (LEGACY_REQ_ROUTES.includes(apiPath)) {
      finalPath = apiPath + '.req';
      isLegacyReq = true;
      console.log('[PROXY] Legacy .req route: ' + apiPath + ' -> ' + finalPath);
    }
    // For /login and /ping - keep as is (already mapped in web.xml)
    // For all other paths - add /api prefix to route to api-servlet
    else if (apiPath !== '/login' && apiPath !== '/ping' && !apiPath.startsWith('/api/')) {
      finalPath = '/api' + apiPath;
      console.log('[PROXY] Added /api prefix: ' + apiPath + ' -> ' + finalPath);
    }

    const targetUrl = DLIVE_API_BASE + finalPath + queryString;

    console.log('\n========================================');
    console.log('[PROXY] ' + req.method + ' ' + targetUrl);
    console.log('========================================');
    console.log('Request body:', req.body ? JSON.stringify(req.body).substring(0, 200) : '(no body)');

    const http = require('http');
    const url = require('url');

    const parsedUrl = url.parse(targetUrl);

    let postData = null;
    let contentType = 'application/json';

    if (req.method === 'POST' || req.method === 'PUT') {
      if (isLegacyReq && req.body) {
        // Convert JSON to MiPlatform XML format for legacy .req endpoints
        postData = jsonToMiPlatformXML('ds_request', req.body);
        contentType = 'text/xml; charset=UTF-8';
        console.log('[PROXY] Converted to MiPlatform XML:', postData.substring(0, 300));
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
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (req.headers.cookie) {
      options.headers['Cookie'] = req.headers.cookie;
    }

    console.log('[PROXY] Target:', targetUrl);
    console.log('[PROXY] Method:', req.method);

    const proxyReq = http.request(options, (proxyRes) => {
      console.log('[PROXY] Response status:', proxyRes.statusCode);

      let chunks = [];
      proxyRes.on('data', (chunk) => {
        chunks.push(chunk);
      });

      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString();

        // Log first 200 chars of response for debugging
        console.log('[PROXY] Response preview:', responseBody.substring(0, 200));

        Object.keys(proxyRes.headers).forEach(key => {
          if (key.toLowerCase() !== 'transfer-encoding') {
            res.setHeader(key, proxyRes.headers[key]);
          }
        });

        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

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
      proxyReq.write(postData);
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
