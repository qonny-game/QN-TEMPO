(() => {
  'use strict';

  // ---------- Haptics (QNAUDIO player-ui-shared.js と同じ実装) ----------
  function hapticTap() { if (navigator.vibrate) navigator.vibrate(10); }
  function hapticTick() { if (navigator.vibrate) navigator.vibrate(6); }
  function hapticSuccess() { if (navigator.vibrate) navigator.vibrate([15, 40, 15]); }

  // ---------- State ----------
  // subdivision: 'straight' (1音/拍) | 'triplet' (3連=3音均等) | 'triplet-hollow' (3連の中抜き=1,3音目のみ)
  const state = {
    bpm: 120,
    beatsPerBar: 4,
    accents: [true, false, false, false],
    subdivisions: ['straight', 'straight', 'straight', 'straight'],
    subdivKind: 'straight',
    currentBeat: -1,
    playing: false,
    soundKind: 0, // 0: click 1: beep 2: wood
  };

  const SOUND_LABELS = ['クリック', 'ビープ', 'ウッド'];

  const TEMPO_NAMES = [
    [40, 'Grave'], [50, 'Largo'], [60, 'Lento'], [66, 'Adagio'],
    [76, 'Andante'], [92, 'Andantino'], [108, 'Moderato'], [120, 'Allegretto'],
    [140, 'Allegro'], [160, 'Vivace'], [176, 'Presto'], [999, 'Prestissimo']
  ];
  function tempoName(bpm) {
    for (const [max, name] of TEMPO_NAMES) if (bpm <= max) return name;
    return 'Prestissimo';
  }

  function slotsFor(kind) {
    if (kind === 'triplet') return [true, true, true];
    if (kind === 'triplet-hollow') return [true, false, true];
    return [true];
  }

  // ---------- DOM refs ----------
  const beatsRow = document.getElementById('beatsRow');
  const beatCounter = document.getElementById('beatCounter');
  const bpmVal = document.getElementById('bpmVal');
  const bpmSlider = document.getElementById('bpmSlider');
  const tempoNameEl = document.getElementById('tempoName');
  const bpmMinus = document.getElementById('bpmMinus');
  const bpmPlus = document.getElementById('bpmPlus');
  const bpmMinus2 = document.getElementById('bpmMinus2');
  const bpmPlus2 = document.getElementById('bpmPlus2');
  const tapBtn = document.getElementById('tapBtn');
  const tapReadout = document.getElementById('tapReadout');
  const playToggle = document.getElementById('playToggle');
  const playIcon = document.getElementById('playIcon');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundToggleLabel = document.getElementById('soundToggleLabel');

  const sigToggleBtn = document.getElementById('sigToggleBtn');
  const sigToggleValue = document.getElementById('sigToggleValue');
  const sigPopup = document.getElementById('sigPopup');
  const sigBackdrop = document.getElementById('sigBackdrop');
  const sigGrid = document.getElementById('sigGrid');
  const sigCloseBtn = document.getElementById('sigCloseBtn');

  const subdivToggleBtn = document.getElementById('subdivToggleBtn');
  const subdivToggleValue = document.getElementById('subdivToggleValue');
  const subdivPopup = document.getElementById('subdivPopup');
  const subdivBackdrop = document.getElementById('subdivBackdrop');
  const subdivCloseBtn = document.getElementById('subdivCloseBtn');
  const subdivChoices = document.querySelectorAll('.subdiv-choice');

  const topControls = document.getElementById('topControls');
  const topControlsSpacer = document.getElementById('topControlsSpacer');

  // ---------- Spacer sync (QNAUDIOの固定フッター分の余白確保と同じ考え方) ----------
  function syncSpacer() {
    topControlsSpacer.style.height = topControls.offsetHeight + 'px';
  }
  window.addEventListener('resize', syncSpacer);

  // ---------- Render beats ----------
  function renderBeats() {
    beatsRow.innerHTML = '';
    for (let i = 0; i < state.beatsPerBar; i++) {
      const dot = document.createElement('div');
      dot.className = 'beat-dot' + (state.accents[i] ? ' accent' : '');
      dot.dataset.index = i;

      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = i + 1;
      dot.appendChild(n);

      const slots = slotsFor(state.subdivisions[i] || 'straight');
      if (slots.length > 1) {
        const ticks = document.createElement('span');
        ticks.className = 'subticks';
        slots.forEach(hit => {
          const t = document.createElement('i');
          t.className = hit ? 'hit' : 'ghost-tick';
          ticks.appendChild(t);
        });
        dot.appendChild(ticks);
      }
      beatsRow.appendChild(dot);

      let pressTimer = null;
      const onDown = () => {
        pressTimer = setTimeout(() => {
          state.accents[i] = !state.accents[i];
          dot.classList.add('editing');
          renderBeats();
          hapticTick();
        }, 420);
      };
      const onUp = () => clearTimeout(pressTimer);
      dot.addEventListener('touchstart', onDown, { passive: true });
      dot.addEventListener('touchend', onUp);
      dot.addEventListener('touchmove', onUp);
      dot.addEventListener('mousedown', onDown);
      dot.addEventListener('mouseup', onUp);
      dot.addEventListener('mouseleave', onUp);
    }
    updateBeatCounter();
  }

  function updateBeatCounter() {
    const shown = state.currentBeat < 0 ? 1 : state.currentBeat + 1;
    beatCounter.textContent = `${shown} / ${state.beatsPerBar}`;
  }

  function presetLabelFor(n) {
    const map = { 2: '2/4', 3: '3/4', 4: '4/4', 6: '6/8', 8: '8/8' };
    return map[n] || `${n}拍`;
  }

  function setBeatsPerBar(n) {
    state.beatsPerBar = n;
    const newAccents = [];
    const newSubdivs = [];
    for (let i = 0; i < n; i++) {
      newAccents.push(state.accents[i] !== undefined ? state.accents[i] : (i === 0));
      newSubdivs.push(state.subdivKind);
    }
    if (!newAccents.some(Boolean)) newAccents[0] = true;
    state.accents = newAccents;
    state.subdivisions = newSubdivs;
    state.currentBeat = -1;
    renderBeats();
    sigToggleValue.textContent = presetLabelFor(n);
  }

  // ---------- Time signature popup ----------
  const SIG_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9];
  SIG_OPTIONS.forEach(n => {
    const cell = document.createElement('div');
    cell.className = 'choice-cell' + (n === state.beatsPerBar ? ' selected' : '');
    cell.textContent = presetLabelFor(n);
    cell.dataset.beats = n;
    cell.addEventListener('click', () => {
      hapticTap();
      sigGrid.querySelectorAll('.choice-cell').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      setBeatsPerBar(n);
    });
    sigGrid.appendChild(cell);
  });

  function openPopup(popup, backdrop) {
    hapticTap();
    popup.classList.add('open');
    backdrop.classList.add('open');
  }
  function closePopup(popup, backdrop) {
    popup.classList.remove('open');
    backdrop.classList.remove('open');
  }

  sigToggleBtn.addEventListener('click', () => openPopup(sigPopup, sigBackdrop));
  sigCloseBtn.addEventListener('click', () => { hapticTap(); closePopup(sigPopup, sigBackdrop); });
  sigBackdrop.addEventListener('click', () => closePopup(sigPopup, sigBackdrop));

  // ---------- Subdivision popup ----------
  subdivToggleBtn.addEventListener('click', () => openPopup(subdivPopup, subdivBackdrop));
  subdivCloseBtn.addEventListener('click', () => { hapticTap(); closePopup(subdivPopup, subdivBackdrop); });
  subdivBackdrop.addEventListener('click', () => closePopup(subdivPopup, subdivBackdrop));

  const SUBDIV_LABELS = { straight: '通常', triplet: '3連', 'triplet-hollow': '中抜き' };
  subdivChoices.forEach(choice => {
    choice.addEventListener('click', () => {
      hapticTap();
      subdivChoices.forEach(c => c.classList.remove('selected'));
      choice.classList.add('selected');
      const kind = choice.dataset.subdiv;
      state.subdivKind = kind;
      state.subdivisions = state.subdivisions.map(() => kind);
      subdivToggleValue.textContent = SUBDIV_LABELS[kind];
      renderBeats();
    });
  });

  // ---------- BPM controls ----------
  function updateFillVar() {
    const min = parseInt(bpmSlider.min, 10);
    const max = parseInt(bpmSlider.max, 10);
    const pct = ((state.bpm - min) / (max - min)) * 100;
    bpmSlider.style.setProperty('--fill', pct + '%');
  }

  function setBpm(v) {
    v = Math.max(30, Math.min(260, Math.round(v)));
    state.bpm = v;
    bpmVal.textContent = v;
    bpmSlider.value = v;
    tempoNameEl.textContent = tempoName(v);
    updateFillVar();
  }

  bpmSlider.addEventListener('input', () => setBpm(parseInt(bpmSlider.value, 10)));

  function stepBpm(dir) { setBpm(state.bpm + dir); hapticTick(); }
  bpmMinus.addEventListener('click', () => stepBpm(-1));
  bpmPlus.addEventListener('click', () => stepBpm(1));
  bpmMinus2.addEventListener('click', () => stepBpm(-1));
  bpmPlus2.addEventListener('click', () => stepBpm(1));

  let holdInterval = null;
  function attachHold(btn, dir) {
    const start = () => { holdInterval = setInterval(() => setBpm(state.bpm + dir), 90); };
    const stop = () => clearInterval(holdInterval);
    btn.addEventListener('touchstart', () => { setTimeout(start, 350); }, { passive: true });
    btn.addEventListener('touchend', stop);
    btn.addEventListener('mousedown', () => { setTimeout(start, 350); });
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
  }
  attachHold(bpmMinus, -1);
  attachHold(bpmPlus, 1);
  attachHold(bpmMinus2, -1);
  attachHold(bpmPlus2, 1);

  // ---------- TAP tempo ----------
  let tapTimes = [];
  tapBtn.addEventListener('click', () => {
    const now = performance.now();
    tapTimes = tapTimes.filter(t => now - t < 2200);
    tapTimes.push(now);
    if (tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = 60000 / avg;
      setBpm(bpm);
      tapReadout.textContent = Math.round(bpm) + ' BPM';
      hapticSuccess();
    } else {
      tapReadout.textContent = '—';
      hapticTap();
    }
  });

  // ---------- Sound engine ----------
  let audioCtx = null;
  function ensureCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playClick(time, accented) {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    let freq, dur, type;
    if (state.soundKind === 0) { freq = accented ? 1500 : 1000; dur = 0.045; type = 'square'; }
    else if (state.soundKind === 1) { freq = accented ? 1760 : 880; dur = 0.09; type = 'sine'; }
    else { freq = accented ? 900 : 600; dur = 0.06; type = 'triangle'; }

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(accented ? 0.9 : 0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  // ---------- Scheduler (look-ahead方式でズレを防止) ----------
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let beatIndex = 0;
  const SCHEDULE_AHEAD = 0.12;
  const LOOKAHEAD_MS = 25;
  const scheduledQueue = [];
  let visualRAF = null;

  function secondsPerBeat() { return 60.0 / state.bpm; }

  function scheduler() {
    const ctx = ensureCtx();
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const beatAccented = !!state.accents[beatIndex];
      const slots = slotsFor(state.subdivisions[beatIndex] || 'straight');
      const beatDur = secondsPerBeat();
      const slotDur = beatDur / slots.length;

      slots.forEach((shouldPlay, slotIdx) => {
        const slotTime = nextNoteTime + slotIdx * slotDur;
        if (shouldPlay) {
          const accented = beatAccented && slotIdx === 0;
          playClick(slotTime, accented);
        }
        if (slotIdx === 0) scheduledQueue.push({ time: slotTime, beat: beatIndex });
      });

      beatIndex = (beatIndex + 1) % state.beatsPerBar;
      nextNoteTime += beatDur;
    }
  }

  function visualLoop() {
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    while (scheduledQueue.length && scheduledQueue[0].time <= now) {
      const item = scheduledQueue.shift();
      state.currentBeat = item.beat;
      flashBeat(item.beat);
    }
    if (state.playing) visualRAF = requestAnimationFrame(visualLoop);
  }

  function flashBeat(i) {
    updateBeatCounter();
    const dots = beatsRow.querySelectorAll('.beat-dot');
    dots.forEach(d => d.classList.remove('active'));
    const target = dots[i];
    if (target) {
      target.classList.add('active');
      setTimeout(() => target.classList.remove('active'), 110);
    }
  }

  function start() {
    const ctx = ensureCtx();
    state.playing = true;
    beatIndex = 0;
    state.currentBeat = -1;
    scheduledQueue.length = 0;
    nextNoteTime = ctx.currentTime + 0.06;
    schedulerTimer = setInterval(scheduler, LOOKAHEAD_MS);
    visualRAF = requestAnimationFrame(visualLoop);
    playToggle.classList.add('playing');
    playIcon.innerHTML = '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
  }

  function stop() {
    state.playing = false;
    clearInterval(schedulerTimer);
    cancelAnimationFrame(visualRAF);
    state.currentBeat = -1;
    beatsRow.querySelectorAll('.beat-dot').forEach(d => d.classList.remove('active'));
    updateBeatCounter();
    playToggle.classList.remove('playing');
    playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  }

  playToggle.addEventListener('click', () => {
    ensureCtx();
    hapticTap();
    if (state.playing) stop(); else start();
  });

  // ---------- Sound toggle ----------
  soundToggleBtn.addEventListener('click', () => {
    hapticTap();
    state.soundKind = (state.soundKind + 1) % 3;
    soundToggleLabel.textContent = SOUND_LABELS[state.soundKind];
    soundToggleBtn.classList.toggle('active', state.soundKind !== 0);
  });

  // ---------- Init ----------
  setBpm(120);
  renderBeats();
  syncSpacer();
})();
