# EC2 서버 정보

## 인스턴스 정보

| 항목 | 값 |
|------|-----|
| 인스턴스 ID | `i-08f7598872f27f50d` |
| 퍼블릭 IPv4 | `52.63.232.141` |
| 프라이빗 IPv4 | `172.31.26.30` |
| 리전 | `ap-southeast-2` (시드니) |
| 가용 영역 | ap-southeast-2 |
| 인스턴스 유형 | `t3.micro` (vCPU: 2) |
| 상태 | 실행 중 |

## 도메인 및 접속 정보

| 항목 | 값 |
|------|-----|
| 도메인 | `https://dlivestore2.store/` |
| 퍼블릭 DNS | `ec2-52-63-232-141.ap-southeast-2.compute.amazonaws.com` |
| 탄력적 IP | `52.63.232.141` |

## 플랫폼 정보

| 항목 | 값 |
|------|-----|
| AMI | `ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-20251022` |
| AMI ID | `ami-0b8d527345fdace59` |
| 플랫폼 | Linux/UNIX (Ubuntu 24.04) |
| 부트 모드 | uefi-preferred |
| 가상화 유형 | hvm |

## 보안 및 네트워크

| 항목 | 값 |
|------|-----|
| 키 페어 | `dlive-equipment-key` |
| VPC ID | `vpc-0162ce42f7a8a1517` |
| 서브넷 ID | `subnet-0b7f7b4f10b2ea8b2` |
| 테넌시 | default |
| IMDSv2 | Required |

## 시작 정보

| 항목 | 값 |
|------|-----|
| 시작 시간 | 2025-12-10 10:46:34 (KST) |
| 소유자 | `501562869598` |
| 인스턴스 ARN | `arn:aws:ec2:ap-southeast-2:501562869598:instance/i-08f7598872f27f50d` |

## SSH 접속

```bash
ssh -i dlive-equipment-key.pem ubuntu@52.63.232.141
```

## PM2 관리 명령어

```bash
# 상태 확인
pm2 status

# 로그 확인
pm2 logs dlive-equipment --lines 50

# 재시작
pm2 restart dlive-equipment

# 저장
pm2 save
```

## API 엔드포인트

- 기본 URL: `https://dlivestore2.store/api`
- 내부 포트: `8080`

## 주의사항

1. **리전 확인**: ap-southeast-2 (시드니) - 서울 리전 아님
2. **IP 주소**: 52.63.232.141 (기존 58.143.140.222 아님)
3. **HTTPS 필수**: 도메인 접속 시 HTTPS 사용
4. **직접 IP 접근 제한**: 보안그룹에서 8080 포트 직접 접근 제한됨

---

*최종 업데이트: 2026-02-04*
