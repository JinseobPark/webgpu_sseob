# webgpu_sseob

An awesome WebGPU renderer built with modern graphics programming techniques.

## Overview

webgpu_sseob is a high-performance WebGPU-based rendering engine that demonstrates advanced graphics capabilities in the browser. Built with C++ and compiled to WebAssembly using Emscripten, it provides efficient GPU-accelerated rendering.

## Features

- Modern WebGPU API implementation
- Cross-platform compatibility via WebAssembly
- Optimized rendering pipeline
- Real-time graphics rendering

## Building

This project uses CMake and Emscripten for building:

```bash
mkdir build
cd build
cmake ..
make
```

## Running

Open `web/index.html` in a web browser that supports WebGPU, or use the local server:

```bash
cd web
./run_local.sh
```
