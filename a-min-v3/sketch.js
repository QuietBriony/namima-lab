// sketch.js (v3)
// Visual: 8 light sources (n-body-ish) with slow interference + breathing + audio sync.

let started = false;
let bodies = [];

const N = 8;

const SIM = {
  G: 38,            // attraction strength
  soften: 140,      // softening to avoid singularity
  repel: 0.42,      // close-range repel
  damp: 0.985,      // velocity damping
  maxV: 4.2,        // clamp
  trailAlpha: 16,   // background fade
};

function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(0);

  bodies = [];
  for (let i=0;i<N;i++){
    bodies.push(makeBody(i));
  }

  const overlay = document.getElementById("startOverlay");
  overlay.addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    await AudioEngine.start();         // iOS safe
    overlay.style.display = "none";
    started = true;
  }, {passive:false});
}

function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
}

function makeBody(i){
  const angle = (i / N) * TWO_PI;
  const r = min(width, height) * (0.12 + 0.18 * random());
  const cx = width*0.5, cy = height*0.52;
  const x = cx + cos(angle) * r;
  const y = cy + sin(angle) * r;

  // initial tangential velocity
  const vx = -sin(angle) * (0.6 + random()*0.8);
  const vy =  cos(angle) * (0.6 + random()*0.8);

  return {
    x, y, vx, vy,
    m: 0.8 + random()*1.8,
    baseHue: 195 + random()*70,  // subdued palette
    phase: random(1000),
    radius: 18 + random()*24
  };
}

function pointerToCanvas(){
  return { x: constrain(mouseX,0,width), y: constrain(mouseY,0,height) };
}

function mousePressed(){ handleTap(); }
function touchStarted(){ handleTap(); return false; }

function handleTap(){
  if(!started) return;
  const p = pointerToCanvas();
  // "inject" a disturbance: nudge nearest body + audio spark
  let best = 1e9, idx = 0;
  for (let i=0;i<bodies.length;i++){
    const dx = bodies[i].x - p.x;
    const dy = bodies[i].y - p.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < best){ best = d2; idx = i; }
  }
  const b = bodies[idx];
  const nx = (b.x - p.x);
  const ny = (b.y - p.y);
  const len = Math.sqrt(nx*nx + ny*ny) + 1e-6;
  b.vx += (nx/len) * 1.2;
  b.vy += (ny/len) * 1.2;

  AudioEngine.onTap(p.x / width, 0.85);
}

function clampMag(vx, vy, maxV){
  const v = Math.sqrt(vx*vx + vy*vy);
  if (v <= maxV) return {vx,vy};
  const s = maxV / (v + 1e-6);
  return { vx: vx*s, vy: vy*s };
}

function draw(){
  // deep trail (video-ish)
  noStroke();
  fill(5, 6, 10, SIM.trailAlpha);
  rect(0,0,width,height);

  const t = millis() * 0.001;

  const st = started ? AudioEngine.getState() : {energy:0, hit:0, phase:0, bpm:96};
  const energy = st.energy;  // 0..1
  const hit = st.hit;        // 0..1 fast transient

  // energy also drives overall “gravity” + breathing speed
  const G = SIM.G * (0.75 + energy * 1.35);

  // simulate n-body-ish
  for (let i=0;i<N;i++){
    let ax = 0, ay = 0;
    const bi = bodies[i];

    for (let j=0;j<N;j++){
      if (i===j) continue;
      const bj = bodies[j];

      const dx = bj.x - bi.x;
      const dy = bj.y - bi.y;

      const d2 = dx*dx + dy*dy + SIM.soften;
      const d = Math.sqrt(d2);

      // attraction ~ 1/r
      const f = (G * bj.m) / d2;

      ax += (dx / d) * f;
      ay += (dy / d) * f;

      // close repel for “breathing separation”
      const rr = 1 / (d + 1e-6);
      ax -= (dx * rr * rr) * SIM.repel * 0.35;
      ay -= (dy * rr * rr) * SIM.repel * 0.35;
    }

    // subtle central tether to keep them in frame (very weak)
    const cx = width*0.5, cy = height*0.52;
    ax += (cx - bi.x) * 0.0008;
    ay += (cy - bi.y) * 0.0008;

    bi.vx = (bi.vx + ax) * SIM.damp;
    bi.vy = (bi.vy + ay) * SIM.damp;

    const vv = clampMag(bi.vx, bi.vy, SIM.maxV + energy*2.0);
    bi.vx = vv.vx; bi.vy = vv.vy;

    bi.x += bi.vx;
    bi.y += bi.vy;

    // wrap softly
    if (bi.x < -40) bi.x = width+40;
    if (bi.x > width+40) bi.x = -40;
    if (bi.y < -40) bi.y = height+40;
    if (bi.y > height+40) bi.y = -40;
  }

  // render glow (additive-ish by multi-pass)
  colorMode(HSB, 360, 255, 255, 255);

  // global brightness shaping
  const baseGlow = 0.35 + energy * 0.90;
  const pulse = 0.35 + 0.65 * Math.pow(hit, 0.7); // transient pop

  // draw connecting “interference” lines faintly
  // (gives the tri-body vibe without particles)
  strokeWeight(1);
  for (let i=0;i<N;i++){
    for (let j=i+1;j<N;j++){
      const bi = bodies[i], bj = bodies[j];
      const dx = bj.x - bi.x, dy = bj.y - bi.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > min(width,height)*0.65) continue;

      const a = 14 + 50 * energy * Math.exp(-d/420);
      const h = 200 + 40 * Math.sin((t*0.7) + (i*0.4));
      stroke(h, 120, 120, a);
      line(bi.x, bi.y, bj.x, bj.y);
    }
  }

  // bodies glow
  for (let i=0;i<N;i++){
    const b = bodies[i];

    const breathe = 0.65 + 0.35 * Math.sin(t*0.8 + b.phase + st.phase*TWO_PI);
    const rad = b.radius * (0.75 + 0.55*breathe + 0.65*energy) * (0.92 + 0.25*pulse);

    // hue shifts slightly with energy (but not rainbow)
    const hue = b.baseHue + 18 * energy + 8 * Math.sin(t*0.4 + i);

    // multi-ring glow
    noStroke();
    // outer haze
    fill(hue, 90, 120, 14 + 30*baseGlow);
    circle(b.x, b.y, rad*4.2);

    // mid glow
    fill(hue, 120, 190, 22 + 70*baseGlow);
    circle(b.x, b.y, rad*2.2);

    // core
    fill(hue, 130, 240, 55 + 140*pulse);
    circle(b.x, b.y, rad*0.92);

    // tiny hot core
    fill(hue, 70, 255, 40 + 160*pulse);
    circle(b.x, b.y, rad*0.35);
  }

  // feed energy back gently (optional): makes visuals drive slow tone too
  if (started){
    // derive a smooth energy from average speed
    let sp = 0;
    for (const b of bodies){
      sp += Math.sqrt(b.vx*b.vx + b.vy*b.vy);
    }
    sp /= N;
    const e2 = Math.min(1, sp / 4.5) * 0.55 + energy*0.45;
    AudioEngine.updateEnergy(e2);
  }
}
