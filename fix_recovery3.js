const fs = require('fs');
let content = fs.readFileSync('components/equipment/EquipmentRecovery.tsx', 'utf8');

// Use regex to be more flexible with whitespace
const pattern = /const params = \{\s*\n\s*EQT_NO: item\.EQT_NO,\s*\n\s*EQT_SERNO: item\.EQT_SERNO,\s*\n\s*PROC_CL: procType, \/\/ 1=회수완료, 2=망실처리, 3=고객분실\s*\n\s*CUST_ID: item\.CUST_ID\s*\n\s*\};/;

const newParams = `// Get user info for CHG_UID
          const userInfoStr = typeof window !== 'undefined' ? sessionStorage.getItem('userInfo') : null;
          const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
          const today = new Date().toISOString().slice(0,10).replace(/-/g, '');

          const params = {
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            PROC_CL: procType, // 1=회수완료, 2=망실처리, 3=고객분실
            CUST_ID: item.CUST_ID,
            CTRT_ID: item.CTRT_ID,
            WRK_ID: item.WRK_ID,
            CRR_ID: item.CRR_ID || userInfo.crrId || '',
            WRKR_ID: item.WRKR_ID || userInfo.userId || '',
            SO_ID: item.SO_ID || userInfo.soId || '',
            CHG_UID: userInfo.userId || '',
            PROC_UID_SO_ID: userInfo.soId || item.SO_ID || '',
            RTN_DD: today,
            RTN_TP: '3', // 3=기사회수
            STTL_YN: 'N'
          };`;

if (pattern.test(content)) {
  content = content.replace(pattern, newParams);
  fs.writeFileSync('components/equipment/EquipmentRecovery.tsx', content);
  console.log('Recovery params updated successfully');
} else {
  console.log('Pattern not found');
}
