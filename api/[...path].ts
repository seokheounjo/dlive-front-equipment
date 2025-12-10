import type { VercelRequest, VercelResponse } from '@vercel/node';

const DLIVE_API_BASE = 'http://58.143.140.222:8080/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // URL 경로 추출
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path || '';
  const targetUrl = `${DLIVE_API_BASE}/${apiPath}`;

  try {

    console.log(`프록시 요청: ${req.method} ${targetUrl}`);
    console.log(`요청 본문:`, req.body);

    // 딜라이브 API로 요청 전달
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    };

    // 쿠키 전달 (세션 유지용)
    if (req.headers.cookie) {
      headers['Cookie'] = req.headers.cookie;
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // POST/PUT 요청 시 body 전달
    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    console.log(`딜라이브 API 응답: ${response.status} ${response.statusText}`);
    
    // 응답 헤더에서 쿠키 추출 및 전달
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      res.setHeader('Set-Cookie', setCookieHeader);
      console.log(`쿠키 설정:`, setCookieHeader);
    }

    const data = await response.json();
    console.log(`응답 데이터:`, data);
    
    // 딜라이브 API 응답을 그대로 전달
    res.status(response.status).json(data);
    
  } catch (error) {
    console.error('프록시 상세 오류:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack',
      targetUrl,
      method: req.method,
      body: req.body
    });
    
    res.status(500).json({ 
      error: 'Proxy Error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      details: {
        targetUrl,
        vercelIp: '44.200.191.183',
        timestamp: new Date().toISOString()
      }
    });
  }
}
