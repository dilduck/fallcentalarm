# 카페24 VPS 배포 가이드

## 1. 카페24 VPS 신청
1. [카페24 호스팅](https://www.cafe24.com) 접속
2. 호스팅 → 클라우드 호스팅 → VPS 호스팅
3. **추천 상품: 클라우드 VPS-1**
   - CPU: 1 Core
   - 메모리: 1GB
   - 디스크: 30GB SSD
   - 트래픽: 무제한
   - **월 요금: 6,600원**

## 2. 서버 정보 확인
- 신청 완료 후 SMS/이메일로 서버 정보 수신
- IP 주소, SSH 포트, root 비밀번호 확인

## 3. SSH 접속 (Windows)
```bash
# 방법 1: PowerShell 사용
ssh root@YOUR_SERVER_IP -p SSH_PORT

# 방법 2: PuTTY 사용 (GUI)
# PuTTY 다운로드: https://www.putty.org/
# Host Name: YOUR_SERVER_IP
# Port: SSH_PORT (보통 22가 아닌 다른 포트)
```

## 4. 서버 초기 설정
```bash
# 시스템 업데이트
yum update -y

# 필수 패키지 설치
yum install -y curl wget git htop

# 방화벽 설정 (CentOS 7 기준)
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload

# 또는 Ubuntu인 경우
# ufw allow 3000
# ufw allow 80
# ufw allow 443
# ufw enable
```

## 5. Node.js 설치
```bash
# Node.js 18 설치 (CentOS/RHEL)
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Ubuntu인 경우
# curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
# apt-get install -y nodejs

# 설치 확인
node --version
npm --version
```

## 6. PM2 설치 및 설정
```bash
# PM2 전역 설치
npm install -g pm2

# PM2 설치 확인
pm2 --version
```

## 7. 프로젝트 배포
```bash
# 홈 디렉토리로 이동
cd /root

# GitHub에서 프로젝트 클론
git clone https://github.com/YOUR_USERNAME/fallcentalert.git
cd fallcentalert

# 의존성 설치
npm install

# 환경 확인 (Puppeteer 설치 확인)
npm list puppeteer
```

## 8. Puppeteer 의존성 설치 (중요!)
```bash
# CentOS/RHEL의 경우
yum install -y \
    libX11 libX11-devel libXtst libXext \
    libxkbcommon libxkbcommon-devel \
    libdrm libdrm-devel libxshmfence \
    libnss3 libnss3-devel \
    libatk-1_0 libatk-bridge-2_0 \
    libdrm libxcomposite libxdamage libxrandr \
    libasound2 libpangocairo-1_0 libatk1.0-dev \
    libcairo libcups2 libxss1 libgconf-2-4

# Ubuntu의 경우
# apt-get update
# apt-get install -y \
#     ca-certificates fonts-liberation \
#     libappindicator3-1 libasound2 libatk-bridge2.0-0 \
#     libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
#     libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 \
#     libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
#     libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
#     libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
#     libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
```

## 9. PM2로 앱 실행
```bash
# 앱 시작
pm2 start server/app.js --name fallcentalert

# 상태 확인
pm2 status

# 로그 확인
pm2 logs fallcentalert

# 부팅시 자동 시작 설정
pm2 startup
# 표시되는 명령어를 복사해서 실행
pm2 save
```

## 10. Nginx 설정 (선택사항)
```bash
# Nginx 설치
yum install -y nginx
# 또는 Ubuntu: apt install -y nginx

# Nginx 설정 파일 생성
cat > /etc/nginx/conf.d/fallcentalert.conf << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Nginx 시작 및 활성화
systemctl start nginx
systemctl enable nginx
systemctl reload nginx
```

## 11. 도메인 연결
1. **카페24에서 도메인 구매** (연 1만원~)
2. **DNS 설정**:
   - 카페24 DNS 관리
   - A 레코드: @ → 서버 IP
   - A 레코드: www → 서버 IP

## 12. SSL 인증서 (Let's Encrypt)
```bash
# Certbot 설치 (CentOS)
yum install -y epel-release
yum install -y certbot python3-certbot-nginx

# Ubuntu인 경우
# apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 자동 갱신 설정
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

## 13. 모니터링 및 관리
```bash
# PM2 관리 명령어
pm2 status                    # 상태 확인
pm2 logs fallcentalert       # 로그 보기
pm2 restart fallcentalert    # 재시작
pm2 stop fallcentalert       # 정지
pm2 delete fallcentalert     # 삭제

# 시스템 리소스 확인
htop                          # CPU, 메모리 사용량
df -h                         # 디스크 사용량
free -m                       # 메모리 사용량

# 앱 업데이트 시
cd /root/fallcentalert
git pull
npm install
pm2 restart fallcentalert
```

## 14. 문제 해결
```bash
# Puppeteer 오류 시
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install puppeteer

# 메모리 부족 시
pm2 restart fallcentalert

# 포트 확인
netstat -tulpn | grep :3000
```

## 15. 카페24 특별 팁
1. **기술지원**: 1588-3144 (24시간)
2. **원격지원**: 카페24 고객센터에서 제공
3. **서버 재부팅**: 카페24 콘솔에서 가능
4. **트래픽 모니터링**: 카페24 콘솔에서 확인
5. **백업**: 자동 백업 서비스 활용 (옵션)

## 예상 비용
- **VPS 호스팅**: 월 6,600원
- **도메인** (선택): 연 10,000원
- **총 월 비용: 약 6,600원** (도메인 제외)

## 접속 주소
- **IP 접속**: http://YOUR_SERVER_IP:3000
- **도메인 접속**: http://yourdomain.com (Nginx 설정 시) 