# D-Live Function Specification Analysis - Work Management (작업관리)

## Document Overview
**Source:** dlive_function_0.7.xlsx
**Analysis Date:** 2025-10-30
**Total Sheets:** 15
**Focus Area:** Work Management (작업관리) functionality for Mobile CONA Front Application

---

## Table of Contents
1. [Menu Structure](#menu-structure)
2. [Work Management Process Flow](#work-management-process-flow)
3. [Detailed Features & API Endpoints](#detailed-features--api-endpoints)
4. [Required Functions](#required-functions)
5. [UI/UX Requirements](#uiux-requirements)
6. [Business Logic & Workflows](#business-logic--workflows)
7. [Data Structures](#data-structures)
8. [Integration Points](#integration-points)

---

## Menu Structure

### AS-IS Menu Structure (Current)
**작업관리 (Work Management)**
- 작업접수내역 (Work Receipt List)
- 업무자동화봇 (Work Automation Bot)
- 교환기상태조회 (Exchange Status Inquiry)
- 전송이력조회 (Transmission History)
- 작업결과신호현황 (Work Result Signal Status)
- 광랜포트변경 (Optical LAN Port Change)
- OTT설치(기사방문용) (OTT Installation for Technician Visit)
- (LGU)공사요청진행정보 (LGU Construction Request Progress)
- 공지사항 (Announcements)

### TO-BE Menu Structure (Target)
**작업관리 (Work Management)**
- **안전점검** (Safety Inspection) - NEW
- **작업접수내역** (Work Receipt List)
- **작업결과신호현황** (Work Result Signal Status)

### Design Approach Considerations
1. **Process Flow Maintenance**
   - Option 1: 팝업 방식 (Popup Method) - Session maintained through popups
   - Option 2: 메뉴이동 방식 (Menu Navigation Method) - Session maintained through navigation

2. **Design Method**
   - Option 1: 고정 화면 (Fixed Screen)
   - Option 2: API 응답값에 따른 가변-동적인 화면 (Dynamic Screen based on API responses)

---

## Work Management Process Flow

### Main Process (작업처리 절차)

```
1. 안전점검 (Safety Inspection)
   └─> Must be completed before work processing

2. 작업조회 (Work Inquiry) - Based on 작지서ID
   └─> Filter: Work Type Code / Work Detail Type Code
   └─> Filter: Scheduled Date / Receipt Date
   └─> Filter: Work Status (In Progress / Completed)
   └─> Display: Work assigned to current user only

3. 작업자보정 (Worker Adjustment) - Based on 작지서ID
   └─> Modify: Scheduled Date (Date/Time/Minute)
   └─> Modify: Assigned Worker (Searchable)
   └─> Input: Reason for schedule change

4. 접수상세조회 (Receipt Detail Inquiry) - Based on 작업ID
   └─> View detailed work information

5. 장비설치 (Equipment Installation) - Based on 작업ID
   └─> Equipment configuration and installation

6. 집선조회 (Wiring Inquiry) - Based on 작업ID
   └─> LGU Leased Network / FTTH wiring

7. 완료처리 (Completion Processing) - Based on 작업ID
   └─> Installation info registration
   └─> Signal integration
   └─> Contract completion

8. 작업취소 (Work Cancellation) - Based on 작업ID
   └─> Cancel work with reason

9. 망이관처리 (Network Transfer Processing)
   └─> Transfer to network team
```

---

## Detailed Features & API Endpoints

### 1. Work Inquiry (작업조회)

**API Endpoint:** `/customer/work/getWorkdrctnList.req`

**Features:**
- Filter by work type code / work detail type code
- Date-based search (scheduled date / receipt date)
- Work status filter (in progress / completed)
- Sort by time or route (based on work location)
- Display location on map with route optimization

**Input Parameters:**
- 날짜 (Date)
- 작업자ID (Worker ID)

**Code Lookups Required:**
- Work Type Code (작업구분코드)
- Work Detail Type Code (작업구분 상세)

**Map Integration:**
- Display work locations on map
- Route optimization based on login location
- Sort work list by route or time

---

### 2. Receipt Detail Inquiry (접수상세조회)

**Primary API:** `/customer/work/getWorkReceiptList.req`

**Sub-features:**

#### 2.1 Customer History
- **상담이력조회** (Consultation History)
  - API: `customer/negociation/getCallHistory.req`
  - Input: 고객ID (Customer ID)

- **문자발송내역조회** (SMS History)
  - API: `customer/sigtrans/getENSSendHist.req`
  - Input: 고객ID (Customer ID)

#### 2.2 Work Operations
- **작업 취소** (Work Cancellation)
  - API: `/customer/etc/modOstWorkCancel.req`
  - Input: 작업ID (Work ID)

- **망장애 이관** (Network Failure Transfer)
  - Network team transfer processing

#### 2.3 LGU ISP Operations
- **LGU ISP 청약 등록**
  - API: `/customer/etc/reqUplsHspdLdap.req`
  - Input: 계약ID (Contract ID)

- **LGU ISP 포트현황조회** (Port Status)

- **LGU ISP 포트증설요청 등록** (Port Expansion Request)
  - API: `/customer/etc/setUplsRqstConsReq.req`

- **LGU ISP 망장애 이관요청** (Network Failure Transfer Request)
  - API: `/customer/etc/getLguMangReq.req`
  - API: `/customer/etc/saveLguMangReq.req`

#### 2.4 DLIVE FTTH Operations
- **DLIVE FTTH 포트현황조회** (Port Status)
  - API: `/customer/etc/getCertifyCL02.req`

#### 2.5 Promotional Info
- **각종 영업 프로모션 및 이벤트내용 조회**
  - API: `/customer/work/getWorkAlarmInfo.req`
  - API: `/customer/work/getVod6MonUseDate.req`
  - API: `/customer/etc/getSpecialCust4VOD5K.req`
  - API: `/customer/customer/general/customerChgInfo.req`

#### 2.6 A/S Operations
- **FMS 장비상태 조회** (Equipment Status)
  - Input: 계약ID, 장비MAC (Contract ID, Equipment MAC)

- **LGU 장애/속도제어 조회** (Failure/Speed Control)
  - For LG ISP subscribers

#### 2.7 Deprecated Functions
- 자동이체등록 (Auto-payment registration) - 삭제예정
- 청구매체등록 (Billing media registration) - 삭제예정
- 사은품접수봇 등록 (Gift registration bot) - 삭제예정
- 부가가입봇 등록 (Additional subscription bot) - 삭제예정
- 상담등록 (Consultation registration) - 삭제예정
- 전화번호변경 (Phone number change) - 삭제예정

**Note:** These functions are being moved to the Customer Management (고객관리) menu.

---

### 3. Worker Adjustment (작업자보정)

**API Endpoints:**
1. **작업자 조회** (Worker Search)
   - API: `system/cm/getFindUsrList.req`
   - Purpose: Search for workers to reassign work

2. **작업자 변경 등록** (Worker Change Registration)
   - API: `/customer/work/modWorkDivision.req`
   - Input: 작업자ID (Worker ID)
   - Purpose: Save worker assignment changes

**Code Lookups:**
- CMWO224: Work Change Reason Code

**Features:**
- Change scheduled date/time
- Reassign worker
- Input reason for changes

---

### 4. Equipment Installation (장비설치)

**API Endpoints:**

#### 4.1 Equipment Configuration
- **장비구성정보조회** (Equipment Configuration Inquiry)
  - API: `/customer/work/getCustProdInfo.req` (getEqtProdInfo)
  - API: `customer/receipt/contract/getEquipmentListOfBasic.req`
  - Input: 계약ID (Contract ID), 상품코드 (Product Code)
  - Purpose: Get equipment assigned to contract and available equipment for product

- **장비구성정보변경** (Equipment Configuration Change)
  - API: `/customer/work/eqtCmpsInfoChg.req` (PCMCT_EQT_CMPS_INFO_CHG)
  - Input: 접수ID, 계약ID, 상품코드들, 서비스코드들
  - Tables: TCMCT_PROD_CMPS_INFO, TCMCT_SVC_CMPS_INFO

#### 4.2 Customer Equipment Removal
- **고객장비철거 - 임대장비** (Rental Equipment Removal)
  - API: `/customer/work/modWorkComplete.req` (custEqtInfoDel)
  - Procedure: PCMCT_CUST_EQT_INFO_DEL
  - Input: 장비번호, 작업ID, 고객ID, 접수ID
  - Tables: TCMCT_CUST_EQT_HIST, TCMCT_CUST_EQT_INFO, TCMEP_EQT_MASTER, TCMEP_EQT_HIST

- **고객장비철거 - 고객소유장비** (Customer-Owned Equipment Removal)
  - API: `/customer/work/insertCustEqt.req` (PCMWK_REG_CUSTEQT)
  - Tables: TCMEP_EQT_MASTER, TCMCT_CUST_EQT_INFO

#### 4.3 Customer Equipment Registration
- **고객장비등록 - 기사보유장비** (Technician-Held Equipment Registration)
  - API: `/customer/work/modWorkComplete.req` (custEqtInfoIns)
  - Procedure: PCMCT_CUST_EQT_INFO_INS
  - Input: 장비번호, 작업ID, 고객ID, 접수ID
  - Tables: TCMEP_EQT_MASTER, TCMCT_CUST_EQT_INFO, TCMCT_CUST_EQT_HIST, TCMEP_EQT_HIST

- **고객장비등록 - 고객소유장비** (Customer-Owned Equipment Registration)
  - API: `/customer/equipment/getCustEqt4SoftStb.req`
  - Input: 고객ID, 계약ID

#### 4.4 Technician Equipment Operations
- **기사 보유장비 조회** (Technician Equipment Inquiry)
  - API: `/customer/work/getCustProdInfo.req` (getWrkrEqtInfo)
  - Input: 작업자ID, 계약ID, 건물ID

- **설치장비선택 - 바코드/키인** (Equipment Selection - Barcode/Key-in)
  - Uses ActiveX for barcode scanning
  - Links to Equipment Status Inquiry menu

- **장비가져오기 - 타지점,타기사** (Equipment Transfer from Other Branch/Technician)
  - API: `customer/equipment/getEqt4Tajijum.req`
  - API: `customer/equipment/changeEqtWrkr_3.req` (PCMEP_EQT_WRKR_CHG_3)
  - Input: 작업자ID, 계약ID, 지사ID, 장비번호
  - Tables: TCMEP_EQT_WRKR_CHG, TCMEP_EQT_MASTER, TCMEP_EQT_HIST

---

### 5. Wiring Inquiry (집선조회)

**For LGU Leased Network / FTTH**

#### 5.1 LGU LDAP Operations
- **LGU - LDAP 등록** (Registration)
  - API: `/customer/etc/getUplsLdapRslt.req`
  - API: `/customer/etc/reqUplsHspdLdap.req`
  - Input: CTRT_ID, CUST_ID, AP_MAC, ONT_MAC, EVNT_CD
  - Tables: TLGU_LDAP_CONF
  - LGU API Calls: hspdLdap, hspdConf

- **LGU - LDAP 조회** (Inquiry)
  - API: `/customer/etc/getUplsCtrtInfo.req`
  - API: `/customer/etc/getUplsApiReq.req` (COMMAND = entrInfo)
  - API: `customer/negociation/getCustomerCtrtEquipInfo.req`
  - API: `/customer/etc/getUplsLdapInfo.req` (COMMAND = ldapInfo)
  - Input: CTRT_ID, ENTR_NO, AP_MAC, ONT_MAC

- **LGU - 집선현황조회** (Wiring Status)
  - API: `/customer/etc/getUplsNwcs.req` (COMMAND = nwcs)
  - Input: ENTR_NO
  - Purpose: Get L2 equipment info connected to AP

#### 5.2 DLIVE FTTH Operations
- **딜라이브 FTTH - 집선현황조회** (Wiring Status)
  - API: `/customer/etc/getUplsNwcs.req` (COMMAND = nwcs)
  - API: `/customer/etc/getUplsEqipInfo.req` (COMMAND = ftthEqipList)
  - API: `/customer/etc/getUplsEqipPortInfo.req` (COMMAND = ftthEqipPortList)
  - Input: ENTR_NO, ENTR_RQST_NO, BIZ_TYPE, EQIP_ID
  - Purpose: Get OLT info connected to ONT, RN equipment list, port information

---

### 6. Completion Processing (완료처리)

**Primary API:** `/customer/work/modWorkComplete.req`

#### 6.1 Installation Information
- **설치정보등록** (Installation Info Registration)
  - API: `/customer/work/getInstlPostDetailInfo.req`
  - API: `/customer/work/getChkWorkFee.req`
  - API: `/customer/work/modNetInfo.req`
  - Input: CTRT_ID, ADDR_ORD, WRK_ID, POST_ID, WRK_DTL_TCD, etc.
  - Tables: TCMCT_NET_INFO, TBLST_INSTL_TERM_FEE
  - Code Lookups: BLST014 (설치방법), BLST010 (설치구분), CMCU048 (망구분)

#### 6.2 Installation Location
- **설치상세위치등록** (Detailed Location Registration)
  - API: `/customer/work/getWorkReceiptList.req`
  - API: `/customer/work/modWorkComplete.req`
  - Tables: TCMCT_CTRT_INFO.instl_loc, TCMWK_WORK.INSTL_SPAC
  - Code Lookups: CMWO047 (설치위치), CMWO048 (시청모드)

#### 6.3 Signal Integration
- **개통신호연동/조회** (Activation Signal Integration/Inquiry)
  - API: `/customer/work/modIfSvc.req`
  - API: `customer/sigtrans/getLghvSendHist.req`
  - API: `customer/etc/getCertifyApiHist.req`
  - API: `customer/sigtrans/getSendHistory.req`
  - API: `customer/etc/getUplsLdapHist.req`
  - Input: MSG_ID, CTRT_ID, CUST_ID, EQT_NO, MAC_ADDRESS
  - Tables: TCMIF_LGHV_SVC_DTL, TCMIF_DLV_SVC_DTL, TCMIF_SVC_DTL, TLGU_LDAP_CONF
  - Note: Excludes OTT experience equipment and terminal authentication products

#### 6.4 Equipment Status Check
- **설치장비상태조회** (Installation Equipment Status)
  - API: `customer/equipment/callNewEqtStatReqIns.req`
  - API: `customer/equipment/callEqtStatReqIns4ASRcpt.req`
  - Input: RCPT_ID, CTRT_ID, WRK_ID, PROD_GRP, KPI_PROD_GRP_CD
  - Tables: TCMEP_CALC_REFER_STAT_DTL, CONA_TCMEP_EQT_STAT_INFO@FMSIF2
  - Source: FMS System

#### 6.5 Equipment Removal Commit
- **장비철거 Commit** (Equipment Removal Commit)
  - API: `/customer/work/modWorkComplete.req`
  - Input: WRK_ID, WRK_CD, RCPT_ID, EQT_RMV_FLAG='Y'
  - Updates: TCMWK_WORK.WRK_STAT_CD = 7
  - Contract Status: 59 (직권해지철거), 89 (해지철거)
  - Tables: TCMWK_DE_PROC_RESN_INFO.UNPROC_RESN_CD = 7

#### 6.6 Work Completion Commit
- **작업완료 Commit** (Work Completion Commit)
  - API: `/customer/work/modWorkComplete.req`
  - Procedures: PCMWK_WORK_COMPLETE_VOIP, PCMCT_CTRT_COMPLETE_VOIP, PCMWK_DE_PROC_RESN_HISTORY
  - Input: WRK_ID, WRK_CD, RCPT_ID, EQT_RMV_FLAG

#### 6.7 Additional Operations

- **할인반환금조회** (Discount Refund Inquiry)
  - API: `customer/negociation/getHotbillDtl.req`
  - API: `customer/negociation/getHotbillDtlbyCtrt.req`
  - API: `customer/negociation/getHotbillDtlbyCharge.req`
  - API: `customer/receipt/calcHotbillSumul.req`
  - Input: CUST_ID, RCPT_ID, BILL_SEQ_NO, CLC_WRK_NO, PROD_GRP, SO_ID, CTRT_ID, HOPE_DT, CLC_WRK_CL

- **이용정지기간변경** (Suspension Period Change)
  - API: `/customer/etc/getMmtSusInfo.req`
  - API: `/customer/etc/modMmtSusInfo.req`
  - Input: RCPT_ID, CTRT_ID, 일시정지희망일, 일시정지희망종료일, 정지일수
  - Tables: TCMWK_MMT_SUS_INFO, TCMCT_CTRT_INFO.MMT_SUS_HOPE_DD

- **캡쳐본 문자 보내기** (Send Screenshot via SMS)
  - Purpose: Upload speed test screenshot and send to customer

- **OTT 시리얼 등록** (OTT Serial Registration)
  - API: `/customer/work/getOttSale.req`
  - API: `/customer/work/getOttSerno.req`
  - API: `/customer/work/saveOttSale.req`
  - API: `/customer/work/getOttType.req`
  - Input: WRK_ID, WRK_DRCTN_ID, DATA_TYPE, EQT_SERNO
  - Tables: TCMWK_OTT_SALE_TRY, OTT_MASTER

- **계약서 선택(전자/지류)** (Contract Selection - Electronic/Paper)
  - API: `customer/customer/general/getSignContratInfo.req`
  - Input: WRK_DRCTN_ID, PYM_ACNT_ID, CUST_ID, SIGN_TYP

- **전자계약서 교부 및 서명** (Electronic Contract Delivery and Signature)
  - API: `customer/customer/general/saveSignContract.req`
  - Procedure: PCMWK_WORK_DRCTN_SIGN
  - Input: WRK_DRCTN_ID, SIGN_TYP, AGREE_YN, AGREE_GB, AGREE_SIGN, SMS_RCV_YN, EML_RCV_YN, PHONE_NO, EML, SEND_NO_RESN

---

### 7. Work Cancellation (작업취소)

**API Endpoints:**

- **작업취소 Commit** (Work Cancellation Commit)
  - API: `/customer/workcancel/modWorkCancel.req`
  - Purpose: Cancel selected work ID or all work IDs assigned to work order ID

- **망장애 이관** (Network Failure Transfer)
  - LGU: `/customer/etc/saveLguMangReq.req`
  - D-Live: `customer/negociation/insertRcptProcInfo.req`
  - Purpose: Transfer work to network team

**Code Lookups:**
- Cancellation Reason Code (from Receipt Detail Inquiry)

---

### 8. Safety Inspection (안전점검)

**Features:**
1. **안전점검항목 조회** (Safety Inspection Items Inquiry)
   - Must be completed before work processing

2. **안전점검 항목 등록** (Safety Inspection Items Registration)
   - Mandatory registration
   - PC-CONA needs forced setting feature if mobile registration fails

3. **셀프사진 업로드** (Self-Photo Upload)
   - Only allow camera photos (gallery photos not allowed)
   - Upload to D-Live server specific directory

---

### 9. Other Work Management Features (작업 기타)

#### Signal Integration Management
- **신호연동관리** (Signal Integration Management)
  - Purpose: Check KCT registration status after VoIP installation/A/S

- **교환기상태조회** (Exchange Status Inquiry)

- **리셋: TA단말 리셋처리** (TA Terminal Reset)

- **전송이력조회** (Transmission History)

- **처리가능 신호연동 종류 조회** (Available Signal Integration Types)

- **처리가능 신호연동 처리** (Process Available Signal Integration)

#### Customer Inquiry
- **고객아이디조회** (Customer ID Inquiry)
  - API: `customer/negociation/getCustCntBySearchCust.req`
  - API: `customer/common/customercommon/getConditionalCustList2.req`
  - Search by: Phone number, Address, Customer ID, Contract ID, Equipment S/N, MAC
  - Cannot search by customer name alone

#### Announcements
- **공지사항** (Announcements)
  - Display announcements (app notifications)
  - Consider personalization requirements

#### LGU Construction Requests
- **(LGU)공사요청진행정보** (LGU Construction Request Progress)
  - Purpose: Request port expansion when insufficient ports at work site
  - Features: Inquiry, Registration, Modification, Deletion

#### LGU Network Failure Transfer List
- **(LGU)망장애이관리스트** (LGU Network Failure Transfer List)
  - Inquiry of registered network failure transfers and processing results

#### Work Automation Bot
- **업무자동화봇** (Work Automation Bot)
  - Activation signal integration
  - Gift reception
  - Additional subscription

---

## Required Functions

### Mobile-Specific Features

1. **신용카드결제기능 (Credit Card Payment)**
   - Key-in payment
   - Direct customer payment
   - Integration with PG (Payment Gateway) on CONA server

2. **전자계약서 (Electronic Contract)**
   - Customer can sign contract on their phone
   - Identity verification
   - Web page implementation required

3. **자동이체신청서 (Auto-Payment Application)**

4. **바코드리더 (Barcode Reader)**
   - Used in equipment management
   - Scan equipment barcode to get equipment number

5. **전화걸기/문자발송 (Call/SMS)**
   - Launch phone app for calls
   - Launch SMS app for messages
   - Register sending fact via CONA API
   - Send screenshots/images to customers

6. **사진올리기 (Photo Upload)**
   - Only allow camera photos (no gallery)
   - Safety inspection: Upload technician photo
   - Customer: Send web page for photo upload
   - Save to D-Live server specific directory

7. **지도에 작업장소 표시 (Map Display)**
   - Display work locations on map
   - Options: Naver, Kakao, Google, National Geographic
   - Investigate free/paid options

8. **근무지로부터 가까운곳으로 동선 표시 (Route Display)**
   - Based on work location from login response
   - Display optimal route
   - Sort work list by route or time

9. **캡처방지 (Screenshot Prevention)**
   - Review technical feasibility
   - Not possible for web browsers

10. **Login시 OTP 체크 (OTP Check on Login)**

11. **메뉴이동 로깅 (Menu Navigation Logging)**
    - Define API logging call points

### External Integrations

1. **실명인증** (Identity Verification)
   - Provider: NICE Information & Communication

2. **계좌인증** (Account Verification)
   - Provider: KS-NET

3. **카드인증** (Card Verification)
   - Provider: Toss

4. **Timestamp**
   - Provider: Dream Security

5. **Mobile OTP 연동** (Mobile OTP Integration)**

### PC-CONA Server Features

1. **고객조회 범위** (Customer Inquiry Range)

2. **안전점검 완료 설정** (Safety Inspection Completion Setting)
   - Force enable work processing if mobile app fails

3. **요금항목별 수납처리** (Payment Processing by Fee Item)

---

## UI/UX Requirements

### Session Management
Two options for maintaining session during work process:

1. **팝업 방식 (Popup Method)**
   - Maintain session through popup windows
   - User stays on same page with overlays

2. **메뉴이동 방식 (Navigation Method)**
   - Maintain session through page navigation
   - User navigates between different pages

### Screen Design Approach

1. **고정 화면 (Fixed Screen)**
   - Predefined layout
   - Consistent structure

2. **동적 화면 (Dynamic Screen)**
   - Based on API response values
   - Variable layout based on data

### Work List Display

**Filters:**
- Work type code / Work detail type code
- Scheduled date / Receipt date range
- Work status (In Progress / Completed)
- Show only work assigned to logged-in user

**Sorting:**
- Time-based sorting
- Route-based sorting (distance from work location)

**Map View:**
- Display work locations on map
- Route optimization
- Distance calculation from current location

### Work Detail View

**Tabs/Sections:**
- Receipt information
- Customer information
- Contract/Product information
- Consultation history
- SMS history
- Promotional information
- Equipment status
- Signal integration status

**Actions:**
- Work cancellation
- Network transfer
- Worker reassignment
- Schedule adjustment

---

## Business Logic & Workflows

### 1. Work Assignment Flow

```
Login
  └─> Get worker location
       └─> Fetch assigned work list
            └─> Filter by status/date
                 └─> Sort by route/time
                      └─> Display on map
```

### 2. Safety Inspection Requirement

```
Select Work Item
  └─> Check safety inspection status
       ├─> Not Completed
       │    └─> Block work processing
       │         └─> Redirect to safety inspection
       │
       └─> Completed
            └─> Allow work processing
```

### 3. Work Completion Flow

```
Start Work
  └─> Equipment Installation
       └─> Wiring (if applicable)
            └─> Installation Info Registration
                 └─> Signal Integration
                      └─> Equipment Status Check
                           └─> Contract Selection
                                └─> Electronic Signature (optional)
                                     └─> Work Completion Commit
```

### 4. Equipment Management Flow

```
View Equipment Configuration
  └─> Check Technician's Equipment
       ├─> Sufficient Equipment
       │    └─> Select Equipment (Barcode/Key-in)
       │         └─> Register to Customer
       │
       └─> Insufficient Equipment
            ├─> Transfer from Other Technician/Branch
            └─> Request Equipment Allocation
```

### 5. Work Cancellation Flow

```
Select Work to Cancel
  └─> Check Work Status
       ├─> Can Cancel
       │    └─> Select Cancellation Reason
       │         └─> Confirm Cancellation
       │              └─> Update Work Status
       │
       └─> Cannot Cancel (Network Issue)
            └─> Transfer to Network Team
```

### 6. Worker Reassignment Flow

```
Select Work
  └─> Open Worker Adjustment
       └─> Search Available Workers
            └─> Select New Worker
                 └─> Enter Change Reason
                      └─> Update Assignment
```

---

## Data Structures

### Key Tables

#### Work Management Tables
- **TCMWK_WORK** - Work master table
- **TCMWK_WORK_DRCTN** - Work direction/order
- **TCMWK_DE_PROC_RESN_INFO** - Unprocessed reason info
- **TCMWK_DE_PROC_RESN_HISTORY** - Reason history
- **TCMWK_MMT_SUS_INFO** - Temporary suspension info
- **TCMWK_OTT_SALE_TRY** - OTT sales try
- **TCMWK_WORK_DRCTN_SIGN** - Electronic contract signature

#### Customer Tables
- **TCMCU_CUST_INFO** - Customer info
- **TCMCU_PYM_ACNT_INFO** - Payment account info
- **TCMCU_PYM_ATMT_APPL_INFO** - Auto-payment application
- **TCMCU_RLNM_ACNT_AUTH_HIST** - Real-name account auth history

#### Contract Tables
- **TCMCT_CTRT_INFO** - Contract info
- **TCMCT_NET_INFO** - Network info
- **TCMCT_PROD_CMPS_INFO** - Product composition info
- **TCMCT_SVC_CMPS_INFO** - Service composition info
- **TCMCT_CUST_EQT_INFO** - Customer equipment info
- **TCMCT_CUST_EQT_HIST** - Customer equipment history
- **TCMCT_UPLS_CTRT_INFO** - UPlus contract info
- **TCMCT_CUST_ATMT_INFO** - Customer auto-payment info

#### Equipment Tables
- **TCMEP_EQT_MASTER** - Equipment master
- **TCMEP_EQT_HIST** - Equipment history
- **TCMEP_EQT_WRKR_CHG** - Equipment worker change
- **TCMEP_CALC_REFER_STAT_DTL** - Calculation reference status detail

#### Integration Tables
- **TCMIF_LGHV_SVC_DTL** - LG HelloVision service detail
- **TCMIF_DLV_SVC_DTL** - D-Live service detail
- **TCMIF_SVC_DTL** - Service detail
- **TLGU_LDAP_CONF** - LGU LDAP configuration

#### Receipt Tables
- **TCMRC_CNSL_RCPT_INFO** - Consultation receipt info

#### Installation Tables
- **TBLST_INSTL_TERM_FEE** - Installation terminal fee

### Key Fields

#### Work ID Fields
- **WRK_DRCTN_ID** - Work Direction ID (작지서ID)
- **WRK_ID** - Work ID (작업ID)
- **RCPT_ID** - Receipt ID (접수ID)

#### Customer/Contract Fields
- **CUST_ID** - Customer ID
- **CTRT_ID** - Contract ID
- **PYM_ACNT_ID** - Payment Account ID

#### Equipment Fields
- **EQT_NO** - Equipment Number
- **MAC_ADDRESS** - MAC Address
- **EQT_SERNO** - Equipment Serial Number

#### Worker Fields
- **WRKR_ID** - Worker ID
- **SO_ID** - Sales Office ID

#### Status Fields
- **WRK_STAT_CD** - Work Status Code
- **CTRT_STAT** - Contract Status
- **EQT_STAT_CD** - Equipment Status Code

---

## Integration Points

### External Systems

#### 1. LGU (LG U+) Integration
- **LDAP Registration/Inquiry**
  - hspdLdap API
  - hspdConf API
  - entrInfo API
  - ldapInfo API
  - nwcs API (Wiring configuration)
  - ftthEqipList API
  - ftthEqipPortList API

#### 2. FMS (Facility Management System)
- **Equipment Status Inquiry**
  - CONA_TCMEP_EQT_STAT_INFO@FMSIF2

#### 3. KCT (Korea Cable Telecom)
- **Signal Integration Management**
  - Registration status check after VoIP installation/A/S

#### 4. Payment Gateways
- **KS-NET** - Account verification
- **Toss** - Card verification
- **Credit Card PG** - Payment processing

#### 5. Authentication Services
- **NICE Information & Communication** - Identity verification
- **Dream Security** - Timestamp
- **Mobile OTP** - OTP verification

### Internal Systems

#### 1. PC-CONA System
- Customer management features
- Safety inspection forced setting
- Payment processing

#### 2. Image/Document Servers
- **신뢰스캔서버** (Trusted Scan Server) - JPG images
- **전자화서버** (Digitization Server) - PDF files (LG CNS)
- Photo upload storage

#### 3. Notification Systems
- **SMS/ENS** - Text message sending
- **Email** - Contract delivery
- **알림톡** (Kakao Notification) - Contract delivery

---

## Code Lookups Required

### Work Codes
- **작업구분코드** (Work Type Code)
- **작업구분 상세** (Work Detail Type Code)
- **CMWO224** - Work Change Reason
- **CMWO047** - Installation Location
- **CMWO048** - Viewing Mode

### Installation Codes
- **BLST014** - Installation Method
- **BLST010** - Installation Type
- **CMCU048** - Network Classification

---

## API Summary by Category

### Work Management Core APIs
1. `/customer/work/getWorkdrctnList.req` - Get work list
2. `/customer/work/getWorkReceiptList.req` - Get work receipt details
3. `/customer/work/modWorkDivision.req` - Modify worker assignment
4. `/customer/work/modWorkComplete.req` - Complete work
5. `/customer/workcancel/modWorkCancel.req` - Cancel work

### Equipment APIs
6. `/customer/work/getCustProdInfo.req` - Get customer product info
7. `/customer/work/eqtCmpsInfoChg.req` - Change equipment composition
8. `/customer/work/insertCustEqt.req` - Insert customer equipment
9. `/customer/equipment/getCustEqt4SoftStb.req` - Get customer equipment for software STB
10. `/customer/equipment/getEqt4Tajijum.req` - Get equipment from other branch
11. `/customer/equipment/changeEqtWrkr_3.req` - Change equipment worker
12. `customer/equipment/callNewEqtStatReqIns.req` - Check equipment status (FMS)
13. `customer/equipment/callEqtStatReqIns4ASRcpt.req` - Check equipment status for A/S

### Installation & Completion APIs
14. `/customer/work/getInstlPostDetailInfo.req` - Get installation detail info
15. `/customer/work/getChkWorkFee.req` - Check work fee
16. `/customer/work/modNetInfo.req` - Modify network info
17. `/customer/work/modIfSvc.req` - Signal integration

### LGU Integration APIs
18. `/customer/etc/getUplsLdapRslt.req` - Get LGU LDAP result
19. `/customer/etc/reqUplsHspdLdap.req` - Request LGU high-speed LDAP
20. `/customer/etc/getUplsCtrtInfo.req` - Get UPlus contract info
21. `/customer/etc/getUplsApiReq.req` - LGU API request
22. `/customer/etc/getUplsLdapInfo.req` - Get UPlus LDAP info
23. `/customer/etc/getUplsNwcs.req` - Get UPlus network wiring status
24. `/customer/etc/getUplsEqipInfo.req` - Get UPlus equipment info
25. `/customer/etc/getUplsEqipPortInfo.req` - Get UPlus equipment port info
26. `/customer/etc/setUplsRqstConsReq.req` - Set UPlus request construction
27. `/customer/etc/getLguMangReq.req` - Get LGU network request
28. `/customer/etc/saveLguMangReq.req` - Save LGU network request
29. `/customer/etc/getCertifyCL02.req` - Get FTTH port status
30. `/customer/etc/getUplsLdapHist.req` - Get UPlus LDAP history

### Customer & Consultation APIs
31. `customer/negociation/getCallHistory.req` - Get call history
32. `customer/sigtrans/getENSSendHist.req` - Get ENS send history
33. `customer/negociation/getCustCntBySearchCust.req` - Get customer count by search
34. `customer/common/customercommon/getConditionalCustList2.req` - Get conditional customer list
35. `customer/negociation/getCustomerCtrtEquipInfo.req` - Get customer contract equipment info
36. `customer/negociation/insertRcptProcInfo.req` - Insert receipt process info

### Promotional & Billing APIs
37. `/customer/work/getWorkAlarmInfo.req` - Get work alarm info
38. `/customer/work/getVod6MonUseDate.req` - Get VOD 6-month use date
39. `/customer/etc/getSpecialCust4VOD5K.req` - Get special customer for VOD 5K
40. `/customer/customer/general/customerChgInfo.req` - Customer change info
41. `customer/negociation/getHotbillDtl.req` - Get hotbill detail
42. `customer/negociation/getHotbillDtlbyCtrt.req` - Get hotbill detail by contract
43. `customer/negociation/getHotbillDtlbyCharge.req` - Get hotbill detail by charge
44. `customer/receipt/calcHotbillSumul.req` - Calculate hotbill sum

### Suspension & OTT APIs
45. `/customer/etc/getMmtSusInfo.req` - Get temporary suspension info
46. `/customer/etc/modMmtSusInfo.req` - Modify temporary suspension info
47. `/customer/work/getOttSale.req` - Get OTT sale
48. `/customer/work/getOttSerno.req` - Get OTT serial number
49. `/customer/work/saveOttSale.req` - Save OTT sale
50. `/customer/work/getOttType.req` - Get OTT type

### Electronic Contract APIs
51. `customer/customer/general/getSignContratInfo.req` - Get sign contract info
52. `customer/customer/general/saveSignContract.req` - Save sign contract
53. `/customer/work/getCheckCtrtStdDoc.req` - Get check contract standard document
54. `/customer/work/getCtrtStdDoc.req` - Get contract standard document
55. `/customer/customer/general/getEleImgCheck.req` - Get electronic image check

### Signal Integration History APIs
56. `customer/sigtrans/getLghvSendHist.req` - Get LG HelloVision send history
57. `customer/etc/getCertifyApiHist.req` - Get certify API history
58. `customer/sigtrans/getSendHistory.req` - Get send history

### Worker Management APIs
59. `system/cm/getFindUsrList.req` - Find user list

### Work Cancellation APIs
60. `/customer/etc/modOstWorkCancel.req` - Modify OST work cancel

---

## Technical Considerations

### Mobile-Specific Requirements

1. **Barcode Scanner Integration**
   - Uses ActiveX (needs mobile alternative)
   - Consider using device camera API
   - QR code support may be needed

2. **Photo Upload**
   - Restrict to camera only (no gallery)
   - Image compression before upload
   - Server storage path management

3. **Map Integration**
   - Choose map provider (Naver, Kakao, Google)
   - Route optimization algorithm
   - Real-time distance calculation

4. **Offline Capability**
   - Consider offline work mode
   - Sync when connection restored

5. **Session Management**
   - Maintain session across multiple screens
   - Handle app backgrounding
   - Auto-logout timeout

### Security Requirements

1. **OTP Integration**
   - Mobile OTP on login
   - Secure token storage

2. **Screenshot Prevention**
   - Evaluate technical feasibility
   - Alternative: Watermarking

3. **Data Encryption**
   - Sensitive customer data
   - Payment information
   - Contract documents

### Performance Considerations

1. **API Response Caching**
   - Code lookup data
   - Worker information
   - Equipment lists

2. **Image Optimization**
   - Compress before upload
   - Thumbnail generation

3. **Map Performance**
   - Marker clustering
   - Lazy loading

---

## Implementation Priorities

### Phase 1: Core Work Management
1. Safety Inspection
2. Work Inquiry with Map
3. Work Detail View
4. Worker Adjustment
5. Basic Work Completion

### Phase 2: Equipment Management
1. Equipment Installation
2. Equipment Configuration
3. Barcode Scanner Integration
4. Equipment Status Check

### Phase 3: Advanced Features
1. Wiring Inquiry (LGU/FTTH)
2. Signal Integration
3. Electronic Contract
4. OTT Management

### Phase 4: Integrations
1. LGU API Integration
2. FMS Integration
3. Payment Gateway Integration
4. Authentication Services

---

## Differences from Current Implementation

Based on the menu structure comparison:

### Features to Add
1. **안전점검** (Safety Inspection) - Completely new
2. Map-based work location display
3. Route optimization
4. Barcode scanner for equipment
5. Photo upload (camera only)

### Features to Remove/Relocate
From Receipt Detail (접수상세조회):
- 자동이체등록 → Move to Customer Management
- 청구매체등록 → Move to Customer Management
- 사은품접수봇 등록 → Move to Work Automation
- 부가가입봇 등록 → Move to Work Automation
- 상담등록 → Move to Customer Management
- 전화번호변경 → Move to Customer Management

### Features to Simplify
1. Streamline work completion process
2. Reduce manual data entry
3. Automate signal integration where possible

---

## Recommendations

### For UI/UX
1. **Use Navigation Method** for session management
   - More natural for mobile apps
   - Better user experience
   - Easier to implement

2. **Implement Dynamic Screens**
   - More flexible for API changes
   - Better adaptability
   - Future-proof

3. **Prioritize Map View**
   - Essential for route optimization
   - Key differentiator from desktop
   - Improves efficiency

### For Business Logic
1. **Make Safety Inspection Mandatory**
   - Block work processing if not completed
   - Add reminder notifications

2. **Simplify Work Completion**
   - Reduce steps where possible
   - Pre-fill data from previous steps
   - Validate early and often

3. **Optimize Equipment Selection**
   - Barcode scanning as primary method
   - Manual entry as fallback
   - Auto-suggest based on work type

### For Technical Implementation
1. **Choose Kakao or Naver Maps**
   - Better Korea coverage
   - More affordable
   - Better API support

2. **Implement Progressive Photo Upload**
   - Compress before upload
   - Show progress indicator
   - Allow retry on failure

3. **Add Offline Support for Safety Inspection**
   - Allow completion without connection
   - Sync when online
   - Store locally until synced

---

## Conclusion

The D-Live mobile application for work management requires a comprehensive implementation covering:

1. **Core Work Flow**: Safety inspection → Work inquiry → Work processing → Completion
2. **Equipment Management**: Installation, configuration, status checking
3. **LGU/FTTH Integration**: LDAP, wiring, signal integration
4. **Mobile-Specific Features**: Maps, barcode, photo upload, route optimization
5. **Business Logic**: Mandatory safety checks, work assignment, completion validation

The application should prioritize mobile-first design with offline capability, efficient workflows, and seamless integration with existing backend systems.

**Key Success Factors:**
- Mandatory safety inspection enforcement
- Intuitive map-based work navigation
- Streamlined equipment management
- Robust error handling
- Clear user feedback
- Offline capability for critical functions

**Technical Stack Recommendations:**
- React Native or similar for cross-platform
- Kakao or Naver Maps API
- Native camera integration
- Secure local storage for offline data
- JWT or similar for authentication
- WebSocket for real-time updates (optional)
