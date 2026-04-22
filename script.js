const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const ui = {
  start: document.getElementById('startScreen'),
  end: document.getElementById('endScreen'),
  startBtn: document.getElementById('startBtn'),
  restartBtn: document.getElementById('restartBtn'),
  deaths: document.getElementById('deaths'),
  time: document.getElementById('time'),
  msg: document.getElementById('msg')
};

const keys = {};
const W = cvs.width, H = cvs.height, G = 0.55, MAXVX = 5.2, JUMP = 11.8, FRICTION = 0.82;
let running = false, ended = false, deaths = 0, startedAt = 0, last = 0, beepCtx;

const spawn = { x: 28, y: 468 };
const player = { x: spawn.x, y: spawn.y, w: 24, h: 24, vx: 0, vy: 0, grounded: false, color: '#ffce54' };

const plats = [
  { x: 0, y: 505, w: 170, h: 35, c: '#dce3ea' },
  { x: 185, y: 470, w: 95, h: 18, c: '#dce3ea', crumble: 42, tip: 'Questa sembrava solida.' },
  { x: 330, y: 430, w: 85, h: 18, c: '#dce3ea' },
  { x: 450, y: 388, w: 92, h: 18, c: '#dce3ea', fakeCheckpoint: 1 },
  { x: 595, y: 344, w: 94, h: 18, c: '#dce3ea', vanish: 1, tip: 'La piattaforma ha cambiato idea.' },
  { x: 735, y: 295, w: 128, h: 18, c: '#dce3ea' },
  { x: 710, y: 505, w: 250, h: 35, c: '#dce3ea' },
  { x: 530, y: 250, w: 75, h: 16, c: '#dce3ea' },
  { x: 390, y: 215, w: 70, h: 16, c: '#dce3ea', crumble: 28, tip: 'Sei quasi arrivato. No.' },
  { x: 235, y: 185, w: 85, h: 16, c: '#dce3ea' },
  { x: 108, y: 150, w: 85, h: 16, c: '#dce3ea', gravityFlip: 1, tip: 'La gravita ti odia.' },
  { x: 10, y: 105, w: 105, h: 14, c: '#dce3ea' },
  { x: 150, y: 75, w: 235, h: 14, c: '#dce3ea' },
  { x: 468, y: 102, w: 140, h: 14, c: '#dce3ea' },
  { x: 680, y: 122, w: 130, h: 14, c: '#dce3ea', finish: 1 }
];

const spikes = [
  { x: 168, y: 492, w: 20, h: 13, visible: 0 },
  { x: 280, y: 505, w: 40, h: 18, visible: 1 },
  { x: 543, y: 370, w: 16, h: 18, visible: 0 },
  { x: 686, y: 326, w: 18, h: 18, visible: 0 },
  { x: 615, y: 505, w: 92, h: 16, visible: 1 },
  { x: 190, y: 61, w: 92, h: 14, visible: 0 },
  { x: 609, y: 88, w: 28, h: 14, visible: 0 }
];

const signs = [
  { x: 230, y: 438, t: 'Checkpoint!' },
  { x: 508, y: 354, t: 'Sei quasi arrivato' },
  { x: 42, y: 76, t: 'Ancora un saltino' },
  { x: 664, y: 92, t: 'Zero trappole qui' }
];

let gravity = 1, flash = 0, msgTimer = 0;

function rects(a, b, pad = 0) {
  return a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y + b.h && a.y + a.h - pad > b.y;
}

function tone(freq = 220, dur = 0.05, type = 'square', vol = 0.02) {
  try {
    beepCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = beepCtx.createOscillator(), g = beepCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(beepCtx.destination);
    o.start();
    o.stop(beepCtx.currentTime + dur);
  } catch {}
}

function say(text, color = '#ffce54', time = 140) {
  ui.msg.textContent = text;
  ui.msg.style.color = color;
  msgTimer = time;
}

function reset(full = false) {
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  gravity = 1;
  flash = 1;
  plats.forEach(p => {
    p.dead = 0;
    p.t = 0;
    p.used = 0;
    p.alpha = 1;
  });
  if (full) {
    deaths = 0;
    startedAt = performance.now();
    ended = false;
    ui.end.classList.add('hidden');
  }
  ui.deaths.textContent = deaths;
  say('Premi in avanti. Fidati del gioco.', '#ffce54');
}

function kill(reason = 'Hai toccato qualcosa che non dovevi.') {
  if (ended) return;
  deaths++;
  ui.deaths.textContent = deaths;
  say(reason, '#ff5c7a', 120);
  tone(110, 0.08, 'sawtooth', 0.03);
  reset();
}

function finish() {
  ended = true;
  running = false;
  ui.end.classList.remove('hidden');
  tone(660, 0.08, 'triangle', 0.03);
  tone(440, 0.12, 'triangle', 0.02);
}

function control() {
  const left = keys.ArrowLeft || keys.KeyA;
  const right = keys.ArrowRight || keys.KeyD;
  const jump = keys.ArrowUp || keys.KeyW || keys.Space;
  if (left) player.vx -= 0.55;
  if (right) player.vx += 0.55;
  player.vx = Math.max(-MAXVX, Math.min(MAXVX, player.vx * FRICTION));
  if (jump && player.grounded) {
    player.vy = -JUMP * gravity;
    player.grounded = false;
    tone(260, 0.03, 'square', 0.015);
  }
}

