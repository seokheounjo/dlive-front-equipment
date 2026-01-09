const fs = require('fs');
let content = fs.readFileSync('components/equipment/EquipmentRecovery.tsx', 'utf8');

// 1. Fix barcode scan data transform - add CRR_ID, CMPL_DATE and fix field mapping
content = content.replace(
  /RETN_REQ_YN: item\.RETN_REQ_YN \|\| '',\s*\n\s*LOSS_AMT: item\.LOSS_AMT \|\| '',\s*\n\s*isScanned: item\.EQT_SERNO === serialNo/g,
  `RETN_REQ_YN: item.RETN_REQ_YN || '',
          LOSS_AMT: item.LOSS_AMT || '',
          CRR_ID: item.CRR_ID || '',
          CMPL_DATE: item.CMPL_DATE || '',
          isScanned: item.EQT_SERNO === serialNo`
);

// 2. Fix search data transform - add CRR_ID, CMPL_DATE
content = content.replace(
  /RETN_REQ_YN: item\.RETN_REQ_YN \|\| '',\s*\n\s*LOSS_AMT: item\.LOSS_AMT \|\| '',\s*\n\s*isScanned: scannedSerials\.includes\(item\.EQT_SERNO\)/g,
  `RETN_REQ_YN: item.RETN_REQ_YN || '',
        LOSS_AMT: item.LOSS_AMT || '',
        CRR_ID: item.CRR_ID || '',
        CMPL_DATE: item.CMPL_DATE || '',
        isScanned: scannedSerials.includes(item.EQT_SERNO)`
);

// 3. Fix handleRecoveryProcess - add all required parameters
const oldRecoveryParams = `const params = {
            EQT_NO: item.EQT_NO,
            EQT_SERNO: item.EQT_SERNO,
            PROC_CL: procType, // 1=회수완료, 2=망실처리, 3=고객분실
            CUST_ID: item.CUST_ID
          };`;

const newRecoveryParams = `// Get user info for CHG_UID
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

content = content.replace(oldRecoveryParams, newRecoveryParams);

fs.writeFileSync('components/equipment/EquipmentRecovery.tsx', content);
console.log('EquipmentRecovery.tsx updated successfully');
