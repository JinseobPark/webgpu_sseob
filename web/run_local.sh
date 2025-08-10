#!/usr/bin/env bash
set -euo pipefail

# 스크립트 위치로 이동
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

PORT="${1:-8000}"

echo "[run_local] Serving ${SCRIPT_DIR} on http://localhost:${PORT}"

# emrun이 있으면 우선 사용 (Emscripten 제공)
if command -v emrun >/dev/null 2>&1; then
  # --no_browser: 자동 브라우저 안 띄우고, 주소만 출력
  # 브라우저 자동 실행 원하면 --browser 옵션에 크롬 경로 지정 가능
  exec emrun --no_browser --port "${PORT}" .
fi

# emrun이 없다면 python 내장 서버로 폴백
# NOTE: wasm MIME은 python3 http.server가 자동으로 처리
# TODO: COOP/COEP(멀티스레딩/OffscreenCanvas) 필요 시 커스텀 서버 스크립트로 확장
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "${PORT}"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "${PORT}"
else
  echo "No emrun or python found. Please install Emscripten or Python 3."
  exit 1
fi
