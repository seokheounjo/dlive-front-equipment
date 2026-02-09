#!/bin/bash

# ?꾨즺???묒뾽??getTechnicianEquipments API ?묐떟 ?뺤씤 ?ㅽ겕由쏀듃
# ?묒뾽?꾨즺 ?뺣낫(怨좉컼愿怨? ?ㅼ튂?꾩튂, 留앷뎄遺???媛 ?ы븿?섏뼱 ?덈뒗吏 ?뺤씤

echo "=========================================="
echo "?꾨즺???묒뾽 API ?묐떟 援ъ“ ?뺤씤"
echo "=========================================="
echo ""

# ?좑툘 ?ш린???ㅼ젣 ?꾨즺???묒뾽 ?뺣낫瑜??낅젰?섏꽭??
WORK_ID="YOUR_COMPLETED_WORK_ID"        # ?꾨즺???묒뾽 ID
CTRT_ID="YOUR_CONTRACT_ID"              # 怨꾩빟 ID
CUST_ID="YOUR_CUSTOMER_ID"              # 怨좉컼 ID
WRKR_ID="A20130708"                     # 湲곗궗 ID (?뚯뒪?몄슜)
SO_ID="YOUR_SO_ID"                      # 吏??ID
WRK_CD="01"                             # ?묒뾽 肄붾뱶 (?? 01=?좉퇋?ㅼ튂)
WRK_STAT_CD="4"                         # ?묒뾽 ?곹깭 (4=?꾨즺)
PROD_CD="YOUR_PROD_CD"                  # ?곹뭹 肄붾뱶

# API Base URL - EC2 ?쒕쾭
API_BASE="http://52.63.232.141/api"
ORIGIN="http://52.63.232.141"

echo "?뱥 ?붿껌 ?뺣낫:"
echo "  - WORK_ID: $WORK_ID"
echo "  - CTRT_ID: $CTRT_ID"
echo "  - WRK_STAT_CD: $WRK_STAT_CD (4=?꾨즺)"
echo ""

# JSON ?붿껌 ?곗씠??
REQUEST_JSON=$(cat <<EOF
{
  "WRKR_ID": "$WRKR_ID",
  "SO_ID": "$SO_ID",
  "WORK_ID": "$WORK_ID",
  "CUST_ID": "$CUST_ID",
  "CTRT_ID": "$CTRT_ID",
  "WRK_CD": "$WRK_CD",
  "WRK_STAT_CD": "$WRK_STAT_CD",
  "PROD_CD": "$PROD_CD",
  "EQT_SEL": "0",
  "EQT_CL": "ALL"
}
EOF
)

echo "?뱾 ?붿껌 ?곗씠??"
echo "$REQUEST_JSON" | jq '.'
echo ""

echo "?? API ?몄텧 以?.."
echo ""

# API ?몄텧
RESPONSE=$(curl -s -X POST \
  "${API_BASE}/customer/work/getCustProdInfo" \
  -H "Content-Type: application/json" \
  -H "Origin: ${ORIGIN}" \
  --cookie-jar cookies.txt \
  --cookie cookies.txt \
  -d "$REQUEST_JSON")

echo "=========================================="
echo "?뱿 API ?묐떟:"
echo "=========================================="
echo ""

# ?묐떟???덉걯寃?異쒕젰
echo "$RESPONSE" | jq '.'

echo ""
echo "=========================================="
echo "?뵇 二쇱슂 ?뺤씤 ?ы빆:"
echo "=========================================="
echo ""

# ?묒뾽?꾨즺 愿???꾨뱶媛 ?덈뒗吏 ?뺤씤
echo "1. ?묒뾽?꾨즺 湲곕낯 ?뺣낫 ?뺤씤:"
echo "$RESPONSE" | jq 'if has("workCompleteInfo") then "??workCompleteInfo 議댁옱" else "??workCompleteInfo ?놁쓬" end'
echo "$RESPONSE" | jq 'if has("CUST_REL") then "??CUST_REL (怨좉컼愿怨? 議댁옱: " + .CUST_REL else "??CUST_REL ?놁쓬" end'
echo "$RESPONSE" | jq 'if has("INSTL_LOC") then "??INSTL_LOC (?ㅼ튂?꾩튂) 議댁옱: " + .INSTL_LOC else "??INSTL_LOC ?놁쓬" end'
echo "$RESPONSE" | jq 'if has("UP_CTRL_CL") then "??UP_CTRL_CL (?곹뼢?쒖뼱) 議댁옱: " + .UP_CTRL_CL else "??UP_CTRL_CL ?놁쓬" end'
echo ""

