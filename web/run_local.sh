#!/usr/bin/env bash
set -euo pipefail

# 스크립트 위치로 이동
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

PORT="${1:-8000}"
URL="http://localhost:${PORT}"

echo "[run_local] Serving ${SCRIPT_DIR} on ${URL}"

# 빌드 확인 및 실행
BUILD_DIR="${SCRIPT_DIR}/../build"
if [ ! -f "${SCRIPT_DIR}/index.js" ] || [ ! -f "${SCRIPT_DIR}/index.wasm" ]; then
    echo "[run_local] WebAssembly files not found. Building project..."
    
    # 빌드 디렉토리 생성
    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"
    
    # CMake 설정 (Emscripten 사용)
    if command -v emcmake >/dev/null 2>&1; then
        echo "[run_local] Running emcmake cmake..."
        emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
        
        # 빌드 실행
        echo "[run_local] Running emmake make..."
        emmake make
        
        if [ $? -eq 0 ]; then
            echo "[run_local] Build successful!"
        else
            echo "[run_local] Build failed. Exiting."
            exit 1
        fi
    else
        echo "[run_local] Error: emcmake not found. Please install Emscripten SDK."
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
fi

# 백그라운드에서 서버 시작
# emrun이 있으면 우선 사용 (Emscripten 제공)
if command -v emrun >/dev/null 2>&1; then
  emrun --no_browser --port "${PORT}" . &
  SERVER_PID=$!
elif command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "${PORT}" &
  SERVER_PID=$!
elif command -v python >/dev/null 2>&1; then
  python -m http.server "${PORT}" &
  SERVER_PID=$!
else
  echo "No emrun or python found. Please install Emscripten or Python 3."
  exit 1
fi

# 서버가 시작될 때까지 잠시 대기
sleep 2

# 브라우저에서 페이지 열기
echo "[run_local] Opening ${URL} in browser..."
if command -v open >/dev/null 2>&1; then
  # macOS
  open -a "Google Chrome" "${URL}" 2>/dev/null || open "${URL}"
elif command -v google-chrome >/dev/null 2>&1; then
  # Linux
  google-chrome "${URL}"
elif command -v chrome >/dev/null 2>&1; then
  # Linux (alternative)
  chrome "${URL}"
else
  echo "Chrome not found, opening with default browser..."
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${URL}"
  else
    echo "Please manually open ${URL} in your browser"
  fi
fi

# 종료 신호 처리 함수
cleanup() {
    echo ""
    echo "[run_local] Shutting down server..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
    fi
    exit 0
}

# 종료 신호 트랩 설정 (Ctrl+C, 터미널 종료 등)
trap cleanup SIGINT SIGTERM

# 서버 프로세스 대기
echo "[run_local] Server running. Press Ctrl+C to stop..."
wait $SERVER_PID
