# D-Live Work Management API Quick Reference

## Core Work Management APIs

### Work List & Details
```
GET /customer/work/getWorkdrctnList.req
  - Input: 날짜, 작업자ID
  - Purpose: Get assigned work list with filters

GET /customer/work/getWorkReceiptList.req
  - Purpose: Get work receipt details
```

### Work Assignment & Modification
```
GET system/cm/getFindUsrList.req
  - Purpose: Search for workers

POST /customer/work/modWorkDivision.req
  - Input: 작업자ID
  - Purpose: Reassign worker
```

### Work Completion
```
POST /customer/work/modWorkComplete.req
  - Input: WRK_ID, WRK_CD, RCPT_ID, EQT_RMV_FLAG
  - Purpose: Complete work
  - Calls: PCMWK_WORK_COMPLETE_VOIP, PCMCT_CTRT_COMPLETE_VOIP
```

### Work Cancellation
```
POST /customer/workcancel/modWorkCancel.req
  - Purpose: Cancel work
```

---

## Equipment Management APIs

### Equipment Configuration
```
GET /customer/work/getCustProdInfo.req
  - Input: 계약ID, 상품코드, 작업자ID, 건물ID
  - Purpose: Get equipment info (customer, worker, product)

POST /customer/work/eqtCmpsInfoChg.req
  - Input: 접수ID, 계약ID, 상품코드들, 서비스코드들
  - Purpose: Change equipment composition
```

### Equipment Transfer
```
GET customer/equipment/getEqt4Tajijum.req
  - Purpose: Get equipment from other branch/technician

POST customer/equipment/changeEqtWrkr_3.req
  - Input: 지사ID, 장비번호, 작업자ID
  - Purpose: Transfer equipment between workers
```

### Equipment Status
```
POST customer/equipment/callNewEqtStatReqIns.req
  - Input: RCPT_ID, CTRT_ID, WRK_ID
  - Purpose: Check equipment status (FMS)
```

---

## Installation & Network APIs

### Installation Info
```
GET /customer/work/getInstlPostDetailInfo.req
  - Input: CTRT_ID, ADDR_ORD, WRK_ID, POST_ID
  - Purpose: Get installation detail info

POST /customer/work/modNetInfo.req
  - Input: CTRT_ID, WRK_DTL_TCD, EXTN_TP, SUBTAP_ID, PORT_NUM, INSTL_TP, etc.
  - Purpose: Save network info
```

### Signal Integration
```
POST /customer/work/modIfSvc.req
  - Input: MSG_ID, CTRT_ID, CUST_ID, EQT_NO, MAC_ADDRESS
  - Purpose: Send activation signal
```

---

## LGU Integration APIs

### LDAP Management
```
GET /customer/etc/getUplsLdapRslt.req
  - Input: CTRT_ID
  - Purpose: Get LDAP status

POST /customer/etc/reqUplsHspdLdap.req
  - Input: CUST_ID, CTRT_ID, AP_MAC, ONT_MAC, EVNT_CD
  - Purpose: Register/Delete LDAP
  - Calls LGU APIs: hspdLdap, hspdConf
```

### Network Wiring
```
POST /customer/etc/getUplsNwcs.req
  - Input: ENTR_NO
  - Purpose: Get wiring status (L2/OLT info)
  - LGU API Command: nwcs

POST /customer/etc/getUplsEqipInfo.req
  - Input: ENTR_NO, ENTR_RQST_NO, BIZ_TYPE
  - Purpose: Get RN equipment list
  - LGU API Command: ftthEqipList

POST /customer/etc/getUplsEqipPortInfo.req
  - Input: EQIP_ID
  - Purpose: Get port information
  - LGU API Command: ftthEqipPortList
```

### Network Transfer
```
POST /customer/etc/saveLguMangReq.req
  - Purpose: Transfer work to LGU network team
```

---

## Customer & Consultation APIs

### Customer Search
```
GET customer/negociation/getCustCntBySearchCust.req
  - Purpose: Get customer count by search criteria

GET customer/common/customercommon/getConditionalCustList2.req
  - Purpose: Get customer list by phone, address, contract ID, equipment
```

### History
```
GET customer/negociation/getCallHistory.req
  - Input: 고객ID
  - Purpose: Get consultation history

GET customer/sigtrans/getENSSendHist.req
  - Input: 고객ID
  - Purpose: Get SMS send history
```

---

## Electronic Contract APIs

### Contract Management
```
GET customer/customer/general/getSignContratInfo.req
  - Input: WRK_DRCTN_ID, PYM_ACNT_ID, CUST_ID, SIGN_TYP
  - Purpose: Get contract info for electronic signature

POST customer/customer/general/saveSignContract.req
  - Input: WRK_DRCTN_ID, SIGN_TYP, AGREE_YN, AGREE_GB, AGREE_SIGN, etc.
  - Purpose: Save electronic contract signature
  - Calls: PCMWK_WORK_DRCTN_SIGN
```

---

## OTT Management APIs

