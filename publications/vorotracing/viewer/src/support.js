// WebGPU + shader-f16 feature gate. Exposes initWebGPU() which either
// returns { adapter, device, format } or throws after rendering a
// browser-support error overlay.
//
// We also raise device-side limits to the adapter's maximums for the
// things foam scenes stress (large storage buffers, lots of bindings,
// large workgroup storage). WebGPU's defaults are conservative
// (~128 MB / buffer) and we want every byte the underlying GPU exposes.

function maxLimits(adapter) {
  const a = adapter.limits;
  return {
    maxStorageBufferBindingSize: a.maxStorageBufferBindingSize,
    maxBufferSize: a.maxBufferSize,
    maxStorageBuffersPerShaderStage: a.maxStorageBuffersPerShaderStage,
    maxBindGroups: a.maxBindGroups,
    maxBindingsPerBindGroup: a.maxBindingsPerBindGroup,
  };
}

export function showError(html) {
  const el = document.getElementById('error');
  el.innerHTML = `<div>${html}</div>`;
  el.hidden = false;
}

export async function initWebGPU() {
  if (!('gpu' in navigator)) {
    showError(
      `<b>WebGPU not available.</b><br><br>` +
      `This viewer needs WebGPU. Use Chrome or Edge 113+ on desktop, ` +
      `or Safari 26+. Firefox support is still behind a flag.<br><br>` +
      `A recorded fly-through is available on the project page if your ` +
      `browser can't run the viewer.`,
    );
    throw new Error('WebGPU not available');
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) {
    showError(`<b>No WebGPU adapter.</b><br>The browser couldn't find a GPU.`);
    throw new Error('no adapter');
  }

  if (!adapter.features.has('shader-f16')) {
    showError(
      `<b>shader-f16 not supported.</b><br><br>` +
      `This GPU/driver/browser combo doesn't expose the ` +
      `<code>shader-f16</code> WebGPU feature, which the foam kernel ` +
      `requires (the scene data is fp16 throughout).<br><br>` +
      `Chrome on desktop with a modern GPU should work.`,
    );
    throw new Error('shader-f16 missing');
  }

  // timestamp-query is optional — it powers the HUD's GPU-ms readout. Request
  // it when available so devices without it still run (the HUD just hides ms).
  const features = ['shader-f16'];
  if (adapter.features.has('timestamp-query')) features.push('timestamp-query');

  let device;
  try {
    device = await adapter.requestDevice({
      requiredFeatures: features,
      requiredLimits: maxLimits(adapter),
    });
  } catch (err) {
    showError(`<b>requestDevice failed:</b><br>${err.message}`);
    throw err;
  }

  device.lost.then((info) => {
    showError(`<b>GPU device lost:</b> ${info.reason} — ${info.message}`);
  });

  const format = navigator.gpu.getPreferredCanvasFormat();
  return { adapter, device, format };
}

function fmtMB(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function describeAdapter(adapter, device) {
  const info = adapter.info ?? {};
  const vendor = info.vendor || 'unknown';
  const arch = info.architecture || '';
  const desc = info.description || '';
  const lim = device.limits;
  return [
    `gpu     ${vendor}${arch ? ' / ' + arch : ''}${desc ? ' / ' + desc : ''}`,
    `f16     yes`,
    `storage ${fmtMB(lim.maxStorageBufferBindingSize)} / buffer (cap ${fmtMB(lim.maxBufferSize)})`,
  ].join('\n');
}
