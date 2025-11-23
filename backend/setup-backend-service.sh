#!/bin/bash
# Auto-start backend on system boott

cat > /etc/systemd/system/naverbank-backend.service << 'EOF'
[Unit]
Description=Naver Bank Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/Naver_project/LunchCubee/backend/src
Environment="PATH=/home/Naver_project/LunchCubee/backend/src/chatbotvenv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/Naver_project/LunchCubee/backend/src/chatbotvenv/bin/uvicorn hyperclovax:app --host 0.0.0.0 --port 6011
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable naverbank-backend.service
systemctl start naverbank-backend.service
systemctl status naverbank-backend.service
