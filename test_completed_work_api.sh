#!/bin/bash

# 완료된 작업의 getTechnicianEquipments API 응답 확인 스크립트
# 작업완료 정보(고객관계, 설치위치, 망구분 등)가 포함되어 있는지 확인

echo "=========================================="
echo "완료된 작업 API 응답 구조 확인"
echo "=========================================="
echo ""

# ⚠️ 여기에 실제 완료된 작업 정보를 입력하세요
WORK_ID="YOUR_COMPLETED_WORK_ID"        # 완료된 작업 ID
CTRT_ID="YOUR_CONTRACT_ID"              # 계약 ID
CUST_ID="YOUR_CUSTOMER_ID"              # 고객 ID
WRKR_ID="A20130708"                     # 기사 ID (테스트용)
SO_ID="YOUR_SO_ID"                      # 지점 ID
WRK_CD="01"                             # 작업 코드 (예: 01=신규설치)
WRK_STAT_CD="4"                         # 작업 상태 (4=완료)
PROD_CD="YOUR_PROD_CD"                  # 상품 코드

# API Base URL - EC2 서버
API_BASE="http://52.63.131.157/api"
ORIGIN="http://52.63.131.157"

echo "📋 요청 정보:"
echo "  - WORK_ID: $WORK_ID"
echo "  - CTRT_ID: $CTRT_ID"
echo "  - WRK_STAT_CD: $WRK_STAT_CD (4=완료)"
echo ""

# JSON 요청 데이터
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

echo "📤 요청 데이터:"
echo "$REQUEST_JSON" | jq '.'
echo ""

echo "🚀 API 호출 중..."
echo ""

# API 호출
RESPONSE=$(curl -s -X POST \
  "${API_BASE}/customer/work/getCustProdInfo" \
  -H "Content-Type: application/json" \
  -H "Origin: ${ORIGIN}" \
  --cookie-jar cookies.txt \
  --cookie cookies.txt \
  -d "$REQUEST_JSON")

echo "=========================================="
echo "📥 API 응답:"
echo "=========================================="
echo ""

# 응답을 예쁘게 출력
echo "$RESPONSE" | jq '.'

echo ""
echo "=========================================="
echo "🔍 주요 확인 사항:"
echo "=========================================="
echo ""

# 작업완료 관련 필드가 있는지 확인
echo "1. 작업완료 기본 정보 확인:"
echo "$RESPONSE" | jq 'if has("workCompleteInfo") then "✅ workCompleteInfo 존재" else "❌ workCompleteInfo 없음" end'
echo "$RESPONSE" | jq 'if has("CUST_REL") then "✅ CUST_REL (고객관계) 존재: " + .CUST_REL else "❌ CUST_REL 없음" end'
echo "$RESPONSE" | jq 'if has("INSTL_LOC") then "✅ INSTL_LOC (설치위치) 존재: " + .INSTL_LOC else "❌ INSTL_LOC 없음" end'
echo "$RESPONSE" | jq 'if has("UP_CTRL_CL") then "✅ UP_CTRL_CL (상향제어) 존재: " + .UP_CTRL_CL else "❌ UP_CTRL_CL 없음" end'
echo ""

echo "2. 설치정보 확인:"
echo "$RESPONSE" | jq 'if has("installInfo") then "✅ installInfo 존재" else "❌ installInfo 없음" end'
echo "$RESPONSE" | jq 'if .installInfo.NET_CL then "✅ NET_CL (망구분) 존재: " + .installInfo.NET_CL else "❌ NET_CL 없음" end'
echo "$RESPONSE" | jq 'if .installInfo.NET_CL_NM then "✅ NET_CL_NM (망구분명) 존재: " + .installInfo.NET_CL_NM else "❌ NET_CL_NM 없음" end'
echo "$RESPONSE" | jq 'if .installInfo.INSTL_TP then "✅ INSTL_TP (설치유형) 존재: " + .installInfo.INSTL_TP else "❌ INSTL_TP 없음" end'
echo ""

echo "3. 서비스 이용구분 확인:"
echo "$RESPONSE" | jq 'if has("INTERNET_USE") then "✅ INTERNET_USE 존재: " + .INTERNET_USE else "❌ INTERNET_USE 없음" end'
echo "$RESPONSE" | jq 'if has("VOIP_USE") then "✅ VOIP_USE 존재: " + .VOIP_USE else "❌ VOIP_USE 없음" end'
echo "$RESPONSE" | jq 'if has("DTV_USE") then "✅ DTV_USE 존재: " + .DTV_USE else "❌ DTV_USE 없음" end'
echo ""

echo "4. 장비 정보 확인:"
echo "$RESPONSE" | jq 'if .contractEquipments then "✅ contractEquipments: " + (.contractEquipments | length | tostring) + "개" else "❌ contractEquipments 없음" end'
echo "$RESPONSE" | jq 'if .technicianEquipments then "✅ technicianEquipments: " + (.technicianEquipments | length | tostring) + "개" else "❌ technicianEquipments 없음" end'
echo "$RESPONSE" | jq 'if .customerEquipments then "✅ customerEquipments: " + (.customerEquipments | length | tostring) + "개" else "❌ customerEquipments 없음" end'
echo "$RESPONSE" | jq 'if .removedEquipments then "✅ removedEquipments: " + (.removedEquipments | length | tostring) + "개" else "❌ removedEquipments 없음" end'
echo ""

echo "=========================================="
echo "💡 결론:"
echo "=========================================="
echo ""
echo "위 결과를 보고 다음을 확인하세요:"
echo ""
echo "✅ 작업완료 정보가 포함되어 있다면:"
echo "   → 방법 1 진행: WorkCompleteForm에서 이 API 응답을 활용"
echo ""
echo "❌ 작업완료 정보가 없다면:"
echo "   → 방법 2 진행: 별도 getWorkCompleteInfo API 필요"
echo ""
echo "=========================================="

# 응답을 파일로 저장
echo "$RESPONSE" > completed_work_response.json
echo "📁 전체 응답이 completed_work_response.json에 저장되었습니다."
echo ""
