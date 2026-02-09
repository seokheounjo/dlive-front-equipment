# ?꾨즺???묒뾽 API ?뚯뒪??媛?대뱶

## ?뱥 諛⑸쾿 1: ?ㅽ겕由쏀듃 ?ㅽ뻾

### 1. ?ㅽ겕由쏀듃 ?뚯씪 ?섏젙
`test_completed_work_api.sh` ?뚯씪???댁뼱???ㅼ쓬 蹂?섎뱾???ㅼ젣 媛믪쑝濡?蹂寃쏀븯?몄슂:

```bash
WORK_ID="YOUR_COMPLETED_WORK_ID"    # ?꾨즺???묒뾽 ID
CTRT_ID="YOUR_CONTRACT_ID"          # 怨꾩빟 ID
CUST_ID="YOUR_CUSTOMER_ID"          # 怨좉컼 ID
SO_ID="YOUR_SO_ID"                  # 吏??ID
PROD_CD="YOUR_PROD_CD"              # ?곹뭹 肄붾뱶
```

### 2. ?ㅽ겕由쏀듃 ?ㅽ뻾
```bash
cd /Users/hanseungsu/Desktop/poby/?쒕씪?대툕/dlive-json-api/mobile-cona-front
./test_completed_work_api.sh
```

---

## ?뱥 諛⑸쾿 2: 吏곸젒 curl 紐낅졊???ㅽ뻾

### 湲곕낯 ?쒗뵆由?(EC2 ?쒕쾭)
```bash
curl -X POST 'http://52.63.232.141/api/customer/work/getCustProdInfo' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://52.63.232.141' \
  --cookie-jar cookies.txt \
  --cookie cookies.txt \
  -d '{
    "WRKR_ID": "A20130708",
    "SO_ID": "YOUR_SO_ID",
    "WORK_ID": "YOUR_COMPLETED_WORK_ID",
    "CUST_ID": "YOUR_CUSTOMER_ID",
    "CTRT_ID": "YOUR_CONTRACT_ID",
    "WRK_CD": "01",
    "WRK_STAT_CD": "4",
    "PROD_CD": "YOUR_PROD_CD",
    "EQT_SEL": "0",
    "EQT_CL": "ALL"
  }' | jq '.'
```

### ?덉떆 (?ㅼ젣 ?곗씠?곕줈 蹂寃??꾩슂)
```bash
curl -X POST 'http://52.63.232.141/api/customer/work/getCustProdInfo' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://52.63.232.141' \
  -d '{
    "WRKR_ID": "A20130708",
    "SO_ID": "S001",
    "WORK_ID": "W202501150001",
    "CUST_ID": "C001",
    "CTRT_ID": "CTRT001",
    "WRK_CD": "01",
    "WRK_STAT_CD": "4",
    "PROD_CD": "P001",
    "EQT_SEL": "0",
    "EQT_CL": "ALL"
  }' | jq '.'
```

---

## ?뵇 ?뺤씤????ぉ

?묐떟?먯꽌 ?ㅼ쓬 ?꾨뱶?ㅼ씠 ?덈뒗吏 ?뺤씤:

### 1. ?묒뾽?꾨즺 湲곕낯 ?뺣낫
- ??`CUST_REL` - 怨좉컼愿怨?
- ??`INSTL_LOC` - ?ㅼ튂?꾩튂
- ??`UP_CTRL_CL` - ?곹뼢?쒖뼱
- ??`MEMO` - ?묒뾽鍮꾧퀬

### 2. ?ㅼ튂?뺣낫
- ??`installInfo` 媛앹껜
  - `NET_CL` - 留앷뎄遺?肄붾뱶
  - `NET_CL_NM` - 留앷뎄遺??대쫫
  - `INSTL_TP` - ?ㅼ튂?좏삎
  - `WRNG_TP` - 諛곗꽑?좏삎
  - 湲고? ?ㅼ튂?뺣낫 ?꾨뱶??..

### 3. ?쒕퉬???댁슜援щ텇
- ??`INTERNET_USE` - ?명꽣???댁슜
- ??`VOIP_USE` - VoIP ?댁슜
- ??`DTV_USE` - ?붿??몃갑???댁슜

### 4. ?λ퉬 ?뺣낫 (?대? ?뺤씤??
- ??`contractEquipments` (output2)
- ??`technicianEquipments` (output3)
- ??`customerEquipments` (output4) ???대? ?ъ슜 以?
- ??`removedEquipments` (output5)

---

## ?뱤 ?묐떟 ?덉떆 (?덉긽)

### 留뚯빟 ?묒뾽?꾨즺 ?뺣낫媛 ?ы븿?섏뼱 ?덈떎硫?
```json
{
  "contractEquipments": [...],
  "technicianEquipments": [...],
  "customerEquipments": [...],
  "removedEquipments": [...],
  "kpiProdGrpCd": "V",
  "prodGrp": "V",
  "workCompleteInfo": {
    "CUST_REL": "10",
    "INSTL_LOC": "嫄곗떎",
    "UP_CTRL_CL": "Y",
    "MEMO": "?뺤긽 ?ㅼ튂 ?꾨즺",
    "INTERNET_USE": "Y",
    "VOIP_USE": "N",
    "DTV_USE": "Y"
  },
  "installInfo": {
    "NET_CL": "01",
    "NET_CL_NM": "HFC",
    "INSTL_TP": "10",
    "WRNG_TP": "20",
    ...
  }
}
```

### 留뚯빟 ?묒뾽?꾨즺 ?뺣낫媛 ?녿떎硫?
```json
{
  "contractEquipments": [...],
  "technicianEquipments": [...],
  "customerEquipments": [...],
  "removedEquipments": [...],
  "kpiProdGrpCd": "V",
  "prodGrp": "V"
  // workCompleteInfo ?놁쓬
  // installInfo ?놁쓬
}
```

---

## ?뮕 ?ㅼ쓬 ?④퀎

### ???묒뾽?꾨즺 ?뺣낫媛 ?ы븿?섏뼱 ?덈떎硫?
??**諛⑸쾿 1 吏꾪뻾**: `WorkCompleteForm`?먯꽌 `getTechnicianEquipments` API ?묐떟 ?쒖슜

### ???묒뾽?꾨즺 ?뺣낫媛 ?녿떎硫?
??**諛⑸쾿 2 吏꾪뻾**: 蹂꾨룄 `getWorkCompleteInfo` API 援ы쁽 ?꾩슂

---

## ?썱截?釉뚮씪?곗? 媛쒕컻???꾧뎄濡??뺤씤?섍린

1. ?꾨즺???묒뾽 ?곸꽭 ?섏씠吏 ?묒냽
2. F12 ??Network ???닿린
3. `/customer/work/getCustProdInfo` ?붿껌 李얘린
4. Response ??뿉???묐떟 ?곗씠???뺤씤

---

## ?뱷 ?뚯뒪??寃곌낵 湲곕줉

?뚯뒪???????뱀뀡??寃곌낵瑜?湲곕줉?섏꽭??

```
?뚯뒪???쇱떆:
?묒뾽 ID:
?묒뾽 ?곹깭: ?꾨즺 (WRK_STAT_CD=4)

寃곌낵:
[ ] workCompleteInfo ?덉쓬
[ ] installInfo ?덉쓬
[ ] CUST_REL ?덉쓬
[ ] NET_CL ?덉쓬
[ ] ?쒕퉬???댁슜援щ텇 ?덉쓬

寃곕줎:
[ ] 諛⑸쾿 1 吏꾪뻾 媛??
[ ] 諛⑸쾿 2 ?꾩슂
```
