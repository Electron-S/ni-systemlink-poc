#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$PROJECT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker 명령을 찾을 수 없습니다."
  exit 1
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok 명령을 찾을 수 없습니다."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker 권한이 없거나 데몬에 연결할 수 없습니다."
  echo "새 터미널에서 'newgrp docker' 후 다시 실행하세요."
  exit 1
fi

echo "Docker 서비스를 백그라운드로 올립니다..."
docker compose up -d

echo
echo "로컬 확인 주소: http://localhost:3001"
echo "ngrok 터널을 시작합니다. 종료하려면 Ctrl+C를 누르세요."
echo

exec ngrok http --host-header=rewrite 3001
