// EC2 환경용 API 프록시 (Express.js 라우터)
const express = require('express');
const router = express.Router();

// 환경변수 우선, 없으면 기본값 사용
const DLIVE_API_BASE = process.env.DLIVE_API_BASE || 'http://58.143.140.222:8080/api';

// 특정 API 경로들을 딜라이브 내부서버로 프록시
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

// Customer/Work API 경로들
router.post('/customer/work/getCustProdInfo', handleProxy);
router.post('/customer/work/eqtCmpsInfoChg', handleProxy);
router.post('/customer/work/signalCheck', handleProxy);
router.post('/customer/work/workComplete', handleProxy);
router.post('/customer/work/saveInstallInfo', handleProxy);

// Customer/Receipt/Contract API 경로들
router.post('/customer/receipt/contract/getEquipmentNmListOfProd', handleProxy);
router.post('/customer/receipt/contract/getContractEqtList', handleProxy);
router.post('/customer/work/checkStbServerConnection', handleProxy);

// Common API 경로들
router.post('/common/getCommonCodeList', handleProxy);
router.post('/common/getCommonCodes', handleProxy);

// Customer/Negociation API 경로들
router.post('/customer/negociation/getCustomerCtrtInfo', handleProxy);

// Customer/Contract API 경로들 (계약정보 조회 - 2024-12-02 추가)
router.post('/customer/contract/getContractInfo', handleProxy);
router.post('/customer/contract/getBillingInfo', handleProxy);
router.post('/customer/contract/getFullContractInfo', handleProxy);

// Integration (연동이력) API 경로들
router.post('/integration/history', handleProxy);
router.post('/customer/sigtrans/history', handleProxy);
router.post('/customer/sigtrans/getSendHistory', handleProxy);
router.post('/customer/sigtrans/saveENSSendHist', handleProxy);
router.post('/customer/sigtrans/saveENSSendHist.req', handleProxy);
router.post('/customer/sigtrans/getENSSendHist', handleProxy);  // 문자발송이력 조회

// Signal (신호 전송) API 경로들
router.post('/signal/send', handleProxy);                              // 범용 신호 전송 (modIfSvc)
router.post('/signal/removal', handleProxy);                           // 철거 신호 (SMR91)
router.post('/signal/metro', handleProxy);                             // 광랜 신호 (SMR82, SMR83, SMR87)
router.post('/signal/port-close', handleProxy);                        // 포트정지 (SMR82)
router.post('/signal/port-open', handleProxy);                         // 포트개통 (SMR83)
router.post('/signal/port-reset', handleProxy);                        // 포트리셋 (SMR87)
router.post('/customer/work/modIfSvc', handleProxy);                   // 레거시 호환
router.post('/customer/equipment/callMetroEqtStatusSearch', handleProxy); // 레거시 호환
router.post('/customer/sigtrans/removal', handleProxy);                // 레거시 호환
router.post('/customer/sigtrans/portClose', handleProxy);              // 레거시 호환
router.post('/customer/sigtrans/portOpen', handleProxy);               // 레거시 호환
router.post('/customer/sigtrans/portReset', handleProxy);              // 레거시 호환

// Customer/Equipment API 경로들 (장비 할당/반납) - .req 확장자 필수
router.post('/customer/equipment/getEquipmentOutList', handleProxy);
router.post('/customer/equipment/getEquipmentOutList.req', handleProxy);
router.post('/customer/equipment/getEquipmentProcYnCheck', handleProxy);
router.post('/customer/equipment/getEquipmentProcYnCheck.req', handleProxy);
router.post('/customer/equipment/addCorporationEquipmentQuota', handleProxy);
router.post('/customer/equipment/addCorporationEquipmentQuota.req', handleProxy);
router.post('/customer/equipment/getEquipmentReturnRequestList', handleProxy);
router.post('/customer/equipment/getEquipmentReturnRequestList.req', handleProxy);
router.post('/customer/equipment/getEquipmentReturnRequestCheck', handleProxy);
router.post('/customer/equipment/getEquipmentReturnRequestCheck.req', handleProxy);
router.post('/customer/equipment/addEquipmentReturnRequest', handleProxy);
router.post('/customer/equipment/addEquipmentReturnRequest.req', handleProxy);
router.post('/customer/equipment/getWrkrHaveEqtList', handleProxy);
router.post('/customer/equipment/getWrkrHaveEqtList.req', handleProxy);
router.post('/customer/equipment/cmplEqtCustLossIndem', handleProxy);
router.post('/customer/equipment/cmplEqtCustLossIndem.req', handleProxy);
router.post('/customer/equipment/setEquipmentChkStndByY', handleProxy);
router.post('/customer/equipment/setEquipmentChkStndByY.req', handleProxy);
router.post('/customer/equipment/changeEqtWrkr_3', handleProxy);
router.post('/customer/equipment/changeEqtWrkr_3.req', handleProxy);
router.post('/customer/equipment/updateInstlLocFrWrk', handleProxy);  // 설치위치 업데이트
router.post('/customer/equipment/updateInstlLocFrWrk.req', handleProxy);  // 설치위치 업데이트 (.req)

