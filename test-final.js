// 최종 API 테스트
const http = require('http');

let cookies = '';

function request(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: '52.63.232.141',
      port: 8080,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Cookie': cookies
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      if (res.headers['set-cookie']) {
        cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      }
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData.substring(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('========== API 테스트 ==========\n');

  // 1. 로그인
  console.log('1. 로그인');
  const login = await request('/api/login', { USR_ID: 'A20117965', USR_PW: 'dlive12!@#' });
  console.log('   Status:', login.status, login.data?.ok ? '✅' : '❌');

  // 2. 보유장비
  console.log('\n2. 보유장비 (getWrkrHaveEqtList_All)');
  const equip = await request('/api/customer/equipment/getWrkrHaveEqtList_All', { WRKR_ID: 'A20117965', CRR_ID: '0009215' });
  const equipData = Array.isArray(equip.data) ? equip.data : (equip.data?.data || []);
  console.log('   Status:', equip.status, equipData.length > 0 ? '✅' : '❌', '건수:', equipData.length);

  // 3. 검사대기
  console.log('\n3. 검사대기 (getEquipmentChkStndByA_All)');
  const check = await request('/api/customer/equipment/getEquipmentChkStndByA_All', { WRKR_ID: 'A20117965', CRR_ID: '0009215' });
  const checkData = Array.isArray(check.data) ? check.data : (check.data?.data || []);
  console.log('   Status:', check.status, checkData.length > 0 ? '✅' : '⚠️', '건수:', checkData.length);

  // 4. 분실처리 상세조회 (getWrkrListDetail)
  console.log('\n4. 분실처리 상세조회 (getWrkrListDetail)');
  let testSerno = equipData.length > 0 ? equipData[0].EQT_SERNO : 'S1Q4011242';
  const detail = await request('/api/customer/equipment/getWrkrListDetail', {
    SO_ID: '402', CRR_ID: '0009215', WRKR_ID: 'A20117965', EQT_SERNO: testSerno
  });
  const detailData = Array.isArray(detail.data) ? detail.data : (detail.data?.data || []);
  console.log('   Status:', detail.status, detail.status === 200 ? '✅' : '❌', '건수:', detailData.length);
  if (detail.status !== 200) {
    console.log('   응답:', typeof detail.data === 'string' ? detail.data.substring(0, 100) : JSON.stringify(detail.data).substring(0, 100));
  }

  // 5. 반납요청 (getEquipmentReturnRequestList_All)
  console.log('\n5. 반납요청 (getEquipmentReturnRequestList_All)');
  const ret = await request('/api/customer/equipment/getEquipmentReturnRequestList_All', { WRKR_ID: 'A20117965', CRR_ID: '0009215' });
  const retData = Array.isArray(ret.data) ? ret.data : (ret.data?.data || []);
  console.log('   Status:', ret.status, ret.status === 200 ? '✅' : '❌', '건수:', retData.length);
  if (ret.status !== 200) {
    console.log('   응답:', typeof ret.data === 'string' ? ret.data.substring(0, 100) : JSON.stringify(ret.data).substring(0, 100));
  }

  console.log('\n========== 테스트 완료 ==========');
}

main().catch(console.error);
