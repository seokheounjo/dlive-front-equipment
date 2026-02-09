# ?럦 D-Live ?꾨줈?앺듃 ?꾩쟾 ?ㅼ젙 ?꾨즺

## ???꾨즺??紐⑤뱺 ?묒뾽

### 1. ?뱲 醫낇빀 臾몄꽌 (COMPREHENSIVE_GUIDE.md)

**?꾩튂**: `/Users/bottle/bottle1/delive/dlive-json-api/COMPREHENSIVE_GUIDE.md`

**?댁슜** (15,000+ 以?:
- ?쒖뒪???꾪궎?띿쿂 (3怨꾩링 援ъ“)
- 湲곗닠 ?ㅽ깮 諛??쒖빟?ы빆 (Java 6, EUC-KR, iBATIS 2.x)
- ?꾨줈?앺듃 援ъ“ 諛??듭떖 ?뚯씪
- **?λ퉬愿由?* 16媛?湲곕뒫 WBS
- **?묒뾽愿由?* 54媛?湲곕뒫 WBS
- **怨좉컼愿由?* 20+ 媛?湲곕뒫 WBS
- **怨듯넻/湲고?** 30+ 媛?湲곕뒫 WBS
- API ?곕룞 媛?대뱶 (6?④퀎)
- 媛쒕컻 ?뚰겕?뚮줈??(Git, 濡쒖뺄, Demo)
- 諛고룷 ?꾨줈?몄뒪 (EC2)
- ?몃윭釉붿뒋??(8媛吏)

---

### 2. ?뵩 ?먮룞 濡쒕뱶 ?ㅼ젙 (.claude/instructions.md)

**?꾩튂**: `/Users/bottle/bottle1/delive/dlive-json-api/.claude/instructions.md`

**?뱀쭠**:
- Claude Code ?쒖옉 ???먮룞 濡쒕뱶
- Java 6 ?쒖빟?ы빆 紐낆떆
- ?듭떖 ?뚯씪 鍮좊Ⅸ 李몄“
- API 異붽? ?뚰겕?뚮줈??(5?④퀎)
- Git/諛고룷/?뚯뒪??鍮좊Ⅸ 媛?대뱶

---

### 3. ?썱截?API Explorer 而댄룷?뚰듃

**?꾩튂**: `/Users/bottle/bottle1/delive/dlive-json-api/mobile-cona-front/components/ApiExplorer.tsx`

**湲곕뒫**:
- ??**6媛?API ?붾뱶?ъ씤???꾨━??*
  - ?λ퉬愿由? getEquipmentHistoryInfo, getEquipmentOutList, getEquipmentReturnRequestList, getEquipLossInfo
  - 怨듯넻: getCodeDetail
  - ?묒뾽愿由? getTodayWorkList

- ??**?붿껌 鍮뚮뜑**
  - ?뚮씪誘명꽣 ?먮룞 ??
  - 湲곕낯媛??먮룞 ?ㅼ젙
  - ?꾩닔/?좏깮 援щ텇

- ??**?묐떟 酉곗뼱**
  - JSON ?먮룞 ?щ㎎
  - ?깃났/?ㅽ뙣 ?곹깭
  - ?묐떟 ?쒓컙 痢≪젙

- ??**?몄텧 湲곕줉**
  - localStorage ???
  - ??꾩뒪?ы봽
  - ?ы솗??媛??

- ??**?대낫?닿린**
  - JSON ?뺤떇
  - CSV ?뺤떇

---

### 4. ??而ㅼ뒪? 紐낅졊??(7媛?- 踰붿슜???꾨즺!)

**?꾩튂**: `/Users/bottle/bottle1/delive/dlive-json-api/.claude/commands/`

#### 4-1. `/analyze-api` - API 遺꾩꽍 (踰붿슜)
- 紐⑤뱺 API ?붾뱶?ъ씤??遺꾩꽍
- Legacy Server ??iBATIS ??Adapter ??Frontend ?꾩껜 媛?대뱶
- Java 6 肄붾뱶 ?쒗뵆由?
- 5?④퀎 泥댄겕由ъ뒪??

#### 4-2. `/test-equipment` - ?λ퉬愿由??뚯뒪??
- **16媛??λ퉬愿由?湲곕뒫** ?뚯뒪??
  - EM-001 ~ EM-016
  - ?λ퉬?좊떦/諛섎궔, ?λ퉬?곹깭議고쉶, 湲곗궗媛꾩씠?? 誘명쉶?섑쉶??
- API + UI ?듯빀 ?뚯뒪??
- ?먮룞???ㅽ겕由쏀듃 ?ы븿

#### 4-3. `/test-work` - ?묒뾽愿由??뚯뒪??(?좉퇋 ??
- **54媛??묒뾽愿由?湲곕뒫** ?뚯뒪??
  - WM-001 ~ WM-054
  - ?묒뾽議고쉶, ?묒뾽?곸꽭, ?묒뾽?먮낫?? ?λ퉬?ㅼ튂, 吏묒꽑, ?꾨즺泥섎━
- End-to-End ?쒕굹由ъ삤 (?묒뾽 ?쒖옉 ???꾨즺)
- LGU+ LDAP ?곕룞 ?뚯뒪??

#### 4-4. `/test-customer` - 怨좉컼愿由??뚯뒪??(?좉퇋 ??
- **20+ 媛?怨좉컼愿由?湲곕뒫** ?뚯뒪??
  - CM-001 ~ CM-016+
  - 怨좉컼議고쉶, ?대젰議고쉶, 怨꾩빟?꾪솴, 泥?뎄/寃곗젣, ?뺣낫蹂寃? ?곷떞?깅줉
- 怨좉컼 寃?????곷떞 ??AS ?묒닔 ?쒕굹由ъ삤
- ?뺣낫 蹂寃??쒕굹由ъ삤 (?꾪솕/二쇱냼/泥?뎄)

#### 4-5. `/test-common` - 怨듯넻/湲고? ?뚯뒪??(?좉퇋 ??
- **30+ 媛?怨듯넻 湲곕뒫** ?뚯뒪??
  - CO-001 ~ CO-019+
  - ?몄쬆, 怨듯넻肄붾뱶, 怨꾩빟, LGU+?곕룞, ?좏샇泥댄겕, ?곕룞?대젰, UI而댄룷?뚰듃
- 濡쒓렇????怨듯넻肄붾뱶 濡쒕뱶 ???묒뾽 議고쉶 ?쒕굹由ъ삤
- LGU+ 吏묒꽑 ?곕룞 ?대젰 ?뺤씤 ?쒕굹由ъ삤

#### 4-6. `/deploy` - EC2 諛고룷 (踰붿슜)
- 紐⑤뱺 湲곕뒫 諛고룷 吏??
- 5?④퀎 諛고룷 ?꾨줈?몄뒪
- ?먮룞 寃利?(PM2, ?ы듃, cURL, 釉뚮씪?곗?)
- 濡ㅻ갚 諛⑸쾿 3媛吏

#### 4-7. `/status` - ?꾨줈?앺듃 ?곹깭 (踰붿슜)
- **?꾩껜 ?꾨줈?앺듃 ?곹깭** ?뺤씤
  - Git ?곹깭
  - 濡쒖뺄 ?섍꼍
  - ?λ퉬愿由?(16媛?
  - ?묒뾽愿由?(54媛?
  - 怨좉컼愿由?(20+媛?
  - 怨듯넻/湲고? (30+媛?
- TODO ??ぉ ?먮룞 吏묎퀎
- EC2 諛고룷 ?곹깭
- ?ㅼ쓬 ?묒뾽 ?곗꽑?쒖쐞

---

## ?뱤 ?꾩껜 湲곕뒫 而ㅻ쾭由ъ?

| 移댄뀒怨좊━ | 湲곕뒫 ??| ?뚯뒪??紐낅졊??| ?곹깭 |
|----------|---------|---------------|------|
| **?λ퉬愿由?* | 16媛?| `/test-equipment` | ???꾨즺 |
| **?묒뾽愿由?* | 54媛?| `/test-work` | ???꾨즺 |
| **怨좉컼愿由?* | 20+媛?| `/test-customer` | ???꾨즺 |
| **怨듯넻/湲고?** | 30+媛?| `/test-common` | ???꾨즺 |
| **?⑷퀎** | **120+媛?* | **4媛?紐낅졊??* | **??100% 而ㅻ쾭** |

---

## ?? ?ъ슜 諛⑸쾿

### ?ㅻⅨ PC?먯꽌 ?묒뾽 ?쒖옉?섍린

#### 1?④퀎: ?뺤텞 ?뚯씪 ?ㅼ슫濡쒕뱶
```bash
# ?뺤텞 ?뚯씪 ?꾩튂
/tmp/dlive-project-setup.tar.gz
```

#### 2?④퀎: ?뺤텞 ?댁젣 諛??ㅼ젙
```bash
# ?뺤텞 ?댁젣
cd /Users/bottle/bottle1/delive/dlive-json-api
tar -xzf /tmp/dlive-project-setup.tar.gz

# ?뚯씪 ?뺤씤
ls -la COMPREHENSIVE_GUIDE.md
ls -la .claude/
ls -la mobile-cona-front/components/ApiExplorer.tsx
```

#### 3?④퀎: Claude Code ?쒖옉
```bash
# ?꾨줈?앺듃 ?닿린
code /Users/bottle/bottle1/delive/dlive-json-api

# .claude/instructions.md ?먮룞 濡쒕뱶??
# 利됱떆 ?묒뾽 媛??
```

---

## ?뮕 而ㅼ뒪? 紐낅졊???ъ슜 ?덉떆

### ?λ퉬愿由??묒뾽
```
/status                                    # ?꾩옱 ?곹깭 ?뺤씤
/test-equipment EM-004                     # ?λ퉬 ?좊떦 ?뚯뒪??
/analyze-api /customer/equipment/getEquipmentOutList  # API 遺꾩꽍
/deploy                                    # EC2 諛고룷
```

### ?묒뾽愿由??묒뾽
```
/status                                    # ?꾩옱 ?곹깭 ?뺤씤
/test-work WM-011                          # ?λ퉬援ъ꽦?뺣낫 議고쉶 ?뚯뒪??
/analyze-api /customer/work/getCustProdInfo  # API 遺꾩꽍
/deploy                                    # EC2 諛고룷
```

### 怨좉컼愿由??묒뾽
```
/status                                    # ?꾩옱 ?곹깭 ?뺤씤
/test-customer CM-003                      # ?곷떞?대젰 議고쉶 ?뚯뒪??
/analyze-api /customer/negociation/getCallHistory  # API 遺꾩꽍
/deploy                                    # EC2 諛고룷
```

### 怨듯넻 湲곕뒫 ?묒뾽
```
/status                                    # ?꾩옱 ?곹깭 ?뺤씤
/test-common CO-001                        # 濡쒓렇???뚯뒪??
/analyze-api /auth/login                   # API 遺꾩꽍
/deploy                                    # EC2 諛고룷
```

---

## ?뱛 ?뺤텞 ?뚯씪 ?댁슜

### ?뺤텞 ?뚯씪 援ъ“
```
dlive-project-setup.tar.gz
??
?쒋?? COMPREHENSIVE_GUIDE.md               # 醫낇빀 媛?대뱶 (15,000+ 以?
??
?쒋?? .claude/
??  ?쒋?? instructions.md                  # ?먮룞 濡쒕뱶 ?ㅼ젙
??  ?붴?? commands/
??      ?쒋?? analyze-api.md               # API 遺꾩꽍 (踰붿슜)
??      ?쒋?? test-equipment.md            # ?λ퉬愿由??뚯뒪??(16媛?
??      ?쒋?? test-work.md                 # ?묒뾽愿由??뚯뒪??(54媛? ???좉퇋
??      ?쒋?? test-customer.md             # 怨좉컼愿由??뚯뒪??(20+媛? ???좉퇋
??      ?쒋?? test-common.md               # 怨듯넻/湲고? ?뚯뒪??(30+媛? ???좉퇋
??      ?쒋?? deploy.md                    # EC2 諛고룷 (踰붿슜)
??      ?붴?? status.md                    # ?꾨줈?앺듃 ?곹깭 (踰붿슜)
??
?쒋?? mobile-cona-front/
??  ?쒋?? components/
??  ??  ?붴?? ApiExplorer.tsx              # API ?뚯뒪???꾧뎄
??  ?붴?? App.tsx                          # (?섏젙) api-explorer ?듯빀
??
?붴?? README_SETUP.md                      # ???뚯씪
```

### ?뺤텞 ?뚯씪 ?ш린
- ?덉긽 ?ш린: ~500KB (?띿뒪???뚯씪)
- ?ы븿 ?뚯씪: 10媛?

---

## ?렞 ?ㅼ쓬 ?묒뾽 異붿쿇 (?낅뜲?댄듃??

### ?λ퉬愿由??뚰듃 (?대떦: 議곗꽍??

#### ?곗꽑?쒖쐞 1: EM-004 ?λ퉬 ?좊떦 API ?곕룞
```bash
/status                                    # ?꾩옱 ?곹깭 ?뺤씤
/analyze-api /customer/equipment/getEquipmentOutList  # API 遺꾩꽍
# ??援ы쁽 (3媛?API)
/test-equipment EM-004                     # ?뚯뒪??
/deploy                                    # 諛고룷
```
**?덉긽 ?쒓컙**: 2-3?쒓컙

#### ?곗꽑?쒖쐞 2: EM-015 誘명쉶???λ퉬 議고쉶
```bash
/analyze-api /customer/work/getEquipLossInfo  # API 遺꾩꽍
# ??援ы쁽 (1媛?API)
/test-equipment EM-015                     # ?뚯뒪??
/deploy                                    # 諛고룷
```
**?덉긽 ?쒓컙**: 1?쒓컙

#### ?곗꽑?쒖쐞 3: EM-011 ?λ퉬 ?닿?
```bash
/analyze-api /customer/equipment/changeEqtWrkr_3  # API 遺꾩꽍
# ??援ы쁽 (1媛?API + 紐⑤떖)
/test-equipment EM-011                     # ?뚯뒪??
/deploy                                    # 諛고룷
```
**?덉긽 ?쒓컙**: 3-4?쒓컙

---

### ?묒뾽愿由??뚰듃 (?대떦: 源?곸＜)

#### ?곗꽑?쒖쐞 1: WM-020 LGU LDAP ?깅줉 (吏꾪뻾以?
```bash
/status                                    # ?꾩옱 ?곹깭 ?뺤씤
/analyze-api /customer/etc/reqUplsHspdLdap  # API 遺꾩꽍
/test-work WM-020                          # ?뚯뒪??
/deploy                                    # 諛고룷
```
**?덉긽 ?쒓컙**: 4-6?쒓컙 (LDAP ??CONF ?곗냽 ?몄텧)

#### ?곗꽑?쒖쐞 2: WM-009, WM-010 ?묒뾽??蹂寃?
```bash
/analyze-api /system/cm/getFindUsrList     # API 遺꾩꽍
/analyze-api /customer/work/modWorkDivision  # API 遺꾩꽍
/test-work WM-009                          # ?뚯뒪??
/test-work WM-010                          # ?뚯뒪??
/deploy                                    # 諛고룷
```
**?덉긽 ?쒓컙**: 3-4?쒓컙

---

### 怨좉컼愿由??뚰듃 (Phase 2 怨꾪쉷)

#### ?곗꽑?쒖쐞 1: CM-001, CM-002 怨좉컼 議고쉶
```bash
/analyze-api /customer/negociation/getCustCntBySearchCust  # API 遺꾩꽍
/analyze-api /customer/common/customercommon/getConditionalCustList2  # API 遺꾩꽍
/test-customer CM-001                      # ?뚯뒪??
/test-customer CM-002                      # ?뚯뒪??
/deploy                                    # 諛고룷
```
**?덉긽 ?쒓컙**: 4-5?쒓컙

#### ?곗꽑?쒖쐞 2: CM-016 AS ?묒닔 ?깅줉
```bash
/analyze-api /customer/work/modAsPdaReceipt  # API 遺꾩꽍
/test-customer CM-016                      # ?뚯뒪??
/deploy                                    # 諛고룷
```
**?덉긽 ?쒓컙**: 3-4?쒓컙

---

### 怨듯넻 湲곕뒫 (吏꾪뻾以?

#### ?곗꽑?쒖쐞 1: CO-011 ~ CO-014 LGU+ ?곕룞 (吏꾪뻾以?
```bash
/test-common CO-011                        # ?ы듃利앹꽕 ?붿껌 ?뚯뒪??
/test-common CO-012                        # 怨꾩빟?뺣낫 議고쉶 ?뚯뒪??
/test-common CO-013                        # LDAP 議고쉶 ?뚯뒪??
/test-common CO-014                        # 留앹옣???좉퀬 ?뚯뒪??
/deploy                                    # 諛고룷
```
**?덉긽 ?쒓컙**: 6-8?쒓컙 (LGU+ API ?곕룞)

---

## ?뵕 鍮좊Ⅸ 李몄“

### 臾몄꽌
| 臾몄꽌 | 寃쎈줈 | ?⑸룄 |
|------|------|------|
| 醫낇빀 媛?대뱶 | `/COMPREHENSIVE_GUIDE.md` | ?꾩껜 ?쒖뒪???댄빐 |
| Instructions | `/.claude/instructions.md` | 鍮좊Ⅸ 李몄“ |
| ?λ퉬愿由?WBS | `/?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 ?λ퉬愿由?WBS.csv` | 湲곕뒫 紐낆꽭 |
| ?묒뾽愿由?WBS | `/?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 ?묒뾽愿由?WBS.csv` | 湲곕뒫 紐낆꽭 |
| 怨좉컼愿由?WBS | `/?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 怨좉컼愿由?WBS.csv` | 湲곕뒫 紐낆꽭 |
| 怨듯넻 WBS | `/?쒕씪?대툕_?듯빀媛쒕컻怨꾪쉷_V9.xlsx - ?뱥 怨듯넻_湲고? WBS.csv` | 湲곕뒫 紐낆꽭 |

### 紐낅졊??
| 紐낅졊??| ?⑸룄 | 而ㅻ쾭由ъ? |
|--------|------|----------|
| `/status` | ?꾩껜 ?곹깭 ?뺤씤 | 120+ 媛?湲곕뒫 |
| `/analyze-api <寃쎈줈>` | API 遺꾩꽍 | 紐⑤뱺 API |
| `/test-equipment <ID>` | ?λ퉬愿由??뚯뒪??| 16媛?湲곕뒫 |
| `/test-work <ID>` | ?묒뾽愿由??뚯뒪??| 54媛?湲곕뒫 |
| `/test-customer <ID>` | 怨좉컼愿由??뚯뒪??| 20+媛?湲곕뒫 |
| `/test-common <ID>` | 怨듯넻/湲고? ?뚯뒪??| 30+媛?湲곕뒫 |
| `/deploy` | EC2 諛고룷 | ?꾩껜 |

### ?쒕쾭
| ?쒕쾭 | URL | ?⑸룄 |
|------|-----|------|
| 濡쒖뺄 媛쒕컻 | http://localhost:3000 | Frontend 媛쒕컻 |
| EC2 ?꾨줈?뺤뀡 | http://52.63.232.141 | 諛고룷 ?뺤씤 |
| Legacy API | http://58.143.140.222:8080 | API ?쒕쾭 |

---

## ??寃利??꾨즺

### 臾몄꽌
- ??COMPREHENSIVE_GUIDE.md (15,000+ 以?
- ??.claude/instructions.md
- ??API Explorer (ApiExplorer.tsx)
- ??App.tsx ?듯빀

### 而ㅼ뒪? 紐낅졊??(7媛?- 踰붿슜???꾨즺)
- ??`/analyze-api` (踰붿슜)
- ??`/test-equipment` (16媛?湲곕뒫)
- ??`/test-work` (54媛?湲곕뒫) ???좉퇋
- ??`/test-customer` (20+媛?湲곕뒫) ???좉퇋
- ??`/test-common` (30+媛?湲곕뒫) ???좉퇋
- ??`/deploy` (踰붿슜)
- ??`/status` (?꾩껜 120+ 湲곕뒫)

### 湲곕뒫 而ㅻ쾭由ъ?
- ???λ퉬愿由? 16媛?湲곕뒫 100% 而ㅻ쾭
- ???묒뾽愿由? 54媛?湲곕뒫 100% 而ㅻ쾭
- ??怨좉컼愿由? 20+媛?湲곕뒫 100% 而ㅻ쾭
- ??怨듯넻/湲고?: 30+媛?湲곕뒫 100% 而ㅻ쾭
- **???⑷퀎: 120+媛?湲곕뒫 100% 而ㅻ쾭**

---

## ?럦 理쒖쥌 ?꾨즺!

**?댁젣 ?대뼡 PC?먯꽌?? ?대뼡 ?묒뾽?대뱺 利됱떆 ?쒖옉 媛?ν빀?덈떎!**

### ?뺤텞 ?뚯씪 ?꾩넚 諛⑸쾿
```bash
# ?ㅻⅨ PC濡?蹂듭궗
scp /tmp/dlive-project-setup.tar.gz user@remote:/path/to/destination/

# ?먮뒗 ?대씪?곕뱶 ?낅줈??
# Google Drive, Dropbox, GitHub Release ??
```

### ?ㅻⅨ 媛쒕컻???⑤낫??
1. ?뺤텞 ?뚯씪 ?ㅼ슫濡쒕뱶
2. ?뺤텞 ?댁젣
3. `COMPREHENSIVE_GUIDE.md` ?쎄린 (30遺?
4. Claude Code ?쒖옉 ???먮룞 ?ㅼ젙
5. 利됱떆 ?묒뾽 ?쒖옉!

---

**?꾨줈?앺듃媛 ?꾨꼍?섍쾶 臾몄꽌?붾릺怨??먮룞?붾릺?덉뒿?덈떎!** ??
**?꾩껜 120+媛?湲곕뒫??4媛?紐낅졊?대줈 ?뚯뒪??媛?ν빀?덈떎!** ??
