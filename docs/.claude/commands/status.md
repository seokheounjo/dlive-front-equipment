---
description: ?꾨줈?앺듃 ?꾩옱 ?곹깭 諛?吏꾪뻾?ы빆 ?뺤씤
---

# ?꾨줈?앺듃 ?곹깭 ?뺤씤

D-Live ?λ퉬愿由??쒖뒪?쒖쓽 ?꾩옱 吏꾪뻾 ?곹깭瑜??뺤씤?⑸땲??

## ?뺤씤 ??ぉ

1. **Git ?곹깭**
   ```bash
   # ?꾩옱 釉뚮옖移?
   git branch

   # 蹂寃쎌궗???뺤씤
   git status

   # 理쒓렐 而ㅻ컠
   git log --oneline -10

   # ?먭꺽 釉뚮옖移섏? 鍮꾧탳
   git fetch teamart
   git log HEAD..teamart/main --oneline
   ```

2. **濡쒖뺄 媛쒕컻 ?섍꼍**
   ```bash
   # Frontend 媛쒕컻 ?쒕쾭
   ps aux | grep vite
   # ???ㅽ뻾 以? ??/ 以묒?: ??

   # API ?꾨줉???쒕쾭
   ps aux | grep api-proxy
   # ???ㅽ뻾 以? ??/ 以묒?: ??

   # ?ы듃 ?ъ슜 ?뺤씤
   lsof -i :3000  # Frontend
   lsof -i :8080  # API Proxy
   ```

