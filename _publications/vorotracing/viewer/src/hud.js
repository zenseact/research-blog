// HUD: a top-left status block, a centered landing/gallery overlay for
// picking or dropping a scene, a "back to gallery" button, and a settings
// panel (createTweaks). All DOM markup is built here so style.css is the
// only other place layout concerns live.

export function createHud() {
  const root = document.body;

  // Top-left status (FPS + GPU info + scene summary once loaded).
  let status = document.getElementById('hud-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'hud-status';
    root.appendChild(status);
  }

  // Centered landing / gallery / progress overlay.
  const overlay = document.createElement('div');
  overlay.id = 'landing';
  overlay.innerHTML = `
    <div class="landing-card">
      <div class="landing-title">VoroTracing</div>
      <div class="landing-sub">pick a scene or drop a <code>.foam</code> file</div>
      <div class="gallery"></div>
      <div class="landing-progress" hidden></div>
    </div>
  `;
  root.appendChild(overlay);

  const progress = overlay.querySelector('.landing-progress');
  const sub = overlay.querySelector('.landing-sub');
  const gallery = overlay.querySelector('.gallery');

  // "← gallery" button (top-right), hidden until a scene is loaded.
  const back = document.createElement('button');
  back.id = 'back-to-gallery';
  back.textContent = '← gallery';
  back.hidden = true;
  root.appendChild(back);

  function setStatus(text) {
    status.textContent = text;
  }

  function setLanding(visible) {
    overlay.hidden = !visible;
  }

  function setProgress(message) {
    if (!message) {
      progress.hidden = true;
      progress.textContent = '';
      return;
    }
    progress.hidden = false;
    progress.textContent = message;
  }

  function setLandingSubtitle(text) {
    sub.textContent = text;
  }

  function setBackVisible(visible) {
    back.hidden = !visible;
  }

  function onBack(cb) {
    back.addEventListener('click', cb);
  }

  // Render the hosted gallery. `models` is [{ name, url, size }]; clicking a card calls
  // onSelect({ url, label }). A trailing tile holds a file picker so users
  // can also browse for a local .foam (in addition to drag-drop).
  function setGallery(models, onSelect) {
    gallery.textContent = '';
    for (const m of models ?? []) {
      const card = document.createElement('button');
      card.className = 'gallery-card';
      card.innerHTML = `
        <span class="gallery-name">${m.name ?? m.url}</span>
        <span class="gallery-size">${m.size} download</span>
      `;
      card.addEventListener('click', () => onSelect({ url: m.url, label: m.name ?? m.url }));
      gallery.appendChild(card);
    }

    // File-picker tile (doubles as the "drop here" hint).
    const tile = document.createElement('label');
    tile.className = 'gallery-card gallery-drop';
    tile.innerHTML = `<span class="gallery-name">+ open .foam</span>`;
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.foam';
    picker.hidden = true;
    picker.addEventListener('change', () => {
      const f = picker.files?.[0];
      if (f) onSelect({ file: f, label: f.name });
      picker.value = '';
    });
    tile.appendChild(picker);
    gallery.appendChild(tile);
  }

  return {
    root, status, overlay,
    setStatus, setLanding, setProgress, setLandingSubtitle,
    setGallery, setBackVisible, onBack,
  };
}

// Install drag-and-drop on the whole window. `onFile(file)` is called
// when the user drops one .foam file. Multiple files / wrong type
// trigger a brief subtitle flash.
export function installDropZone(window, onFile, hud) {
  let dragDepth = 0;

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function onDragEnter(e) {
    e.preventDefault();
    dragDepth++;
    document.body.classList.add('drag-over');
  }

  function onDragLeave(e) {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) document.body.classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('drag-over');
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length === 0) return;
    if (files.length > 1) {
      hud.setLandingSubtitle('drop a single .foam file');
      return;
    }
    onFile(files[0]);
  }

  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);
}

// Settings panel. `groups` is [{ label, keys: [{ key, label, type, ... }] }]
// where type is 'range' (min/max/step, with a live readout), 'select'
// (options: [{value,label}] or [value]), or 'number'. `onChange` is called
// with { [key]: value } on every edit. Returns { panel, setValues } where
// setValues updates inputs WITHOUT firing onChange (avoids feedback loops
// when code drives a value back into the panel, e.g. the −/= FOV keys).
export function createTweaks(initial, groups, onChange) {
  const panel = document.createElement('div');
  panel.id = 'tweaks';
  document.body.appendChild(panel);

  const inputs = {};
  const readouts = {};

  for (const group of groups) {
    const heading = document.createElement('div');
    heading.className = 'tweak-section';
    heading.textContent = group.label;
    panel.appendChild(heading);

    for (const k of group.keys) {
      const row = document.createElement('label');
      row.className = 'tweak-row';
      const name = document.createElement('span');
      name.className = 'tweak-label';
      name.textContent = k.label;
      row.appendChild(name);

      let input;
      if (k.type === 'select') {
        input = document.createElement('select');
        for (const opt of k.options) {
          const o = document.createElement('option');
          o.value = String(opt.value ?? opt);
          o.textContent = String(opt.label ?? opt);
          input.appendChild(o);
        }
        input.value = String(initial[k.key]);
        input.addEventListener('change', () => onChange({ [k.key]: input.value }));
      } else if (k.type === 'range') {
        input = document.createElement('input');
        input.type = 'range';
        input.min = String(k.min ?? 0);
        input.max = String(k.max ?? 1);
        input.step = String(k.step ?? 1);
        input.value = String(initial[k.key]);
        const readout = document.createElement('span');
        readout.className = 'tweak-val';
        readout.textContent = String(initial[k.key]);
        readouts[k.key] = readout;
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          readout.textContent = String(Math.round(v));
          if (!Number.isNaN(v)) onChange({ [k.key]: v });
        });
        row.appendChild(input);
        row.appendChild(readout);
        panel.appendChild(row);
        inputs[k.key] = input;
        continue;
      } else {
        input = document.createElement('input');
        input.type = 'number';
        input.step = String(k.step ?? 0.05);
        input.min = String(k.min ?? 0);
        input.max = String(k.max ?? 5);
        input.value = String(initial[k.key]);
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          if (!Number.isNaN(v)) onChange({ [k.key]: v });
        });
      }

      row.appendChild(input);
      panel.appendChild(row);
      inputs[k.key] = input;
    }
  }

  function setValues(values) {
    for (const k of Object.keys(values)) {
      if (inputs[k]) inputs[k].value = String(values[k]);
      if (readouts[k]) readouts[k].textContent = String(Math.round(values[k]));
    }
  }

  // Let callers retune a range's bounds at runtime (e.g. FOV max changes
  // when the projection flips between pinhole and fisheye).
  function setRange(key, min, max) {
    const input = inputs[key];
    if (!input) return;
    input.min = String(min);
    input.max = String(max);
  }

  return { panel, setValues, setRange };
}
