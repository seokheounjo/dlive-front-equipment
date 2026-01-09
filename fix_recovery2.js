const fs = require('fs');
let content = fs.readFileSync('components/equipment/EquipmentRecovery.tsx', 'utf8');

const oldParams = `      for (const item of selectedItems) {
        try {
          const params = {
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            PROC_CL: procType, // 1=회수완료, 2=망실처리, 3=고객분실
            CUST_ID: item.CUST_ID
          };
          await debugApiCall(`;

const newParams = `      for (const item of selectedItems) {
        try {
          // Get user info for CHG_UID
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
          };
          await debugApiCall(`;

if (content.includes(oldParams)) {
  content = content.replace(oldParams, newParams);
  fs.writeFileSync('components/equipment/EquipmentRecovery.tsx', content);
  console.log('Recovery params updated');
} else {
  console.log('Pattern not found - maybe already updated or different whitespace');
  // Try showing what's around the area
  const idx = content.indexOf('PROC_CL: procType');
  if (idx > -1) {
    console.log('Context around PROC_CL:', content.substring(idx-100, idx+200));
  }
}
