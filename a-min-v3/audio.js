// audio.js (v3)
// Goal: AW2-ish texture: cold-organic noise, irregular grid, bit-ish, space morph.
// iOS: start() must be called inside user gesture.
// Visual sync: expose {energy, hit, phase} via getState().

let AudioEngine = (() => {
  let started = false;

  // nodes
  let limiter, master, verb, ppDelay, crusher, hp, lp;
  let fm, fmGain;
  let click, clickGain;
  let noise, noiseFilter, noiseGain;

  // sync state for visuals
  const state = {
    energy: 0,   // 0..1 slow envelope
    hit: 0,      // 0..1 transient (decays fast)
    phase: 0,    // 0..1 transport phase
    bpm: 96
  };

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  async function start(){
    if (started) return;
    await Tone.start();

    // master chain
    limiter = new Tone.Limiter(-1).toDestination();
    master  = new Tone.Gain(0.80).connect(limiter);

    // "cold space"
    verb = new Tone.Reverb({ decay: 7.2, preDelay: 0.012, wet: 0.18 });
    ppDelay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.28, wet: 0.10 });

    // texture
    crusher = new Tone.BitCrusher(6); // bit-ish
    hp = new Tone.Filter({ type:"highpass", frequency: 120, Q: 0.7 });
    lp = new Tone.Filter({ type:"lowpass", frequency: 2400, Q: 0.65 });

    // route: (src) -> hp -> crusher -> lp -> delay -> verb -> master
    hp.connect(crusher);
    crusher.connect(lp);
    lp.connect(ppDelay);
    ppDelay.connect(verb);
    verb.connect(master);

    // FM voice (metallic-organic)
    fm = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 10,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.08, sustain: 0.0, release: 0.15 },
      modulationEnvelope: { attack: 0.001, decay: 0.06, sustain: 0.0, release: 0.08 }
    }).connect(hp);
    fmGain = new Tone.Gain(0.22).connect(hp);
    fm.disconnect();
    fm.connect(fmGain);

    // tiny click (grid ghost)
    click = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0.0, release: 0.01 }
    }).connect(hp);
    clickGain = new Tone.Gain(0.18).connect(hp);
    click.disconnect();
    click.connect(clickGain);

    // bed noise (pink) -> bandpass -> chain (very quiet)
    noise = new Tone.Noise("pink").start();
    noiseFilter = new Tone.Filter({ type:"bandpass", frequency: 900, Q: 1.6 });
    noiseGain = new Tone.Gain(0.035);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(hp);

    // Transport: irregular trig w/ stable clock
    Tone.Transport.bpm.value = state.bpm;
    Tone.Transport.timeSignature = [4,4];

    // a simple pseudo-random pattern generator (deterministic enough)
    let step = 0;
    const scaleHz = [220, 246.94, 261.63, 293.66, 329.63, 349.23]; // A3..F4-ish

    Tone.Transport.scheduleRepeat((time) => {
      step++;

      // phase 0..1
      const pos = Tone.Transport.position.split(":");
      // bars:beats:sixteenths => use 16th
      const sixteenth = Number(pos[2] || 0);
      state.phase = (sixteenth % 16) / 16;

      // irregular hit probability (AW2-ish scatter)
      const p = 0.18 + 0.10 * Math.sin(step * 0.17);
      const doHit = Math.random() < p;

      if (doHit) {
        // transient
        state.hit = 1.0;

        // choose freq and micro-detune
        const base = scaleHz[Math.floor(Math.random() * scaleHz.length)];
        const det = 1 + (Math.random() - 0.5) * 0.012;

        // slightly vary FM harshness
        fm.modulationIndex = 6 + Math.random() * 18;
        fm.harmonicity = 0.9 + Math.random() * 2.6;

        // trigger
        fm.triggerAttackRelease(base * det, 0.08 + Math.random() * 0.12, time, 0.18 + Math.random() * 0.18);

        // ghost click sometimes
        if (Math.random() < 0.55) {
          click.triggerAttackRelease(time, 0.10 + Math.random() * 0.12);
        }

        // energy bump
        state.energy = clamp01(state.energy + 0.12 + Math.random() * 0.12);
      } else {
        // sometimes soft click only
        if (Math.random() < 0.12) click.triggerAttackRelease(time, 0.06);
      }

      // decay energy (slow)
      state.energy *= 0.94;

      // decay hit (fast)
      state.hit *= 0.55;

    }, "16n");

    Tone.Transport.start();

    started = true;
  }

  // touch: push energy / shift space (more “reactor”)
  function onTap(xNorm, intensity=0.7){
    if(!started) return;

    // push energy
    state.energy = clamp01(state.energy + 0.25 * intensity);
    state.hit = 1.0;

    // morph space/filters “like opening a cavity”
    const open = clamp01(intensity);
    lp.frequency.rampTo(1600 + open * 5200, 0.08);
    hp.frequency.rampTo(90 + open * 240, 0.08);

    // more bit + more delay
    crusher.bits = Math.max(3, Math.floor(7 - open * 3));
    ppDelay.wet.rampTo(0.08 + open * 0.28, 0.12);
    verb.wet.rampTo(0.12 + open * 0.55, 0.18);

    // immediate “spark”
    const base = 180 + xNorm * 520;
    fm.modulationIndex = 10 + open * 20;
    fm.harmonicity = 1.0 + open * 2.8;
    fm.triggerAttackRelease(base, 0.12, Tone.now(), 0.22);
  }

  // continuous energy mapping (visual can also drive this if needed)
  function updateEnergy(e){
    if(!started) return;
    const energy = clamp01(e);

    // background bed morph
    noiseGain.gain.rampTo(0.020 + energy * 0.070, 0.2);
    noiseFilter.frequency.rampTo(520 + energy * 2200, 0.2);

    // tone color
    lp.frequency.rampTo(1400 + energy * 5200, 0.2);
    hp.frequency.rampTo(110 + energy * 220, 0.2);

    // space
    verb.wet.rampTo(0.10 + energy * 0.55, 0.25);
    ppDelay.wet.rampTo(0.06 + energy * 0.26, 0.25);

    // bit depth shifts subtly
    crusher.bits = Math.max(3, Math.floor(7 - energy * 3));

    // keep internal state aligned
    state.energy = clamp01(0.7 * state.energy + 0.3 * energy);
  }

  function getState(){
    return { ...state };
  }

  return { start, onTap, updateEnergy, getState, get started(){ return started; } };
})();