### OTT Serial
```
GET /customer/work/getOttSale.req
  - Input: WRK_ID, WRK_DRCTN_ID, DATA_TYPE
  - Purpose: Get OTT sale info

GET /customer/work/getOttSerno.req
  - Input: EQT_SERNO, DATA_TYPE
  - Purpose: Search OTT serial number

POST /customer/work/saveOttSale.req
  - Input: WRK_ID, WRK_DRCTN_ID, EQT_SERNO, DATA_TYPE
  - Purpose: Save OTT serial
```

---

## Billing & Payment APIs

### Hotbill
```
GET customer/negociation/getHotbillDtl.req
  - Input: CUST_ID, RCPT_ID
  - Purpose: Get hotbill detail

GET customer/negociation/getHotbillDtlbyCtrt.req
  - Input: BILL_SEQ_NO, CLC_WRK_NO, PROD_GRP, SO_ID, RCPT_ID, CLC_WRK_CL
  - Purpose: Get hotbill detail by contract

POST customer/receipt/calcHotbillSumul.req
  - Input: CUST_ID, CTRT_ID, RCPT_ID, HOPE_DT, CLC_WRK_CL
  - Purpose: Calculate hotbill
```

### Suspension
```
GET /customer/etc/getMmtSusInfo.req
  - Input: RCPT_ID, CTRT_ID
  - Purpose: Get temporary suspension info

POST /customer/etc/modMmtSusInfo.req
  - Input: CTRT_ID, RCPT_ID, suspension dates
  - Purpose: Modify suspension period
```

---

## Common Request Parameters

### Work Identifiers
- **WRK_DRCTN_ID** - Work Direction ID (작지서ID)
- **WRK_ID** - Work ID (작업ID)
- **RCPT_ID** - Receipt ID (접수ID)

### Customer/Contract
- **CUST_ID** - Customer ID
- **CTRT_ID** - Contract ID
- **SO_ID** - Sales Office ID

### Equipment
- **EQT_NO** - Equipment Number
- **MAC_ADDRESS** - MAC Address
- **EQT_SERNO** - Equipment Serial Number

### Worker
- **WRKR_ID** - Worker ID

---

## Common Response Codes

### Work Status (WRK_STAT_CD)
- **7** - Completed with equipment removal

### Contract Status (CTRT_STAT)
- **59** - Forced termination with removal
- **89** - Termination with removal

### Equipment Status (EQT_STAT_CD)
- **10** - In stock
- **3** - Owned by technician

---

## Code Lookup Tables

### Work Management
- **CMWO224** - Work Change Reason
- **CMWO047** - Installation Location
- **CMWO048** - Viewing Mode

### Installation
- **BLST014** - Installation Method
- **BLST010** - Installation Type
- **CMCU048** - Network Classification

---

## External API Integrations

### LGU+ APIs
- **hspdLdap** - LDAP processing (등록/삭제)
- **hspdConf** - Indoor configuration (신규/변경)
- **entrInfo** - Contract info inquiry
- **ldapInfo** - LDAP info inquiry
- **nwcs** - Wiring status inquiry
- **ftthEqipList** - FTTH equipment list
- **ftthEqipPortList** - FTTH port list

### FMS System
- **CONA_TCMEP_EQT_STAT_INFO@FMSIF2** - Equipment status

---

## Database Tables Reference

### Work Tables
- TCMWK_WORK
- TCMWK_WORK_DRCTN
- TCMWK_DE_PROC_RESN_INFO
- TCMWK_MMT_SUS_INFO
- TCMWK_OTT_SALE_TRY

### Customer Tables
- TCMCU_CUST_INFO
- TCMCU_PYM_ACNT_INFO
- TCMCU_PYM_ATMT_APPL_INFO

### Contract Tables
- TCMCT_CTRT_INFO
- TCMCT_NET_INFO
- TCMCT_PROD_CMPS_INFO
- TCMCT_CUST_EQT_INFO
- TCMCT_UPLS_CTRT_INFO

### Equipment Tables
- TCMEP_EQT_MASTER
- TCMEP_EQT_HIST
- TCMEP_EQT_WRKR_CHG

### Integration Tables
- TCMIF_LGHV_SVC_DTL
- TCMIF_DLV_SVC_DTL
- TCMIF_SVC_DTL
- TLGU_LDAP_CONF

---

## Error Handling Best Practices

1. **Check work status before processing**
2. **Validate safety inspection completion**
3. **Verify equipment availability**
4. **Confirm signal integration success**
5. **Handle LGU API timeouts gracefully**
6. **Provide clear error messages to users**

---

## Performance Tips

1. **Cache code lookup data**
2. **Pre-load worker information**
3. **Batch equipment queries**
4. **Compress images before upload**
5. **Use pagination for work lists**
6. **Implement request debouncing**

---

## Security Considerations

1. **Always include worker ID from session**
2. **Validate work ownership before operations**
3. **Encrypt sensitive customer data**
4. **Implement OTP for critical operations**
5. **Log all work status changes**
6. **Sanitize user inputs**
