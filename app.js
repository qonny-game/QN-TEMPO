(() => {
  'use strict';

  // ---------- State ----------
  // subdivision per beat: 'straight' | 'triplet' | 'triplet-hollow'
  //   straight        -> 1 click on the beat
  //   triplet         -> 3 even clicks per beat
  //   triplet-hollow  -> 3-slot triplet with the middle slot silent (1st & 3rd only)
  const state = {
    bpm: 120,
    beatsPerBar: 4,
    accents: [true, false, false, false], // per-beat accent flags
    subdivisions: ['straight','straight','straight','straight'], // per-beat subdivision
    currentBeat: -1,
    playing: false,
    soundKind: 0, // 0: click, 1: beep, 2: wood
  };

  const SUBDIV_ORDER = ['straight','triplet','triplet-hollow'];
  function slotsFor(subdiv){
    if (subdiv === 'triplet') return [true, true, true];
    if (subdiv === 'triplet-hollow') return [true, false, true];
    return [true]; // straight
  }

  const TEMPO_NAMES = [
    [40, 'Grave'], [50, 'Largo'], [60, 'Lento'], [66, 'Adagio'],
    [76, 'Andante'], [92, 'Andantino'], [108, 'Moderato'], [120, 'Allegretto'],
    [140, 'Allegro'], [160, 'Vivace'], [176, 'Presto'], [999, 'Prestissimo']
  ];
  function tempoName(bpm){
    for (const [max, name] of TEMPO_NAMES) if (bpm <= max) return name;
    return 'Prestissimo';
  }

  // ---------- DOM ----------
  const beatsRow = document.getElementById('beatsRow');
  const beatCounter = document.getElementById('beatCounter');
  const bpmNum = document.getElementById('bpmNum');
  const bpmSlider = document.getElementById('bpmSlider');
  const tempoNameEl = document.getElementById('tempoName');
  const playBtn = document.getElementById('playBtn');
  const playIcon = document.getElementById('playIcon');
  const sigRow = document.getElementById('sigRow');
  const sigLabel = document.getElementById('sigLabel').querySelector('b');
  const tapLabel = document.getElementById('tapLabel').querySelector('b');
  const tapBtn = document.getElementById('tapBtn');
  const minusBtn = document.getElementById('minus');
  const plusBtn = document.getElementById('plus');
  const soundToggle = document.getElementById('soundToggle');
  const customSigBtn = document.getElementById('customSigBtn');
  const customSigModal = document.getElementById('customSigModal');
  const customSigClose = document.getElementById('customSigClose');
  const customBeatsGrid = document.getElementById('customBeatsGrid');
  const subdivRow = document.getElementById('subdivRow');

  // ---------- Render beats ----------
  function renderBeats(){
    beatsRow.innerHTML = '';
    for (let i = 0; i < state.beatsPerBar; i++){
      const dot = document.createElement('div');
      dot.className = 'beat-dot' + (state.accents[i] ? ' accent' : '');
      dot.dataset.index = i;
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = i + 1;
      dot.appendChild(n);

      // subticks showing this beat's subdivision pattern
      const sub = state.subdivisions[i] || 'straight';
      const slots = slotsFor(sub);
      if (slots.length > 1){
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
      let longPressed = false;
      const onDown = () => {
        longPressed = false;
        pressTimer = setTimeout(() => {
          longPressed = true;
          state.accents[i] = !state.accents[i];
          renderBeats();
          if (navigator.vibrate) navigator.vibrate(15);
        }, 420);
      };
      const onUp = () => {
        clearTimeout(pressTimer);
      };
      dot.addEventListener('touchstart', onDown, {passive:true});
      dot.addEventListener('touchend', onUp);
      dot.addEventListener('touchmove', () => clearTimeout(pressTimer));
      dot.addEventListener('mousedown', onDown);
      dot.addEventListener('mouseup', onUp);
      dot.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    }
    updateBeatCounter();
  }

  function updateBeatCounter(){
    const shown = state.currentBeat < 0 ? 1 : state.currentBeat + 1;
    beatCounter.textContent = `${shown} / ${state.beatsPerBar}`;
  }

  function setBeatsPerBar(n){
    state.beatsPerBar = n;
    // resize accent array, keep first beat accented by default if array empty
    const newAccents = [];
    const newSubdivs = [];
    for (let i = 0; i < n; i++){
      newAccents.push(state.accents[i] !== undefined ? state.accents[i] : (i === 0));
      newSubdivs.push(state.subdivisions[i] || 'straight');
    }
    if (!newAccents.some(Boolean)) newAccents[0] = true;
    state.accents = newAccents;
    state.subdivisions = newSubdivs;
    state.currentBeat = -1;
    renderBeats();
    sigLabel.textContent = presetLabelFor(n);
  }

  // ---------- Subdivision selector (applies to all beats) ----------
  subdivRow.querySelectorAll('.subdiv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      subdivRow.querySelectorAll('.subdiv-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const kind = btn.dataset.subdiv;
      state.subdivisions = state.subdivisions.map(() => kind);
      renderBeats();
    });
  });

  function presetLabelFor(n){
    const map = {4:'4/4', 3:'3/4', 2:'2/4', 6:'6/8'};
    return map[n] || `${n}拍`;
  }

  // ---------- Time signature buttons ----------
  sigRow.querySelectorAll('.sig-btn[data-beats]').forEach(btn => {
    btn.addEventListener('click', () => {
      sigRow.querySelectorAll('.sig-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      setBeatsPerBar(parseInt(btn.dataset.beats, 10));
    });
  });

  // custom beats modal (2-12)
  for (let i = 2; i <= 12; i++){
    const cell = document.createElement('div');
    cell.className = 'accent-cell';
    cell.textContent = i;
    cell.dataset.beats = i;
    cell.addEventListener('click', () => {
      customBeatsGrid.querySelectorAll('.accent-cell').forEach(c => c.classList.remove('on'));
      cell.classList.add('on');
    });
    customBeatsGrid.appendChild(cell);
  }
  customSigBtn.addEventListener('click', () => {
    customSigModal.classList.add('show');
  });
  customSigClose.addEventListener('click', () => {
    const chosen = customBeatsGrid.querySelector('.accent-cell.on');
    if (chosen){
      const n = parseInt(chosen.dataset.beats, 10);
      sigRow.querySelectorAll('.sig-btn[data-beats]').forEach(b => b.classList.remove('selected'));
      customSigBtn.classList.add('selected');
      customSigBtn.textContent = presetLabelFor(n) === `${n}拍` ? `${n}` : presetLabelFor(n);
      setBeatsPerBar(n);
    }
    customSigModal.classList.remove('show');
  });
  customSigModal.addEventListener('click', (e) => {
    if (e.target === customSigModal) customSigModal.classList.remove('show');
  });

  // ---------- BPM controls ----------
  function updateFillVar(){
    const min = parseInt(bpmSlider.min, 10);
    const max = parseInt(bpmSlider.max, 10);
    const pct = ((state.bpm - min) / (max - min)) * 100;
    bpmSlider.style.setProperty('--fill', pct + '%');
  }

  function setBpm(v, opts = {}){
    v = Math.max(30, Math.min(260, Math.round(v)));
    state.bpm = v;
    bpmNum.textContent = v;
    bpmSlider.value = v;
    tempoNameEl.textContent = tempoName(v);
    updateFillVar();
    if (state.playing && !opts.skipReschedule) rescheduleTempo();
  }

  bpmSlider.addEventListener('input', () => setBpm(parseInt(bpmSlider.value, 10)));
  minusBtn.addEventListener('click', () => setBpm(state.bpm - 1));
  plusBtn.addEventListener('click', () => setBpm(state.bpm + 1));
  let holdInterval = null;
  function attachHold(btn, dir){
    const start = () => {
      holdInterval = setInterval(() => setBpm(state.bpm + dir), 90);
    };
    const stop = () => { clearInterval(holdInterval); };
    btn.addEventListener('touchstart', (e) => { setTimeout(start, 350); }, {passive:true});
    btn.addEventListener('touchend', stop);
    btn.addEventListener('mousedown', () => { setTimeout(start, 350); });
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
  }
  attachHold(minusBtn, -1);
  attachHold(plusBtn, 1);

  // ---------- TAP tempo ----------
  let tapTimes = [];
  tapBtn.addEventListener('click', () => {
    const now = performance.now();
    tapTimes = tapTimes.filter(t => now - t < 2200);
    tapTimes.push(now);
    if (tapTimes.length >= 2){
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i-1]);
      const avg = intervals.reduce((a,b) => a+b, 0) / intervals.length;
      const bpm = 60000 / avg;
      setBpm(bpm);
      tapLabel.textContent = Math.round(bpm) + '↩';
    } else {
      tapLabel.textContent = '—';
    }
    if (navigator.vibrate) navigator.vibrate(10);
  });

  // ---------- Sound engine ----------
  let audioCtx = null;
  function ensureCtx(){
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playClick(time, accented){
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    let freq, dur, type;
    if (state.soundKind === 0){ // click
      freq = accented ? 1500 : 1000; dur = 0.045; type = 'square';
    } else if (state.soundKind === 1){ // beep
      freq = accented ? 1760 : 880; dur = 0.09; type = 'sine';
    } else { // wood
      freq = accented ? 900 : 600; dur = 0.06; type = 'triangle';
    }
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(accented ? 0.9 : 0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  // ---------- Scheduler ----------
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let beatIndex = 0;
  const SCHEDULE_AHEAD = 0.12; // seconds
  const LOOKAHEAD_MS = 25;
  const scheduledQueue = [];

  function secondsPerBeat(){ return 60.0 / state.bpm; }

  function scheduler(){
    const ctx = ensureCtx();
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD){
      const beatAccented = !!state.accents[beatIndex];
      const sub = state.subdivisions[beatIndex] || 'straight';
      const slots = slotsFor(sub);
      const beatDur = secondsPerBeat();
      const slotDur = beatDur / slots.length;

      slots.forEach((shouldPlay, slotIdx) => {
        const slotTime = nextNoteTime + slotIdx * slotDur;
        if (shouldPlay){
          // only the first slot of the beat carries the beat's accent
          const accented = beatAccented && slotIdx === 0;
          playClick(slotTime, accented);
        }
        // visual flash fires on every slot start (including silent "hollow" slot)
        // so the UI shows the full subdivision grid, but only flashes the beat
        // dot itself once, on the first slot, to keep the big pulse readable.
        if (slotIdx === 0){
          scheduledQueue.push({ time: slotTime, beat: beatIndex });
        }
      });

      beatIndex = (beatIndex + 1) % state.beatsPerBar;
      nextNoteTime += beatDur;
    }
  }

  let visualRAF = null;
  function visualLoop(){
    const ctx = ensureCtx();
    const now = ctx.currentTime;
    while (scheduledQueue.length && scheduledQueue[0].time <= now){
      const item = scheduledQueue.shift();
      state.currentBeat = item.beat;
      flashBeat(item.beat);
    }
    if (state.playing) visualRAF = requestAnimationFrame(visualLoop);
  }

  function flashBeat(i){
    updateBeatCounter();
    const dots = beatsRow.querySelectorAll('.beat-dot');
    dots.forEach(d => d.classList.remove('active'));
    const target = dots[i];
    if (target){
      target.classList.add('active');
      setTimeout(() => target.classList.remove('active'), 110);
    }
  }

  function rescheduleTempo(){
    // just let scheduler adapt naturally on next tick using new bpm; no hard reset needed
  }

  function start(){
    const ctx = ensureCtx();
    state.playing = true;
    beatIndex = 0;
    state.currentBeat = -1;
    scheduledQueue.length = 0;
    nextNoteTime = ctx.currentTime + 0.06;
    schedulerTimer = setInterval(scheduler, LOOKAHEAD_MS);
    visualRAF = requestAnimationFrame(visualLoop);
    playBtn.classList.add('playing');
    playIcon.innerHTML = '<rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/>';
  }

  function stop(){
    state.playing = false;
    clearInterval(schedulerTimer);
    cancelAnimationFrame(visualRAF);
    schedulerTimer = null;
    state.currentBeat = -1;
    beatsRow.querySelectorAll('.beat-dot').forEach(d => d.classList.remove('active'));
    updateBeatCounter();
    playBtn.classList.remove('playing');
    playIcon.innerHTML = '<polygon points="6,4 20,12 6,20"/>';
  }

  playBtn.addEventListener('click', () => {
    ensureCtx();
    if (state.playing) stop(); else start();
  });

  // ---------- Sound toggle ----------
  const SOUND_LABELS = ['♪','◍','♦'];
  soundToggle.addEventListener('click', () => {
    state.soundKind = (state.soundKind + 1) % 3;
    soundToggle.textContent = SOUND_LABELS[state.soundKind];
  });

  // ---------- Init ----------
  setBpm(120, {skipReschedule:true});
  renderBeats();
  sigLabel.textContent = '4/4';
})();
