# GitHub Actions 자동배포 설정 가이드

## 📋 개요
`main` 브랜치에 코드를 푸시하면 자동으로 EC2 서버에 배포됩니다.

**배포 프로세스:**
1. GitHub에 코드 push
2. GitHub Actions 실행
3. EC2에 SSH 접속
4. `git pull` → `npm install` → `npm run build` → `pm2 restart dlive`

---

## 🔐 1단계: GitHub Secrets 설정

GitHub 리포지토리에 민감한 정보를 안전하게 저장해야 합니다.

### 1-1. GitHub 리포지토리 설정 페이지로 이동

```
https://github.com/Jusang98/DLive-cona-front/settings/secrets/actions
```

또는:
1. GitHub 리포지토리 페이지 접속
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Secrets and variables** → **Actions** 클릭

### 1-2. 다음 3개의 Secret 추가

#### ① `EC2_SSH_KEY` 추가

**Name:** `EC2_SSH_KEY`

**Value:** D-Live.pem 파일의 내용 전체를 복사

```bash
# Mac/Linux에서 터미널로 복사
cat ~/Downloads/D-Live.pem | pbcopy

# 또는 에디터로 열어서 전체 복사
code ~/Downloads/D-Live.pem
```

⚠️ **주의:** `-----BEGIN RSA PRIVATE KEY-----`부터 `-----END RSA PRIVATE KEY-----`까지 전체를 복사해야 합니다!

#### ② `EC2_HOST` 추가

**Name:** `EC2_HOST`

**Value:** `52.63.131.157`

#### ③ `EC2_USERNAME` 추가

**Name:** `EC2_USERNAME`

**Value:** `ubuntu`

---

## 🔑 2단계: EC2에서 GitHub 인증 설정 (git pull 자동화)

현재 EC2에서 `git pull` 시 아이디/비밀번호를 입력하고 있으므로, **Personal Access Token (PAT)** 또는 **SSH 키**로 인증을 설정해야 합니다.

### 방법 1: Personal Access Token (권장 - 간단함)

#### 2-1. GitHub에서 Personal Access Token 생성

1. GitHub 접속 → 오른쪽 위 프로필 클릭 → **Settings**
2. 왼쪽 메뉴 맨 아래 **Developer settings** 클릭
3. **Personal access tokens** → **Tokens (classic)** 클릭
4. **Generate new token** → **Generate new token (classic)** 클릭
5. 설정:
   - **Note:** `DLive EC2 Deploy`
   - **Expiration:** `No expiration` (또는 원하는 기간)
   - **Select scopes:** ✅ **repo** (전체 체크)
6. **Generate token** 클릭
7. 🔴 **생성된 토큰을 복사하세요!** (다시 볼 수 없습니다)

예시: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### 2-2. EC2에서 Git Credential 저장

EC2에 SSH 접속 후:

```bash
ssh -i ~/Downloads/D-Live.pem ubuntu@52.63.131.157

# 프로젝트 디렉토리로 이동
cd ~/dlive-cona-client

# Git credential helper 설정 (한 번만 하면 됨)
git config credential.helper store

# 한 번 pull 받으면서 인증 정보 저장
git pull origin main
```

아이디/비밀번호 입력창이 나오면:
- **Username:** GitHub 아이디 (예: `Jusang98`)
- **Password:** 위에서 생성한 Personal Access Token (예: `ghp_xxxx...`)

이제부터 `git pull`할 때 비밀번호를 묻지 않습니다!

### 방법 2: SSH 키 사용 (더 안전함)

<details>
<summary>클릭하여 SSH 키 설정 방법 보기</summary>

#### 2-1. EC2에서 SSH 키 생성

```bash
ssh -i ~/Downloads/D-Live.pem ubuntu@52.63.131.157

# SSH 키 생성 (이메일은 GitHub 이메일로)
ssh-keygen -t ed25519 -C "your_email@example.com"
# 엔터 3번 (기본 경로 사용, 비밀번호 없음)

# 생성된 공개키 확인
cat ~/.ssh/id_ed25519.pub
```

#### 2-2. GitHub에 공개키 등록

1. 위에서 출력된 공개키 전체 복사 (`ssh-ed25519 AAA...`로 시작)
2. GitHub 접속 → 프로필 → **Settings** → **SSH and GPG keys**
3. **New SSH key** 클릭
4. **Title:** `EC2 DLive Server`
5. **Key:** 복사한 공개키 붙여넣기
6. **Add SSH key** 클릭

#### 2-3. EC2에서 Git Remote를 SSH로 변경

```bash
cd ~/dlive-cona-client

# 현재 remote 확인
git remote -v

# HTTPS를 SSH로 변경
git remote set-url origin git@github.com:Jusang98/DLive-cona-front.git

# 확인
git remote -v

# 테스트
git pull origin main
```

</details>

---

## ✅ 3단계: 배포 테스트

### 3-1. 로컬에서 코드 수정 후 Push

```bash
cd /Users/hanseungsu/Desktop/poby/딜라이브/dlive-json-api/mobile-cona-front

# 작은 변경 (예: README 수정)
echo "# Test Auto Deploy" >> README.md

# Git commit & push
git add .
git commit -m "test: GitHub Actions 자동배포 테스트"
git push origin main
```

### 3-2. GitHub Actions 로그 확인

1. GitHub 리포지토리 페이지 접속
2. **Actions** 탭 클릭
3. 방금 실행된 workflow 클릭하여 로그 확인

### 3-3. EC2에서 배포 확인

```bash
ssh -i ~/Downloads/D-Live.pem ubuntu@52.63.131.157

# PM2 프로세스 확인
pm2 list

# 로그 확인
pm2 logs dlive --lines 50
```

---

## 🔧 트러블슈팅

### ❌ `Permission denied (publickey)` 에러

**원인:** EC2_SSH_KEY Secret이 잘못 설정됨

**해결:** D-Live.pem 파일 내용을 **전체** 복사했는지 확인 (줄바꿈 포함)

### ❌ `git pull` 시 인증 실패

**원인:** EC2에서 GitHub 인증이 설정되지 않음

**해결:** 위 **2단계** 다시 진행

### ❌ `pm2 restart dlive` 실패

**원인:** PM2 프로세스 이름이 다를 수 있음

**해결:** EC2에서 `pm2 list` 실행하여 프로세스 이름 확인 후 `.github/workflows/deploy.yml` 수정

### ❌ 빌드 실패

**원인:** `npm install` 또는 `npm run build` 중 에러

**해결:**
1. GitHub Actions 로그에서 에러 메시지 확인
2. 로컬에서 `npm run build` 테스트
3. `package.json` 의존성 확인

---

## 📊 배포 알림 (선택사항)

Slack, Discord, Email 등으로 배포 성공/실패 알림을 받고 싶다면 `.github/workflows/deploy.yml`에 알림 단계를 추가할 수 있습니다.

필요하면 말씀해주세요!

---

## 🎯 다음 단계

1. ✅ GitHub Secrets 3개 등록
2. ✅ EC2에서 GitHub 인증 설정 (Personal Access Token 또는 SSH 키)
3. ✅ 테스트 푸시하여 자동배포 확인

설정 완료 후 앞으로는:
```bash
git push origin main
```
만 하면 자동으로 EC2에 배포됩니다! 🚀