function step() {
  control();
  player.vy += G * gravity;
  player.x += player.vx;
  player.y += player.vy;
  player.grounded = false;

  if (player.x < -20 || player.x > W + 20 || player.y < -80 || player.y > H + 80) kill('Caduta perfetta. Rifalla.');

  for (const p of plats) {
    if (p.dead) continue;
    if (rects(player, p, 2)) {
      const fromTop = gravity > 0 && player.vy >= 0 && player.y + player.h - player.vy <= p.y + 10;
      const fromBottom = gravity < 0 && player.vy <= 0 && player.y - player.vy >= p.y + p.h - 10;
      if (fromTop || fromBottom) {
        player.y = gravity > 0 ? p.y - player.h : p.y + p.h;
        player.vy = 0;
        player.grounded = true;
        if (p.crumble) {
          p.t++;
          if (p.t > p.crumble) {
            p.dead = 1;
            say(p.tip || 'Ops.', '#ff5c7a', 90);
            tone(180, 0.04, 'square', 0.025);
          }
        }
        if (p.vanish && !p.used) {
          p.used = 1;
          setTimeout(() => p.dead = 1, 180);
        }
        if (p.fakeCheckpoint && !p.used) {
          p.used = 1;
          say('Checkpoint salvato! Ah no.', '#78a8ff', 150);
          tone(520, 0.02, 'triangle', 0.02);
        }
        if (p.gravityFlip && !p.used) {
          p.used = 1;
          gravity *= -1;
          say(p.tip, '#74f0b0', 110);
          tone(340, 0.05, 'sine', 0.02);
        }
        if (p.finish) finish();
      } else {
        player.x += player.x + player.w / 2 < p.x + p.w / 2 ? -3 : 3;
      }
    }
  }

  for (const s of spikes) {
    const unfair = { x: s.x - 2, y: s.y - 2, w: s.w + 4, h: s.h + 4 };
    if (rects(player, unfair, 5)) kill('Hitbox onestissima, giuro.');
  }

  if (player.x > 470 && player.x < 530 && player.y > 418 && player.y < 430) kill('Il checkpoint era decorativo.');
  if (player.x > 816 && player.y < 280 && gravity > 0) say('Davvero pensavi fosse finita?', '#ffce54', 40);
}

function drawSpike(s) {
  if (!s.visible) return;
  ctx.fillStyle = '#ff5c7a';
  const n = Math.max(2, Math.floor(s.w / 12));
  for (let i = 0; i < n; i++) {
    const x = s.x + i * (s.w / n), w = s.w / n;
    ctx.beginPath();
    ctx.moveTo(x, s.y + s.h);
    ctx.lineTo(x + w / 2, s.y);
    ctx.lineTo(x + w, s.y + s.h);
    ctx.fill();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff06';
  for (let i = 0; i < W; i += 48) ctx.fillRect(i, 0, 1, H);
  for (let i = 0; i < H; i += 48) ctx.fillRect(0, i, W, 1);

  ctx.fillStyle = '#ffffff10';
  ctx.fillRect(0, H - 90, W, 90);

  signs.forEach(s => {
    ctx.fillStyle = '#ffffff50';
    ctx.font = '12px Verdana';
    ctx.fillText(s.t, s.x, s.y);
  });

  plats.forEach(p => {
    if (p.dead) return;
    ctx.globalAlpha = p.vanish && p.used ? 0.35 : 1;
    ctx.fillStyle = p.fakeCheckpoint ? '#78a8ff' : p.c;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    if (p.fakeCheckpoint) {
      ctx.strokeStyle = '#dce3ea';
      ctx.strokeRect(p.x + 28, p.y - 20, 14, 20);
      ctx.fillStyle = '#74f0b0';
      ctx.fillRect(p.x + 30, p.y - 18, 10, 6);
    }
  });
  ctx.globalAlpha = 1;

  spikes.forEach(drawSpike);

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  if (gravity < 0) ctx.rotate(Math.PI);
  ctx.fillStyle = flash > 0 ? '#fff' : player.color;
  ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
  ctx.restore();

  if (ended) {
    ctx.fillStyle = '#74f0b0';
    ctx.fillRect(724, 88, 54, 34);
    ctx.fillStyle = '#0f141a';
    ctx.font = 'bold 14px Verdana';
    ctx.fillText('FINE?', 731, 110);
  }
}

function loop(ts) {
  if (!running) return;
  last ||= ts;
  const dt = ts - last;
  last = ts;
  if (!ended) {
    for (let i = 0; i < Math.min(3, Math.ceil(dt / 16.7)); i++) step();
    ui.time.textContent = ((ts - startedAt) / 1000).toFixed(1);
  }
  flash = Math.max(0, flash - 0.08);
  if (--msgTimer <= 0 && !ended) say('Vai pure, il gioco ti rispetta pochissimo.', '#ffce54', 9999);
  draw();
  requestAnimationFrame(loop);
}

function startGame() {
  ui.start.classList.add('hidden');
  ui.end.classList.add('hidden');
  running = true;
  reset(true);
  last = 0;
  requestAnimationFrame(loop);
}

addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = 1;
  if (e.code === 'KeyR') {
    if (!running) startGame();
    else {
      deaths++;
      ui.deaths.textContent = deaths;
      reset();
    }
  }
});

addEventListener('keyup', e => keys[e.code] = 0);
ui.startBtn.onclick = startGame;
ui.restartBtn.onclick = startGame;
draw();
