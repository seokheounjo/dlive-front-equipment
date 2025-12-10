import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Vercel 서버의 외부 IP 확인
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const { ip } = await ipResponse.json();
    
    // 추가 정보 수집
    const headers = {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
      'user-agent': req.headers['user-agent']
    };
    
    res.json({
      vercelServerIp: ip,
      requestHeaders: headers,
      timestamp: new Date().toISOString(),
      message: '이 IP를 딜라이브 방화벽에 허용해야 API 호출 가능'
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'IP 확인 실패',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

