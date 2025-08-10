cmake_minimum_required(VERSION 3.20)

# 프로젝트 이름 및 언어
project(webgpu_wasm C CXX)

# C++ 표준
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Emscripten 환경에서만 동작하도록 가드(선택)
if(NOT EMSCRIPTEN)
  message(WARNING "This CMakeLists is intended for Emscripten builds. Use emcmake/emmake.")
endif()

# 소스
add_executable(webgpu
  src/main.cpp
)

# 공통 컴파일 옵션
target_compile_options(webgpu PRIVATE
  -std=c++20
  -sUSE_WEBGPU=1      # WebGPU 브리지 활성화
)

# 공통 링크 옵션
# 출력 파일을 web/index.js로 지정 (index.js + index.wasm + 소스맵 생성)
target_link_options(webgpu PRIVATE
  -sUSE_WEBGPU=1
  -sASSERTIONS=2
  -sSAFE_HEAP=1
  -o ${CMAKE_SOURCE_DIR}/web/index.js
)

# 구성별 최적화/디버그 옵션
# - Debug: 소스맵 포함 (-gsource-map -g), O0
# - Release: O3, LTO는 필요 시 추가 (-flto)
target_compile_options(webgpu PRIVATE
  $<$<CONFIG:Debug>:-O0 -g -gsource-map>
  $<$<CONFIG:Release>:-O3>
)
target_link_options(webgpu PRIVATE
  $<$<CONFIG:Debug>:-g -gsource-map>
  $<$<CONFIG:Release>:-O3>
)

# 선택: 빌드 후 간단한 메시지
add_custom_command(TARGET webgpu POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E echo "Built: ${CMAKE_SOURCE_DIR}/web/index.js"
  COMMAND ${CMAKE_COMMAND} -E echo "Open web/index.html with a local server."
)
