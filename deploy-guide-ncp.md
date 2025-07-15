# 네이버 클라우드 플랫폼 배포 가이드

## 1. 서버 생성
1. [NCP 콘솔](https://console.ncloud.com) 접속
2. Server → Server 메뉴
3. 서버 생성
   - 서버 이미지: Ubuntu Server 20.04 LTS
   - 서버 타입: Micro (1vCPU, 1GB RAM)
   - 스토리지: 50GB SSD

## 2. 방화벽 설정
```bash
# ACG (Access Control Group) 설정
- 포트 22 (SSH): 0.0.0.0/0
- 포트 3000 (앱): 0.0.0.0/0
- 포트 80 (HTTP): 0.0.0.0/0
- 포트 443 (HTTPS): 0.0.0.0/0
```

## 3. 서버 접속 및 환경 설정
```bash
# SSH 접속
ssh root@YOUR_SERVER_IP

# 시스템 업데이트
apt update && apt upgrade -y

# Node.js 18 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# PM2 설치 (프로세스 관리자)
npm install -g pm2

# Git 설치
apt install git -y
```

## 4. 프로젝트 배포
```bash
# 프로젝트 클론
git clone YOUR_GITHUB_REPO_URL
cd fallcentalert

# 의존성 설치
npm install

# PM2로 실행
pm2 start server/app.js --name fallcentalert

# 부팅시 자동 시작 설정
pm2 startup
pm2 save
```

## 5. Nginx 리버스 프록시 (선택사항)
```bash
# Nginx 설치
apt install nginx -y

# 설정 파일 생성
cat > /etc/nginx/sites-available/fallcentalert << EOF
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 설정 활성화
ln -s /etc/nginx/sites-available/fallcentalert /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
systemctl restart nginx
systemctl enable nginx
```

## 6. 도메인 연결 (선택사항)
1. 도메인 구매 (가비아, 후이즈 등)
2. DNS A 레코드를 서버 IP로 설정
3. Nginx 설정에서 server_name을 도메인으로 변경

## 7. SSL 인증서 (Let's Encrypt)
```bash
# Certbot 설치
apt install certbot python3-certbot-nginx -y

# SSL 인증서 발급
certbot --nginx -d YOUR_DOMAIN

# 자동 갱신 설정
crontab -e
# 다음 라인 추가:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 8. 모니터링 명령어
```bash
# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs fallcentalert

# 재시작
pm2 restart fallcentalert

# 서버 리소스 확인
htop
```

## 예상 비용
- 서버: 월 8,000원
- 도메인: 연 15,000원 (선택)
- **총 월 비용: 약 8,000원** 