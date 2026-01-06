// audio.js (Lab v2)
// iOS: start() must be called directly from user gesture.
// Design: 2-layer drone (low+air) + tiny pluck. "energy" morphs space/filter/saturation.

let AudioEngine = (() => {
  let started = false;

  let limiter, master, sat;
  let filter, airFilter;
  let verb, shimmer;
  let low, air, pluck;

  const scale = ["C", "D", "Eb", "G", "Ab"]; // minor pentatonic
  function noteFromX(xNorm){
    const octave = 3 + Math.floor(xNorm * 3); // 3..5
    const idx = Math.min(scale.length - 1, Math.floor(xNorm * scale.length));
    return `${scale[idx]}${octave}`;
  }

  async function start(){
    if (started) return;

    await Tone.start();

    limiter = new Tone.Limiter(-1).toDestination();
    master  = new Tone.Gain(0.82);
    sat     = new Tone.Chebyshev(18); // gentle harmonic “thickening”
    filter  = new Tone.Filter({ type:"lowpass", frequency: 900, Q: 0.7 });
    airFilter = new Tone.Filter({ type:"highpass", frequency: 420, Q: 0.5 });

    verb    = new Tone.Reverb({ decay: 7.8, preDelay: 0.01, wet: 0.18 });
    shimmer = new Tone.FeedbackDelay({ delayTime:"8n", feedback: 0.25, wet: 0.08 });

    // chain: (sources) -> sat -> filter -> verb -> shimmer -> master -> limiter
    sat.connect(filter);
    filter.connect(verb);
    verb.connect(shimmer);
    shimmer.connect(master);
    master.connect(limiter);

    // Low drone: sine+triangle blend
    low = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 1.2, decay: 0.2, sustain: 1.0, release: 2.6 },
      filterEnvelope: { attack: 0.6, decay: 0.3, sustain: 0.3, release: 1.5, baseFrequency: 60, octaves: 2 }
    }).connect(sat);

    // Air layer: very soft poly pad filtered high
    air = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 1.8, decay: 0.4, sustain: 0.75, release: 5.2 }
    });

    // air -> airFilter -> sat (shared)
    air.connect(airFilter);
    airFilter.connect(sat);

    // Tiny pluck (subtle)
    pluck = new Tone.PluckSynth({
      attackNoise: 0.6,
      dampening: 2800,
      resonance: 0.9
    }).connect(sat);

    // seed chord (quiet)
    const now = Tone.now();
    low.triggerAttack("C2", now, 0.16);
    air.triggerAttackRelease(["C3","G3","Ab3"], 10, now, 0.06);

    started = true;
  }

  function onTap(xNorm, intensity=0.6){
    if(!started) return;

    const now = Tone.now();
    const n = noteFromX(xNorm);
    const vel = Math.min(0.85, 0.10 + intensity * 0.55);

    // a hint, not a hit
    pluck.triggerAttackRelease(n, 0.12 + intensity * 0.18, now, vel);

    // occasional air flicker
    if (Math.random() < 0.55) {
      const n2 = noteFromX((xNorm + 0.2) % 1);
      air.triggerAttackRelease([n, n2], 2.8, now + 0.02, vel * 0.18);
    }
  }

  function updateEnergy(e){
    if(!started) return;
    const energy = Math.max(0, Math.min(1, e));

    // “space opens”
    const f = 520 + energy * 3200;
    filter.frequency.rampTo(f, 0.10);

    const airy = 280 + energy * 520;
    airFilter.frequency.rampTo(airy, 0.12);

    // reverb wet + shimmer wet
    verb.wet.rampTo(0.12 + energy * 0.48, 0.18);
    shimmer.wet.rampTo(0.05 + energy * 0.22, 0.18);

    // saturation amount
    sat.order = 8 + Math.floor(energy * 28);

    // master breathing
    master.gain.rampTo(0.70 + energy * 0.30, 0.18);

    // low drone pitch drift (very subtle)
    const base = 48 + energy * 7; // MIDI note-ish feel
    const hz = Tone.Frequency(base, "midi").toFrequency();
    low.frequency.rampTo(hz, 0.25);
  }

  return { start, onTap, updateEnergy, get started(){ return started; } };
})();
