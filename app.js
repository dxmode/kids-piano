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
  var btnResetSize = document.getElementById("btn-reset-size");

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
  }

  function restoreScroll(preserveRatio) {
    // Keep the view roughly centred after a resize/rescale.
    if (preserveRatio == null) return;
    var max = keyboardEl.offsetWidth - scrollEl.clientWidth;
    if (max < 0) max = 0;
    scrollEl.scrollLeft = max * preserveRatio;
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
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35; // internal safety ceiling, real volume via device buttons
      masterGain.connect(ctx.destination);
    }

    function unlock() {
      ensureContext();
      if (ctx.state === "suspended") {
        ctx.resume();
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
      voiceGain.gain.linearRampToValueAtTime(0.9, now + 0.008);
      voiceGain.gain.exponentialRampToValueAtTime(0.35, now + 0.35);

      var osc1 = ctx.createOscillator();
      osc1.type = "triangle";
      osc1.frequency.value = freq;

      var osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2;
      var osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.15;

      osc1.connect(filter);
      osc2.connect(osc2Gain);
      osc2Gain.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(masterGain);

      osc1.start(now);
      osc2.start(now);

      voices[ownerId] = { midi: midi, osc1: osc1, osc2: osc2, gain: voiceGain };
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
        v.osc2.stop(now + 0.17);
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
  //  - a 2-finger gesture on the keyboard is treated as pinch-resize
  // ---------------------------------------------------------------
  var activePointers = {}; // pointerId -> midi
  var pinch = null; // { startDist, startScale }

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

  function dist(t1, t2) {
    var dx = t1.clientX - t2.clientX;
    var dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onTouchStart(e) {
    e.preventDefault();
    AudioEngine.unlock();
    var touches = e.touches;

    if (touches.length >= 2) {
      // Switch to pinch mode: release any notes currently held.
      Object.keys(activePointers).forEach(releasePointer);
      pinch = { startDist: dist(touches[0], touches[1]), startScale: scalePct };
      return;
    }

    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      pressAt(t.identifier, t.clientX, t.clientY);
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    var touches = e.touches;

    if (pinch && touches.length >= 2) {
      var d = dist(touches[0], touches[1]);
      var ratio = d / pinch.startDist;
      var next = pinch.startScale * ratio;
      if (next < SCALE_MIN) next = SCALE_MIN;
      if (next > SCALE_MAX) next = SCALE_MAX;
      scalePct = next;
      render();
      return;
    }

    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (activePointers[t.identifier] == null) continue;
      pressAt(t.identifier, t.clientX, t.clientY);
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    if (pinch) {
      if (e.touches.length < 2) {
        pinch = null;
        writeScale(scalePct);
      }
    }
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

  btnResetSize.addEventListener("click", function () {
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
