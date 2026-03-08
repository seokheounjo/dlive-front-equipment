
// === LGU+ 카드인증 핸들러 (JSP 직접 호출) ===
async function handleCardVerify(req, res) {
  try {
    const body = req.body || {};
    console.log('\n========== [CardVerify] ==========');
    console.log('Input params:', JSON.stringify({...body, CARD_NO: body.CARD_NO ? '****' + body.CARD_NO.slice(-4) : ''}, null, 2));

    const soId = body.SO_ID || '';
    const pymAcntId = body.PYM_ACNT_ID || '';
    const custId = body.CUST_ID || '';
    const custNm = body.CUST_NM || '';
    const cardNo = body.CARD_NO || '';
    const cardExpYear = body.CARD_EXPYEAR || '';
    const cardExpMon = body.CARD_EXPMON || '';
    const korId = body.KOR_ID || '';

    if (!cardNo || !cardExpYear || !cardExpMon) {
      return res.json({ success: false, code: 'INVALID_PARAM', message: 'CARD_NO, CARD_EXPYEAR, CARD_EXPMON required' });
    }

    // Build JSP URL
    const queryParams = new URLSearchParams({
      so_id: soId,
      pym_acnt_id: pymAcntId,
      cust_id: custId,
      buyer: custNm,
      regr_id: custId || 'SYSTEM',
      card_no: cardNo,
      card_expyear: cardExpYear,
      card_expmon: cardExpMon,
      kor_id: korId
    });

    console.log('[CardVerify] Calling JSP (card masked)');

    const http = require('http');
    const options = {
      hostname: '58.143.139.1',
      port: 8080,
      path: '/api_certify_req.jsp?' + queryParams.toString(),
      method: 'GET',
      timeout: 60000,
      headers: { 'Accept': 'text/html; charset=EUC-KR' }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      let chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        // JSP returns EUC-KR encoded HTML
        let html;
        try {
          const iconv = require('iconv-lite');
          html = iconv.decode(Buffer.concat(chunks), 'euc-kr');
        } catch (e) {
          html = Buffer.concat(chunks).toString('utf-8');
        }
        console.log('[CardVerify] Response HTML:', html.substring(0, 500));

        // Parse response
        let respCd = null;
        let respMsg = null;

        // Check for alert() error messages first
        var alertRe = /alert\(['"]([^'"]+)['"]\)/;
        var alertMatch = alertRe.exec(html);
        if (alertMatch) {
          respMsg = alertMatch[1].trim();
        }

        // Look for resp_cd in URL params or form fields
        var respCdRe = /resp_cd=([^&'"<\s]+)/i;
        var respCdMatch = respCdRe.exec(html);
        if (respCdMatch) respCd = respCdMatch[1];

        // Look for RESP_CD in hidden fields
        if (!respCd) {
          var hiddenRe = /name=['"]?RESP_CD['"]?\s+value=['"]?([^'">\s]+)/i;
          var hiddenMatch = hiddenRe.exec(html);
          if (hiddenMatch) respCd = hiddenMatch[1];
        }

        console.log('[CardVerify] Parsed: RESP_CD=' + respCd + ' RESP_MSG=' + respMsg);

        var success = respCd === '0000' || respCd === '00';
        var result = {
          success: success,
          code: respCd || (respMsg ? 'JSP_ERROR' : 'UNKNOWN'),
          message: respMsg || (success ? 'Card verified' : 'Verification failed'),
          data: { RESP_CD: respCd || 'JSP_ERROR', RESP_MSG: respMsg || '' }
        };

        return res.json(result);
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[CardVerify] Request error:', err.message);
      res.json({ success: false, code: 'ERROR', message: err.message });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      console.error('[CardVerify] Timeout (60s)');
      res.json({ success: false, code: 'TIMEOUT', message: 'JSP request timed out' });
    });

    proxyReq.end();

  } catch (error) {
    console.error('[CardVerify] Error:', error.message);
    res.json({ success: false, code: 'ERROR', message: error.message });
  }
}
