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

  function computeBaseWidth() {
    var containerW = scrollEl.clientWidth;
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
  }

  // ---------------------------------------------------------------
  // Audio engine (Web Audio API, synthesized piano-ish tone)
  // ---------------------------------------------------------------
  var AudioEngine = (function () {
    var ctx = null;
    var masterGain = null;
    var voices = {}; // ownerId -> { midi, nodes }

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

    function start(ownerId, midi) {
      ensureContext();
      unlock();
      stop(ownerId); // release any note already held by this finger

      var freq = midiToFreq(midi);
      var now = ctx.currentTime;

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

      voices[ownerId] = { midi: midi, osc1: osc1, gain: voiceGain };
    }

    function stop(ownerId) {
      var v = voices[ownerId];
      if (!v) return;
      var now = ctx.currentTime;
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        v.osc1.stop(now + 0.17);
      } catch (e) {}
      delete voices[ownerId];
    }

    function stopAll() {
      Object.keys(voices).forEach(stop);
    }

    return { start: start, stop: stop, stopAll: stopAll, unlock: unlock, currentMidi: function (id) {
      return voices[id] ? voices[id].midi : null;
    } };
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
  }

  btnSizeMinus.addEventListener("click", function () { changeScale(-SCALE_STEP); });
  btnSizePlus.addEventListener("click", function () { changeScale(SCALE_STEP); });
  sizeLabel.addEventListener("click", function () {
    scalePct = SCALE_DEFAULT;
    writeScale(scalePct);
    render();
    scrollEl.scrollLeft = 0;
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
  //  Priming the AudioContext takes a moment on some Android devices.
  //  Doing it here (on the "tap to start" tap) means it's finished
  //  before the child taps their first real key, instead of causing
  //  a delay on that first note.
  // ---------------------------------------------------------------
  function dismissStart() {
    AudioEngine.unlock();
    tryLockLandscape();
    startOverlay.classList.add("is-hidden");
    startOverlay.removeEventListener("touchstart", dismissStart);
    startOverlay.removeEventListener("mousedown", dismissStart);
  }
  startOverlay.addEventListener("touchstart", function (e) {
    e.preventDefault();
    dismissStart();
  }, { passive: false });
  startOverlay.addEventListener("mousedown", dismissStart);

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
