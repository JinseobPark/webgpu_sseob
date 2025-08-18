#include <webgpu/webgpu.h>
#include <emscripten/html5.h>
#include <emscripten/emscripten.h>
#include <cassert>
#include <cstdio>

static WGPUDevice device;
static WGPUSwapChain swapchain;

EM_BOOL frame(double, void*) {
  WGPUTextureView view = wgpuSwapChainGetCurrentTextureView(swapchain);

  WGPURenderPassColorAttachment color{};
  color.view = view;
  color.loadOp = WGPULoadOp_Clear;
  color.clearValue = {0.3, 0.9, 0.4, 1.0}; // 밝은 초록색
  color.storeOp = WGPUStoreOp_Store;

  WGPURenderPassDescriptor rp{};
  rp.colorAttachmentCount = 1;
  rp.colorAttachments = &color;

  WGPUCommandEncoder enc = wgpuDeviceCreateCommandEncoder(device, nullptr);
  WGPURenderPassEncoder pass = wgpuCommandEncoderBeginRenderPass(enc, &rp);
  wgpuRenderPassEncoderEnd(pass);
  WGPUCommandBuffer cmd = wgpuCommandEncoderFinish(enc, nullptr);
  wgpuQueueSubmit(wgpuDeviceGetQueue(device), 1, &cmd);
  wgpuTextureViewRelease(view);
  return EM_TRUE;
}

int main() {
  printf("Starting WebGPU Sseob Renderer...\n");
  
  // 1) 어댑터/디바이스 요청
  WGPUInstance instance = wgpuCreateInstance(nullptr);
  WGPURequestAdapterOptions opts{};
  WGPUAdapter adapter = nullptr;

  wgpuInstanceRequestAdapter(instance, &opts,
    [](WGPURequestAdapterStatus s, WGPUAdapter a, const char*, void* ud){
      if (s == WGPURequestAdapterStatus_Success) *(WGPUAdapter*)ud = a;
    }, &adapter);

  assert(adapter);
  printf("WebGPU adapter acquired!\n");
  
  wgpuAdapterRequestDevice(adapter, nullptr,
    [](WGPURequestDeviceStatus s, WGPUDevice d, const char*, void* ud){
      if (s == WGPURequestDeviceStatus_Success) *(WGPUDevice*)ud = d;
    }, &device);

  assert(device);
  printf("WebGPU device acquired!\n");

  // 2) 캔버스 스왑체인
  WGPUSurface surface = nullptr;
  WGPUSwapChainDescriptor scd{};
  scd.usage = WGPUTextureUsage_RenderAttachment;
  scd.format = WGPUTextureFormat_BGRA8Unorm;
  scd.width  = 800; 
  scd.height = 600;
  scd.presentMode = WGPUPresentMode_Fifo;

  swapchain = wgpuDeviceCreateSwapChain(device, surface, &scd);
  assert(swapchain);
  printf("SwapChain created!\n");

  emscripten_request_animation_frame_loop(frame, nullptr);

  printf("WebGPU Sseob Renderer started successfully!\n");
  return 0;
}