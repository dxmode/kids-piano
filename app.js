(function () {
  "use strict";

  // ---------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------
  var MIN_MIDI = 48; // C3
  var MAX_MIDI = 84; // C6
  var SCALE_MIN = 60;
  var SCALE_MAX = 220;
  var SCALE_DEFAULT = 100;
  var STORAGE_SCALE = "kidsPianoKeyScalePct";
  var STORAGE_NAMES = "kidsPianoShowNames";

  var NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var WHITE_PITCH_CLASSES = { 0: true, 2: true, 4: true, 5: true, 7: true, 9: true, 11: true };
  // ひらがなの「どれみ」表記（白鍵のみ。黒鍵にはラベルを付けない）
  var HIRAGANA_DOREMI = { 0: "ど", 2: "れ", 4: "み", 5: "ふぁ", 7: "そ", 9: "ら", 11: "し" };

  // ---------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------
  var keyboardEl = document.getElementById("keyboard");
  var scrollEl = document.getElementById("keyboard-scroll");
  var btnNames = document.getElementById("btn-names");
  var btnSizeMinus = document.getElementById("btn-size-minus");
  var btnSizePlus = document.getElementById("btn-size-plus");
  var sizeLabel = document.getElementById("size-label");
  var btnScrollLeft = document.getElementById("btn-scroll-left");
  var btnScrollRight = document.getElementById("btn-scroll-right");
  var startOverlay = document.getElementById("start-overlay");
  var SCALE_STEP = 10;

  // ---------------------------------------------------------------
  // Build note list
  // ---------------------------------------------------------------
  var notes = []; // { midi, name, isWhite, whiteIndex }
  (function buildNotes() {
    var whiteIndex = 0;
    for (var midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
      var pc = midi % 12;
      var isWhite = !!WHITE_PITCH_CLASSES[pc];
      var label = isWhite ? HIRAGANA_DOREMI[pc] : ""; // 黒鍵はラベルなし
      var entry = { midi: midi, name: NOTE_NAMES[pc], label: label, isWhite: isWhite };
      if (isWhite) {
        entry.whiteIndex = whiteIndex;
        whiteIndex++;
      } else {
        entry.whiteIndex = whiteIndex; // boundary position (right edge of previous white key)
      }
      notes.push(entry);
    }
  })();

  var totalWhiteKeys = notes.filter(function (n) { return n.isWhite; }).length;

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  var showNames = readShowNames();
  var scalePct = readScale();
  var keyEls = {}; // midi -> element

  // ---------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------
  function readScale() {
    try {
      var v = parseFloat(localStorage.getItem(STORAGE_SCALE));
      if (!isNaN(v) && v >= SCALE_MIN && v <= SCALE_MAX) return v;
    } catch (e) {}
    return SCALE_DEFAULT;
  }
  function writeScale(v) {
    try { localStorage.setItem(STORAGE_SCALE, String(v)); } catch (e) {}
  }
  function readShowNames() {
    try {
      var v = localStorage.getItem(STORAGE_NAMES);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (e) {}
    return true; // default ON per spec
  }
  function writeShowNames(v) {
    try { localStorage.setItem(STORAGE_NAMES, v ? "1" : "0"); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // Layout / rendering
  // ---------------------------------------------------------------
  var baseWhiteWidth = 60; // px at 100% scale, recomputed on resize

  /*function computeBaseWidth() {
    var containerW = scrollEl.clientWidth;
    baseWhiteWidth = containerW / totalWhiteKeys;
  }*/
  function computeBaseWidth() {
  var containerW = scrollEl.clientWidth;
  var containerH = scrollEl.clientHeight;
  var keyboardW = keyboardEl.clientWidth;
  var keyboardH = keyboardEl.clientHeight;

  var stageEl = document.querySelector(".stage");
  var appEl = document.querySelector(".app");

  var debug = document.getElementById("debug-size");
  if (!debug) {
    debug = document.createElement("div");
    debug.id = "debug-size";
    debug.style.position = "fixed";
    debug.style.top = "0";
    debug.style.left = "0";
    debug.style.zIndex = "9999";
    debug.style.background = "#000";
    debug.style.color = "#fff";
    debug.style.padding = "8px";
    debug.style.fontSize = "14px";
    debug.style.fontFamily = "monospace";
  }

  debug.textContent =
    "window: " + window.innerWidth + " × " + window.innerHeight +
    "\napp: " + appEl.clientWidth + " × " + appEl.clientHeight +
    "\nstage: " + stageEl.clientWidth + " × " + stageEl.clientHeight +
    "\nscroll: " + containerW + " × " + containerH +
    "\nkeyboard: " + keyboardW + " × " + keyboardH;

  debug.style.whiteSpace = "pre";
  document.body.appendChild(debug);

  baseWhiteWidth = containerW / totalWhiteKeys;
}

  function render() {
    computeBaseWidth();
    var whiteW = baseWhiteWidth * (scalePct / 100);
    var blackW = whiteW * 0.6;

    keyboardEl.style.width = (whiteW * totalWhiteKeys) + "px";
    keyboardEl.innerHTML = "";
    keyEls = {};

    notes.forEach(function (n) {
      var el = document.createElement("div");
      el.dataset.midi = String(n.midi);

      if (n.isWhite) {
        el.className = "key white";
        el.style.width = whiteW + "px";
        el.style.left = "0px"; // flex-positioned, left unused for white keys
      } else {
        el.className = "key black";
        el.style.width = blackW + "px";
        el.style.left = (n.whiteIndex * whiteW - blackW / 2) + "px";
      }

      if (showNames && n.label) {
        var label = document.createElement("span");
        label.className = "note-label";
        label.textContent = n.label;
        el.appendChild(label);
      }

      keyboardEl.appendChild(el);
      keyEls[n.midi] = el;
    });

    sizeLabel.textContent = Math.round(scalePct) + "%";
    updateScrollArrows();
  }

  function updateScrollArrows() {
    var max = keyboardEl.offsetWidth - scrollEl.clientWidth;
    var canScroll = max > 2;
    btnScrollLeft.hidden = !canScroll || scrollEl.scrollLeft <= 2;
    btnScrollRight.hidden = !canScroll || scrollEl.scrollLeft >= max - 2;
  }

  // Small eased scroll animation (avoids relying on Element.scrollTo's
  // {behavior:"smooth"}, which iOS 12.5.8 Safari does not support).
  function animateScrollTo(target) {
    var start = scrollEl.scrollLeft;
    var change = target - start;
    var duration = 220;
    var startTime = null;

    function step(timestamp) {
      if (startTime === null) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var t = Math.min(1, elapsed / duration);
      var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      scrollEl.scrollLeft = start + change * eased;
      updateScrollArrows();
      if (t < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function scrollByPage(direction) {
    var max = keyboardEl.offsetWidth - scrollEl.clientWidth;
    if (max <= 0) return;
    var step = scrollEl.clientWidth * 0.8;
    var target = scrollEl.scrollLeft + direction * step;
    if (target < 0) target = 0;
    if (target > max) target = max;
    animateScrollTo(target);
  }

  btnScrollLeft.addEventListener("click", function () { scrollByPage(-1); });
  btnScrollRight.addEventListener("click", function () { scrollByPage(1); });
  scrollEl.addEventListener("scroll", updateScrollArrows);

  // ---------------------------------------------------------------
  // Audio engine
  //  Primary: real recorded piano notes (Salamander Grand Piano,
  //  CC-BY 3.0, Alexander Holm), pitch-shifted to nearby notes so a
  //  small set of samples covers the full C3–C6 range.
  //  Fallback: the original synthesized tone, used only if sample
  //  loading ever fails (e.g. first-ever launch with no network).
  // ---------------------------------------------------------------
  var SAMPLE_DEFS = [
    { midi: 48, file: "samples/C3.mp3" },
    { midi: 51, file: "samples/Ds3.mp3" },
    { midi: 54, file: "samples/Fs3.mp3" },
    { midi: 57, file: "samples/A3.mp3" },
    { midi: 60, file: "samples/C4.mp3" },
    { midi: 63, file: "samples/Ds4.mp3" },
    { midi: 66, file: "samples/Fs4.mp3" },
    { midi: 69, file: "samples/A4.mp3" },
    { midi: 72, file: "samples/C5.mp3" },
    { midi: 75, file: "samples/Ds5.mp3" },
    { midi: 78, file: "samples/Fs5.mp3" },
    { midi: 81, file: "samples/A5.mp3" },
    { midi: 84, file: "samples/C6.mp3" }
  ];

  var AudioEngine = (function () {
    var ctx = null;
    var masterGain = null;
    var voices = {}; // ownerId -> { gain, nodes: [...] }
    var sampleBuffers = {}; // midi -> AudioBuffer
    var samplesReady = false;

    function ensureContext() {
      if (ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC({ latencyHint: "interactive" });
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35; // internal safety ceiling, real volume via device buttons
      masterGain.connect(ctx.destination);
    }

    // Some browsers (notably Chrome on Android) report the AudioContext as
    // "running" slightly before the audio hardware is actually warmed up,
    // which shows up as a delay on the very first note. Playing one silent,
    // zero-length buffer right after resume() forces the pipeline open.
    function primeSilently() {
      try {
        var buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        var src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(0);
      } catch (e) {}
    }

    function unlock() {
      ensureContext();
      if (ctx.state === "suspended") {
        ctx.resume().then(primeSilently);
      }
    }

    function midiToFreq(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function nearestSample(midi) {
      var best = null;
      var bestDist = Infinity;
      for (var i = 0; i < SAMPLE_DEFS.length; i++) {
        var d = Math.abs(SAMPLE_DEFS[i].midi - midi);
        if (d < bestDist) {
          bestDist = d;
          best = SAMPLE_DEFS[i];
        }
      }
      return best;
    }

    // Loads every sample in parallel and decodes it. Resolves once all
    // attempts are finished (successful or not) — a partial or total
    // failure just means those notes fall back to the synth tone rather
    // than the app breaking.
    function loadSamples(onProgress) {
      ensureContext();
      var total = SAMPLE_DEFS.length;
      var done = 0;

      var tasks = SAMPLE_DEFS.map(function (def) {
        return fetch(def.file)
          .then(function (res) { return res.arrayBuffer(); })
          .then(function (data) {
            return new Promise(function (resolve, reject) {
              // decodeAudioData has both a promise form and an older
              // callback form; the callback form is safest on old Safari.
              ctx.decodeAudioData(data, resolve, reject);
            });
          })
          .then(function (audioBuffer) {
            sampleBuffers[def.midi] = audioBuffer;
          })
          .catch(function () {
            // This one note stays on the synth fallback.
          })
          .then(function () {
            done++;
            if (onProgress) onProgress(done, total);
          });
      });

      return Promise.all(tasks).then(function () {
        samplesReady = Object.keys(sampleBuffers).length > 0;
      });
    }

    function startSampleVoice(ownerId, midi, def, now) {
      var buffer = sampleBuffers[def.midi];
      var rate = Math.pow(2, (midi - def.midi) / 12);

      var voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(0, now);
      voiceGain.gain.linearRampToValueAtTime(1, now + 0.004);

      var src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      src.connect(voiceGain);
      voiceGain.connect(masterGain);
      src.start(now);

      voices[ownerId] = { gain: voiceGain, nodes: [src] };
    }

    function startSynthVoice(ownerId, midi, now) {
      var freq = midiToFreq(midi);

      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 5200;
      filter.Q.value = 0.4;

      var voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(0, now);
      voiceGain.gain.linearRampToValueAtTime(0.9, now + 0.006);
      voiceGain.gain.exponentialRampToValueAtTime(0.35, now + 0.35);

      var osc1 = ctx.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.value = freq;
      osc1.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(masterGain);
      osc1.start(now);

      voices[ownerId] = { gain: voiceGain, nodes: [osc1] };
    }

    function start(ownerId, midi) {
      ensureContext();
      unlock();
      stop(ownerId); // release any note already held by this finger

      var now = ctx.currentTime;
      var def = samplesReady ? nearestSample(midi) : null;

      if (def && sampleBuffers[def.midi]) {
        startSampleVoice(ownerId, midi, def, now);
      } else {
        startSynthVoice(ownerId, midi, now);
      }
    }

    function stop(ownerId) {
      var v = voices[ownerId];
      if (!v) return;
      var now = ctx.currentTime;
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        v.nodes.forEach(function (n) {
          try { n.stop(now + 0.95); } catch (e) {}
        });
      } catch (e) {}
      delete voices[ownerId];
    }

    function stopAll() {
      Object.keys(voices).forEach(stop);
    }

    return {
      start: start,
      stop: stop,
      stopAll: stopAll,
      unlock: unlock,
      loadSamples: loadSamples
    };
  })();

  // ---------------------------------------------------------------
  // Touch / pointer handling
  //  - up to 1 finger per note, multitouch across fingers
  //  - sliding a finger across keys glides to the new note
  //  - keyboard size is changed via the +/- buttons (see below),
  //    not by pinch, since 2-finger pinch detection proved unreliable
  //    across devices (notably Android Chrome)
  // ---------------------------------------------------------------
  var activePointers = {}; // pointerId -> midi

  function keyElFromPoint(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== keyboardEl && !el.classList.contains("key")) {
      el = el.parentElement;
    }
    if (el && el.classList && el.classList.contains("key")) return el;
    return null;
  }

  function setActive(midi, on) {
    var el = keyEls[midi];
    if (!el) return;
    if (on) el.classList.add("active");
    else el.classList.remove("active");
  }

  function pressAt(pointerId, x, y) {
    var el = keyElFromPoint(x, y);
    if (!el) return;
    var midi = parseInt(el.dataset.midi, 10);
    var prevMidi = activePointers[pointerId];
    if (prevMidi === midi) return;
    if (prevMidi != null) setActive(prevMidi, false);
    activePointers[pointerId] = midi;
    setActive(midi, true);
    AudioEngine.start(pointerId, midi);
  }

  function releasePointer(pointerId) {
    var midi = activePointers[pointerId];
    if (midi != null) setActive(midi, false);
    delete activePointers[pointerId];
    AudioEngine.stop(pointerId);
  }

  function onTouchStart(e) {
    e.preventDefault();
    AudioEngine.unlock();

    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      pressAt(t.identifier, t.clientX, t.clientY);
    }
  }

  function onTouchMove(e) {
    e.preventDefault();

    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (activePointers[t.identifier] == null) continue;
      pressAt(t.identifier, t.clientX, t.clientY);
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      releasePointer(t.identifier);
    }
  }

  // Mouse fallback for desktop testing
  var mouseDown = false;
  function onMouseDown(e) {
    mouseDown = true;
    AudioEngine.unlock();
    pressAt("mouse", e.clientX, e.clientY);
  }
  function onMouseMove(e) {
    if (!mouseDown) return;
    pressAt("mouse", e.clientX, e.clientY);
  }
  function onMouseUp() {
    if (!mouseDown) return;
    mouseDown = false;
    releasePointer("mouse");
  }

  keyboardEl.addEventListener("touchstart", onTouchStart, { passive: false });
  keyboardEl.addEventListener("touchmove", onTouchMove, { passive: false });
  keyboardEl.addEventListener("touchend", onTouchEnd, { passive: false });
  keyboardEl.addEventListener("touchcancel", onTouchEnd, { passive: false });

  keyboardEl.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  // ---------------------------------------------------------------
  // Top bar controls
  // ---------------------------------------------------------------
  btnNames.addEventListener("click", function () {
    showNames = !showNames;
    writeShowNames(showNames);
    btnNames.classList.toggle("is-on", showNames);
    btnNames.setAttribute("aria-pressed", showNames ? "true" : "false");
    render();
  });

  function clampScale(v) {
    if (v < SCALE_MIN) return SCALE_MIN;
    if (v > SCALE_MAX) return SCALE_MAX;
    return v;
  }

  function changeScale(delta) {
    var ratioBefore = keyboardEl.offsetWidth > scrollEl.clientWidth
      ? scrollEl.scrollLeft / (keyboardEl.offsetWidth - scrollEl.clientWidth)
      : 0;
    scalePct = clampScale(scalePct + delta);
    writeScale(scalePct);
    render();
    var max = keyboardEl.offsetWidth - scrollEl.clientWidth;
    scrollEl.scrollLeft = max > 0 ? max * ratioBefore : 0;
    updateScrollArrows();
  }

  btnSizeMinus.addEventListener("click", function () { changeScale(-SCALE_STEP); });
  btnSizePlus.addEventListener("click", function () { changeScale(SCALE_STEP); });
  sizeLabel.addEventListener("click", function () {
    scalePct = SCALE_DEFAULT;
    writeScale(scalePct);
    render();
    scrollEl.scrollLeft = 0;
    updateScrollArrows();
  });

  // ---------------------------------------------------------------
  // Resize / orientation
  // ---------------------------------------------------------------
  window.addEventListener("resize", function () {
    render();
  });

  // ---------------------------------------------------------------
  // Orientation lock (best-effort)
  //  iOS Safari has no Screen Orientation Lock API at all, even when
  //  added to the home screen — this is a hard platform limitation,
  //  so on iPad this call simply does nothing and the rotate-hint
  //  screen stays the fallback. On Android, this reinforces the
  //  manifest's "orientation": "landscape" hint.
  // ---------------------------------------------------------------
  function tryLockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(function () {});
      }
    } catch (e) {}
  }

  // ---------------------------------------------------------------
  // Start overlay
  //  Tapping here does three things before the piano is revealed:
  //  primes the AudioContext, tries to lock landscape (Android), and
  //  loads+decodes the real piano samples. Doing all of this here
  //  (instead of on the first actual key press) means the child's
  //  first real note has zero loading delay.
  // ---------------------------------------------------------------
  var startText = document.getElementById("start-text");

  function dismissStart() {
    startOverlay.removeEventListener("touchstart", onStartTap);
    startOverlay.removeEventListener("mousedown", onStartTap);

    AudioEngine.unlock();
    tryLockLandscape();
    startText.textContent = "よみこみちゅう…";

    AudioEngine.loadSamples(function (done, total) {
      startText.textContent = "よみこみちゅう… (" + done + "/" + total + ")";
    }).then(function () {
      startOverlay.classList.add("is-hidden");
    });
  }
  function onStartTap(e) {
    if (e.cancelable) e.preventDefault();
    dismissStart();
  }
  startOverlay.addEventListener("touchstart", onStartTap, { passive: false });
  startOverlay.addEventListener("mousedown", onStartTap);

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  btnNames.classList.toggle("is-on", showNames);
  btnNames.setAttribute("aria-pressed", showNames ? "true" : "false");
  render();

  // Register service worker for offline use
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    });
  }
})();