echo "2. ?ㅼ튂?뺣낫 ?뺤씤:"
echo "$RESPONSE" | jq 'if has("installInfo") then "??installInfo 議댁옱" else "??installInfo ?놁쓬" end'
echo "$RESPONSE" | jq 'if .installInfo.NET_CL then "??NET_CL (留앷뎄遺? 議댁옱: " + .installInfo.NET_CL else "??NET_CL ?놁쓬" end'
echo "$RESPONSE" | jq 'if .installInfo.NET_CL_NM then "??NET_CL_NM (留앷뎄遺꾨챸) 議댁옱: " + .installInfo.NET_CL_NM else "??NET_CL_NM ?놁쓬" end'
echo "$RESPONSE" | jq 'if .installInfo.INSTL_TP then "??INSTL_TP (?ㅼ튂?좏삎) 議댁옱: " + .installInfo.INSTL_TP else "??INSTL_TP ?놁쓬" end'
echo ""

echo "3. ?쒕퉬???댁슜援щ텇 ?뺤씤:"
echo "$RESPONSE" | jq 'if has("INTERNET_USE") then "??INTERNET_USE 議댁옱: " + .INTERNET_USE else "??INTERNET_USE ?놁쓬" end'
echo "$RESPONSE" | jq 'if has("VOIP_USE") then "??VOIP_USE 議댁옱: " + .VOIP_USE else "??VOIP_USE ?놁쓬" end'
echo "$RESPONSE" | jq 'if has("DTV_USE") then "??DTV_USE 議댁옱: " + .DTV_USE else "??DTV_USE ?놁쓬" end'
echo ""

echo "4. ?λ퉬 ?뺣낫 ?뺤씤:"
echo "$RESPONSE" | jq 'if .contractEquipments then "??contractEquipments: " + (.contractEquipments | length | tostring) + "媛? else "??contractEquipments ?놁쓬" end'
echo "$RESPONSE" | jq 'if .technicianEquipments then "??technicianEquipments: " + (.technicianEquipments | length | tostring) + "媛? else "??technicianEquipments ?놁쓬" end'
echo "$RESPONSE" | jq 'if .customerEquipments then "??customerEquipments: " + (.customerEquipments | length | tostring) + "媛? else "??customerEquipments ?놁쓬" end'
echo "$RESPONSE" | jq 'if .removedEquipments then "??removedEquipments: " + (.removedEquipments | length | tostring) + "媛? else "??removedEquipments ?놁쓬" end'
echo ""

echo "=========================================="
echo "?뮕 寃곕줎:"
echo "=========================================="
echo ""
echo "??寃곌낵瑜?蹂닿퀬 ?ㅼ쓬???뺤씤?섏꽭??"
echo ""
echo "???묒뾽?꾨즺 ?뺣낫媛 ?ы븿?섏뼱 ?덈떎硫?"
echo "   ??諛⑸쾿 1 吏꾪뻾: WorkCompleteForm?먯꽌 ??API ?묐떟???쒖슜"
echo ""
echo "???묒뾽?꾨즺 ?뺣낫媛 ?녿떎硫?"
echo "   ??諛⑸쾿 2 吏꾪뻾: 蹂꾨룄 getWorkCompleteInfo API ?꾩슂"
echo ""
echo "=========================================="

# ?묐떟???뚯씪濡????
echo "$RESPONSE" > completed_work_response.json
echo "?뱚 ?꾩껜 ?묐떟??completed_work_response.json????λ릺?덉뒿?덈떎."
echo ""
