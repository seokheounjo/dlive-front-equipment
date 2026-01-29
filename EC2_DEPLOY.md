# EC2 배포 가이드

## 서버 정보

| 항목 | 값 |
|------|-----|
| EC2 IP | `52.63.232.141` |
| 포트 | `8080` |
| 접속 URL | http://52.63.232.141:8080 |
| SSH 사용자 | `ubuntu` |
| PEM 키 파일 | `C:\bottle\dlive\ec2-key.pem` |
| 배포 경로 | `/var/www/html/mobile/` |
| GitHub 저장소 | `seokheounjo/dlive-front-equipment` |

## 자동 배포 (권장)

**GitHub에 푸시하면 GitHub Actions가 자동으로 EC2에 배포합니다.**

```bash
# 1. 코드 수정 후
git add -A
git commit -m "커밋 메시지"
git push origin main

# 2. 자동 배포 완료 대기 (GitHub Actions)
# 3. http://52.63.232.141:8080 에서 확인
```

## 수동 배포 (긴급 시)

### 로컬에서 직접 배포

```bash
# 1. 빌드
cd C:/bottle/dlive/frontend
npm run build

# 2. 업로드
scp -i C:/bottle/dlive/ec2-key.pem -r dist/* ubuntu@52.63.232.141:~/mobile_dist/

# 3. 서버에서 파일 이동
ssh -i C:/bottle/dlive/ec2-key.pem ubuntu@52.63.232.141 "sudo cp -r ~/mobile_dist/* /var/www/html/mobile/ && sudo chown -R www-data:www-data /var/www/html/mobile/ && rm -rf ~/mobile_dist && echo 'Deploy complete!'"
```

### 한 줄 배포 명령어
```bash
cd C:/bottle/dlive/frontend && npm run build && scp -i C:/bottle/dlive/ec2-key.pem -r dist/* ubuntu@52.63.232.141:~/mobile_dist/ && ssh -i C:/bottle/dlive/ec2-key.pem ubuntu@52.63.232.141 "sudo cp -r ~/mobile_dist/* /var/www/html/mobile/ && sudo chown -R www-data:www-data /var/www/html/mobile/ && rm -rf ~/mobile_dist && echo 'Deploy complete!'"
```

## SSH 접속

```bash
ssh -i C:/bottle/dlive/ec2-key.pem ubuntu@52.63.232.141
```

## PM2 명령어

```bash
pm2 status              # 상태 확인
pm2 logs                # 로그 확인
pm2 restart all         # 재시작
pm2 stop all            # 중지
```

## 문제 해결

### SSH 연결 테스트
```bash
ssh -i C:/bottle/dlive/ec2-key.pem -o ConnectTimeout=10 ubuntu@52.63.232.141 "echo connected"
```

### 권한 오류 시
```bash
sudo chown -R www-data:www-data /var/www/html/mobile/
sudo chmod -R 755 /var/www/html/mobile/
```

## IP 제한 (server.js)

허용된 IP:
- `211.32.50.55`
- `58.143.140.34`
- `58.143.140.167`
- `58.143.140.222` (딜라이브 내부서버)
- `193.186.4.167` (딜라이브 사무실)
- `127.0.0.1` (로컬호스트)

IP 추가: `server.js`의 `ALLOWED_IPS` 배열 수정 후 PM2 재시작
