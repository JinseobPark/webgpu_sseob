#include <webgpu/webgpu.h>
#include <emscripten/html5.h>
#include <cassert>

static WGPUDevice device;
static WGPUSwapChain swapchain;

EM_BOOL frame(double, void*) {
  WGPUTextureView view = wgpuSwapChainGetCurrentTextureView(swapchain);

  WGPURenderPassColorAttachment color{};
  color.view = view;
  color.loadOp = WGPULoadOp_Clear;
  color.clearValue = {0.1, 0.12, 0.16, 1.0};
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
  // 1) 어댑터/디바이스 요청 (브라우저가 제공하는 WebGPU)
  WGPUInstance instance = wgpuCreateInstance(nullptr);
  WGPURequestAdapterOptions opts{};
  WGPUAdapter adapter = nullptr;

  wgpuInstanceRequestAdapter(instance, &opts,
    [](WGPURequestAdapterStatus s, WGPUAdapter a, const char*, void* ud){
      if (s == WGPURequestAdapterStatus_Success) *(WGPUAdapter*)ud = a;
    }, &adapter);

  assert(adapter);
  wgpuAdapterRequestDevice(adapter, nullptr,
    [](WGPURequestDeviceStatus s, WGPUDevice d, const char*, void* ud){
      if (s == WGPURequestDeviceStatus_Success) *(WGPUDevice*)ud = d;
    }, &device);

  assert(device);

  // 2) 캔버스 스왑체인
  EmscriptenWebGLContextAttributes attr; emscripten_webgl_init_context_attributes(&attr);
  // 캔버스 핸들로부터 프레젠트 표면은 브라우저가 관리. Emscripten은 swapchain 유틸 제공.
  WGPUSurface surface = nullptr; // 최신 브리지에선 canvas와 surface 연결이 내부 처리
  WGPUSwapChainDescriptor scd{};
  scd.usage = WGPUTextureUsage_RenderAttachment;
  scd.format = WGPUTextureFormat_BGRA8Unorm;
  scd.width  = 800; scd.height = 600;
  scd.presentMode = WGPUPresentMode_Fifo;

  swapchain = wgpuDeviceCreateSwapChain(device, surface, &scd);

  emscripten_request_animation_frame_loop(frame, nullptr);
  return 0;
}