3. **?λ퉬愿由?湲곕뒫 吏꾪뻾 ?곹깭**

   | ID | 湲곕뒫紐?| ?뚯씪 | API | ?곹깭 | ?대떦??|
   |----|--------|------|-----|------|--------|
   | EM-010 | ?λ퉬 ?대젰 議고쉶 | EquipmentStatusView.tsx | getEquipmentHistoryInfo | ???꾨즺 | 議곗꽍??|
   | EM-004 | 湲곗궗 蹂댁쑀?λ퉬 議고쉶 | EquipmentAssignment.tsx | getEquipmentOutList (3媛? | ?봽 吏꾪뻾以?| 議곗꽍??|
   | EM-011 | ?λ퉬 ?묒뾽???닿? | EquipmentTransfer.tsx | changeEqtWrkr_3 | ?봽 怨꾪쉷 | 議곗꽍??|
   | EM-015 | 誘명쉶???λ퉬 議고쉶 | EquipmentRecovery.tsx | getEquipLossInfo | ?봽 吏꾪뻾以?| 議곗꽍??|

4. **而댄룷?뚰듃蹂?TODO ?뺤씤**

   ```bash
   # TODO 二쇱꽍 寃??
   grep -r "TODO" mobile-cona-front/components/*.tsx | grep -v node_modules

   # API ?곕룞 ?꾩슂??遺遺?
   grep -r "TODO: API ?곕룞" mobile-cona-front/components/*.tsx
   ```

5. **EC2 ?쒕쾭 ?곹깭** (SSH ?묒냽 媛????

   ```bash
   # SSH ?묒냽
   ssh ubuntu@52.63.232.141

   # PM2 ?곹깭
   pm2 status

   # 理쒓렐 諛고룷 而ㅻ컠
   cd /home/ubuntu/dlive-cona-client
   git log --oneline -5

   # 濡쒓렇 ?뺤씤
   pm2 logs dlive --lines 20
   ```

6. **鍮뚮뱶 ?곹깭**

   ```bash
   # TypeScript ???泥댄겕
   npm run type-check

   # 鍮뚮뱶 ?뚯뒪??
   npm run build

   # Lint 寃??
   npm run lint
   ```

## 異쒕젰 ?뺤떇

```
?뱤 D-Live ?꾨줈?앺듃 ?꾩옱 ?곹깭

?뵩 Git ?곹깭
- Current Branch: jsh/equipment-assignment
- Behind Main: 0 commits
- Uncommitted Changes: 2 files
- Last Commit: abc1234 "feat: ?λ퉬 ?좊떦 UI ?꾩꽦"

?뮲 濡쒖뺄 ?섍꼍
- Frontend Dev Server: ??Running (PID: 12345)
- API Proxy Server: ??Running (PID: 67890)
- Port 3000: ??LISTEN
- Port 8080: ??Not in use

?뱥 ?λ퉬愿由?湲곕뒫 (Phase 1)
- ??EM-010: ?λ퉬 ?대젰 議고쉶 (100% ?꾨즺)
- ?봽 EM-004: 湲곗궗 蹂댁쑀?λ퉬 議고쉶 (70% - UI ?꾩꽦, API 3媛??꾩슂)
- ?봽 EM-011: ?λ퉬 ?묒뾽???닿? (30% - 湲고쉷 ?꾨즺)
- ?봽 EM-015: 誘명쉶???λ퉬 議고쉶 (50% - UI ?꾩꽦, API 1媛??꾩슂)

?뱷 TODO ??ぉ
- [ ] EquipmentAssignment.tsx: 3媛?API ?곕룞 (?쇱씤 97, 103, 108)
- [ ] EquipmentRecovery.tsx: 1媛?API ?곕룞 (?쇱씤 50)
- [ ] EquipmentTransfer.tsx: 1媛?API + 紐⑤떖 (?쇱씤 96)

?? EC2 諛고룷 ?곹깭
- PM2 Status: online
- Last Deploy: 2025-01-28 10:30:00
- Deployed Commit: xyz7890 "feat: ?λ퉬 ?곹깭 議고쉶 ?꾩꽦"
- Uptime: 2h 30m

?뵪 鍮뚮뱶 ?곹깭
- TypeScript: ??No errors
- Build: ??Success (dist/ ?앹꽦??
- Lint: ?좑툘 3 warnings

?렞 ?ㅼ쓬 ?묒뾽 ?곗꽑?쒖쐞
1. EM-004: getEquipmentOutList API ?곕룞 (?덉긽: 2?쒓컙)
2. EM-015: getEquipLossInfo API ?곕룞 (?덉긽: 1?쒓컙)
3. EM-011: ?λ퉬 ?닿? 湲곕뒫 援ы쁽 (?덉긽: 3?쒓컙)

?뱤 ?꾩껜 吏꾪뻾瑜? 35% (1/4 ?꾨즺)
```

## ?먮룞 ?곹깭 泥댄겕 ?ㅽ겕由쏀듃

```bash
#!/bin/bash
# check-status.sh

echo "?뱤 D-Live ?꾨줈?앺듃 ?곹깭 泥댄겕"
echo "================================"

# Git ?곹깭
echo ""
echo "?뵩 Git ?곹깭:"
echo "- Current Branch: $(git branch --show-current)"
echo "- Uncommitted Files: $(git status --short | wc -l)"

# ?꾨줈?몄뒪 ?뺤씤
echo ""
echo "?뮲 濡쒖뺄 ?섍꼍:"
if pgrep -f "vite" > /dev/null; then
  echo "- Frontend Dev Server: ??Running"
else
  echo "- Frontend Dev Server: ??Stopped"
fi

if pgrep -f "api-proxy" > /dev/null; then
  echo "- API Proxy Server: ??Running"
else
  echo "- API Proxy Server: ??Stopped"
fi

# TODO 移댁슫??
echo ""
echo "?뱷 TODO ??ぉ:"
TODO_COUNT=$(grep -r "TODO" mobile-cona-front/components/*.tsx 2>/dev/null | wc -l)
echo "- Total TODOs: $TODO_COUNT"

# 鍮뚮뱶 ?뚯뒪??
echo ""
echo "?뵪 鍮뚮뱶 ?곹깭:"
if npm run type-check > /dev/null 2>&1; then
  echo "- TypeScript: ??No errors"
else
  echo "- TypeScript: ??Errors found"
fi

echo ""
echo "???곹깭 泥댄겕 ?꾨즺"
```

## ?곸꽭 ?뺣낫 ?뺤씤

?꾩슂 ???ㅼ쓬 紐낅졊?대줈 ?곸꽭 ?뺣낫 ?뺤씤:

```bash
# ?뱀젙 湲곕뒫 ?곹깭
/analyze-api /customer/equipment/getEquipmentOutList

# ?뚯뒪???ㅽ뻾
/test-equipment EM-004

# 諛고룷 以鍮??뺤씤
/deploy --check

# 臾몄꽌 ?뺤씤
cat COMPREHENSIVE_GUIDE.md | grep "EM-004" -A 20
```

## 二쇱쓽?ы빆

- EC2 ?쒕쾭 ?곹깭??SSH ?묒냽 ?꾩슂
- TODO 移댁슫?몃뒗 肄붾뱶 二쇱꽍 湲곕컲
- 吏꾪뻾瑜좎? ?섎룞 ?낅뜲?댄듃 ?꾩슂
- ?ㅼ떆媛??곹깭??`watch`紐낅졊???ъ슜:
  ```bash
  watch -n 5 'pm2 status'
  ```