// Statistics/Equipment API 경로들 - .req 확장자 필수
router.post('/statistics/equipment/getEquipmentHistoryInfo', handleProxy);
router.post('/statistics/equipment/getEquipmentHistoryInfo.req', handleProxy);

// System/CM API 경로들 - .req 확장자 필수
router.post('/system/cm/getFindUsrList3', handleProxy);
router.post('/system/cm/getFindUsrList3.req', handleProxy);

// Customer/Work API 경로들 (미회수 장비) - .req 확장자 필수
router.post('/customer/work/getEquipLossInfo', handleProxy);
router.post('/customer/work/getEquipLossInfo.req', handleProxy);
router.post('/customer/work/modEquipLoss', handleProxy);
router.post('/customer/work/modEquipLoss.req', handleProxy);

async function handleProxy(req, res) {
  try {
    const apiPath = req.path;
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const targetUrl = `${DLIVE_API_BASE}${apiPath}${queryString}`;

    console.log('\n========================================');
    console.log('[PROXY] ' + req.method + ' ' + targetUrl);
    console.log('========================================');

    // getCustProdInfo인 경우 상세 로깅
    if (apiPath.includes('getCustProdInfo')) {
      console.log('\n[getCustProdInfo] 파라미터 상세:');
      console.log('------------------------------------------------');
      console.log('프론트엔드 JSON Body:');
      console.log(JSON.stringify(req.body, null, 2));
      console.log('------------------------------------------------');

      const params = req.body;
      const paramKeys = Object.keys(params);

      console.log('총 파라미터: ' + paramKeys.length + '개');
      console.log('\n각 파라미터 타입:');
      paramKeys.forEach(key => {
        const value = params[key];
        const type = value === null ? 'null' : typeof value;
        console.log('  ' + key + ': "' + value + '" (' + type + ')');
      });

      console.log('\n레거시 Map 변환 (Java):');
      console.log('Map<String, Object> map = new HashMap<>();');
      paramKeys.forEach(key => {
        console.log('map.put("' + key + '", "' + params[key] + '");');
      });
      console.log('------------------------------------------------\n');
    } else {
      console.log('요청 본문:', req.body);
    }

    console.log('쿼리:', queryString);
    console.log('Origin:', req.headers.origin);

    // fetch 대신 http/https 모듈 사용 (Node.js 환경)
    const https = require('https');
    const http = require('http');
    const url = require('url');

    const parsedUrl = url.parse(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // POST 데이터를 미리 준비 (Content-Length 계산용)
    const postData = (req.method === 'POST' || req.method === 'PUT')
      ? JSON.stringify(req.body)
      : null;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': req.headers.origin || 'http://52.63.232.141',
        'User-Agent': 'EC2-Proxy/1.0',
        // 일부 레거시에서 Host 헤더/포워드 헤더 필요
        'Host': parsedUrl.host,
        'X-Forwarded-For': (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString(),
        'X-Forwarded-Proto': (req.headers['x-forwarded-proto'] || (isHttps ? 'https' : 'http')).toString()
      },
      timeout: 30000 // 응답 타임아웃 30s
    };

    // Content-Length 추가 (중요!)
    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    // 쿠키 전달
    if (req.headers.cookie) {
      options.headers['Cookie'] = req.headers.cookie;
    }

    console.log('[PROXY] 레거시 서버로 요청 전송:');
    console.log('  URL:', targetUrl);
    console.log('  Method:', req.method);
    console.log('  Headers:', JSON.stringify(options.headers, null, 2));
    if (postData) {
      console.log('  Body Length:', postData.length, 'bytes');
      console.log('  Body Preview:', postData.substring(0, 200));
    }

    const proxyReq = httpModule.request(options, (proxyRes) => {
      console.log('[PROXY] 레거시 응답:', proxyRes.statusCode);

      // 응답 본문 수집 (디버깅용)
      let chunks = [];
      proxyRes.on('data', (chunk) => {
        chunks.push(chunk);
      });

      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString();

        // getCustProdInfo 응답일 경우 상세 로깅
        if (apiPath.includes('getCustProdInfo')) {
          try {
            const parsed = JSON.parse(responseBody);
            console.log('\n========================================');
            console.log('[getCustProdInfo] 레거시 서버 응답');
            console.log('========================================');
            console.log('응답 상태:', proxyRes.statusCode);
            console.log('\n응답 데이터 분석:');
            console.log('  - output1 (프로모션):', parsed.output1?.length || 0, '개');
            console.log('  - output2 (계약장비):', parsed.output2?.length || 0, '개');
            console.log('  - output3 (기사장비):', parsed.output3?.length || 0, '개');
            console.log('  - output4 (고객장비):', parsed.output4?.length || 0, '개');
            console.log('  - output5 (회수장비):', parsed.output5?.length || 0, '개');
            console.log('  - output6 (기타):', parsed.output6?.length || 0, '개');

            if (parsed.output2 && parsed.output2.length > 0) {
              console.log('\noutput2 (계약장비) 첫 번째 항목:');
              console.log(JSON.stringify(parsed.output2[0], null, 2));
            }

            if (parsed.output3 && parsed.output3.length > 0) {
              console.log('\noutput3 (기사장비) 첫 번째 항목:');
              console.log(JSON.stringify(parsed.output3[0], null, 2));
            } else {
              console.log('\n[WARNING] output3 (기사장비)가 비어있습니다!');
              console.log('   가능한 원인:');
              console.log('   1. 해당 기사(WRKR_ID)에게 할당된 장비가 없음');
              console.log('   2. EQT_LOC_TP_CD가 3(작업기사)이 아님');
              console.log('   3. EQT_STAT_CD가 10(정상) 또는 80(임시출고)이 아님');
              console.log('   4. 이미 다른 고객에게 할당됨');
            }

            if (parsed.output4 && parsed.output4.length > 0) {
              console.log('\noutput4 (고객장비) 첫 번째 항목:');
              console.log(JSON.stringify(parsed.output4[0], null, 2));
            }

            console.log('========================================\n');
          } catch (e) {
            console.log('[ERROR] 응답 파싱 실패:', e.message);
            console.log('원본 응답:', responseBody.substring(0, 500));
          }
        }

        // 응답 헤더 복사
        Object.keys(proxyRes.headers).forEach(key => {
          if (key.toLowerCase() !== 'transfer-encoding') {
            res.setHeader(key, proxyRes.headers[key]);
          }
        });

        // CORS 헤더 추가
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        res.status(proxyRes.statusCode);
        res.send(responseBody);
      });
    });

    proxyReq.on('error', (error) => {
      console.error('[ERROR] 프록시 요청 오류:', error);
      console.error('  Target URL:', targetUrl);
      console.error('  Error Code:', error.code);
      console.error('  Error Message:', error.message);
      const mapCode = (code) => {
        if (code === 'ECONNREFUSED') return 503;
        if (code === 'ETIMEDOUT') return 504;
        if (code === 'ENOTFOUND') return 502;
        if (code === 'ECONNRESET') return 502;
        return 500;
      };
      res.status(mapCode(error.code)).json({
        error: 'Proxy Error',
        message: error.message,
        targetUrl: targetUrl
      });
    });

    proxyReq.on('timeout', () => {
      console.error('[ERROR] 프록시 응답 타임아웃:', targetUrl);
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Gateway Timeout', message: 'Backend response timeout', targetUrl });
      }
    });

    // POST 데이터 전송
    if (postData) {
      console.log('[PROXY] POST 데이터 전송 중...');
      proxyReq.write(postData);
    }

    proxyReq.end();
    console.log('[PROXY] 요청 완료, 응답 대기 중...\n');

  } catch (error) {
    console.error('[ERROR] API 프록시 오류:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
}

module.exports = router;
