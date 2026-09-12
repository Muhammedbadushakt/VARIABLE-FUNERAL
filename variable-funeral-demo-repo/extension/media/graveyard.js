(function () {
  const vscode = acquireVsCodeApi();
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const searchInput = document.getElementById('search');
  const sortSelect = document.getElementById('sort');
  const filtersEl = document.getElementById('filters');
  const buriedListEl = document.getElementById('buried-list');
  const statAlive = document.getElementById('stat-alive');
  const statDead = document.getElementById('stat-dead');
  const statBuried = document.getElementById('stat-buried');

  let tombstones = [], buried = [], activeKind = 'all', query = '', sortBy = 'file', expandedId = null;

  /* =============================================
     SNOW GENERATION
     ============================================= */
  const snow = document.getElementById('snow');
  for (let i = 0; i < 75; i++) {
    const flake = document.createElement('i');
    flake.className = 'snowflake';
    const size = 1 + Math.random() * 3.5;
    flake.style.width = `${size}px`;
    flake.style.height = `${size}px`;
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.opacity = String(.18 + Math.random() * .7);
    flake.style.animationDuration = `${7 + Math.random() * 14}s`;
    flake.style.animationDelay = `${-Math.random() * 18}s`;
    flake.style.setProperty('--drift', `${-90 + Math.random() * 180}px`);
    snow.appendChild(flake);
  }

  /* =============================================
     MOUSE FOLLOWER SYSTEM
     Skull, Bones, Ghost Trail, Watching Eyes, Crow
     ============================================= */

  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false, speed: 0, prevX: 0, prevY: 0 };
  let mouseStillTimer;

  document.addEventListener('mousemove', (e) => {
    mouse.speed = Math.hypot(e.clientX - mouse.x, e.clientY - mouse.y);
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
    clearTimeout(mouseStillTimer);
    mouseStillTimer = setTimeout(() => { mouse.active = false; }, 1500);
  });

  // --- SKULL FOLLOWER ---
  const skullEl = document.createElement('div');
  skullEl.className = 'skull-follower';
  skullEl.innerHTML = `<svg viewBox="0 0 60 74" width="46" height="57" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="skullGrad" cx="50%" cy="35%" r="55%">
        <stop offset="0%" stop-color="#a8a898"/>
        <stop offset="60%" stop-color="#8a8a78"/>
        <stop offset="100%" stop-color="#6a6a58"/>
      </radialGradient>
      <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(102,255,204,.25)"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <path d="M30 3C13 3 2 16 2 32c0 10 5 19 12 23v9c0 5 7 8 16 8s16-3 16-8v-9c7-4 12-13 12-23C58 16 47 3 30 3z" fill="url(#skullGrad)" stroke="#5a5a48" stroke-width="1.2"/>
    <ellipse cx="21" cy="28" rx="8" ry="10" fill="#0e0e08"/>
    <ellipse cx="39" cy="28" rx="8" ry="10" fill="#0e0e08"/>
    <ellipse cx="21" cy="28" rx="5" ry="6" fill="url(#eyeGlow)"/>
    <ellipse cx="39" cy="28" rx="5" ry="6" fill="url(#eyeGlow)"/>
    <path d="M26 44l4 8 4-8" fill="none" stroke="#0e0e08" stroke-width="3" stroke-linecap="round"/>
    <rect x="21" y="55" width="18" height="7" rx="1.5" fill="#0e0e08"/>
    <line x1="25" y1="55" x2="25" y2="62" stroke="#8a8a78" stroke-width="1.5"/>
    <line x1="30" y1="55" x2="30" y2="62" stroke="#8a8a78" stroke-width="1.5"/>
    <line x1="35" y1="55" x2="35" y2="62" stroke="#8a8a78" stroke-width="1.5"/>
    <path d="M12 36c-3-2-5 1-3 3s5 0 3-3zM48 36c3-2 5 1 3 3s-5 0-3-3z" fill="#8a8a78" opacity=".4"/>
  </svg>`;
  document.body.appendChild(skullEl);

  // --- BONE ORBITERS ---
  const boneSVG = `<svg viewBox="0 0 32 12" width="24" height="9" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="4" width="14" height="4" rx="2" fill="#9a9a88" stroke="#6a6a58" stroke-width=".6"/>
    <circle cx="6" cy="3.5" r="3.2" fill="#9a9a88" stroke="#6a6a58" stroke-width=".6"/>
    <circle cx="6" cy="8.5" r="3.2" fill="#9a9a88" stroke="#6a6a58" stroke-width=".6"/>
    <circle cx="26" cy="3.5" r="3.2" fill="#9a9a88" stroke="#6a6a58" stroke-width=".6"/>
    <circle cx="26" cy="8.5" r="3.2" fill="#9a9a88" stroke="#6a6a58" stroke-width=".6"/>
  </svg>`;

  const bones = [];
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    el.className = 'bone-follower';
    el.innerHTML = boneSVG;
    document.body.appendChild(el);
    bones.push({
      el,
      baseAngle: (Math.PI * 2 / 4) * i,
      radius: 48 + Math.random() * 25,
      speed: 0.015 + Math.random() * 0.01,
      phase: Math.random() * Math.PI * 2
    });
  }

  // --- GHOST TRAIL ---
  const ghostTrail = [];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement('div');
    el.className = 'ghost-trail-dot';
    const size = 3 + (14 - i) * 0.5;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.background = `radial-gradient(circle, rgba(102,255,204,${.5 - i * .03}), transparent)`;
    el.style.boxShadow = `0 0 ${4 + i}px rgba(102,255,204,${.2 - i * .013})`;
    document.body.appendChild(el);
    ghostTrail.push({ el, x: mouse.x, y: mouse.y });
  }

  // --- WATCHING EYES ---
  const watchingEyes = [];
  const fogLayer = document.querySelector('.fog-layer');
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('div');
    el.className = 'watching-eyes';
    el.innerHTML = '<span class="eye"></span><span class="eye"></span>';
    el.style.left = `${8 + Math.random() * 84}%`;
    el.style.top = `${15 + Math.random() * 65}%`;
    if (fogLayer) fogLayer.appendChild(el);
    watchingEyes.push({
      el,
      blinkPhase: Math.random() * Math.PI * 2,
      blinkSpeed: .5 + Math.random() * 1.5,
      appearCycle: Math.random() * 10000
    });
  }

  // --- CROW ---
  const crowEl = document.createElement('div');
  crowEl.className = 'crow-fly';
  crowEl.innerHTML = `<svg viewBox="0 0 50 30" width="40" height="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 15c-4-8-15-14-22-10c5 2 10 6 12 10c-5-4-12-3-14 1c4 0 9 2 12 5l2 4 2-4c3-3 8-5 12-5c-2-4-9-5-14-1c2-4 7-8 12-10c-7-4-18 2-22 10z" fill="#111"/>
  </svg>`;
  document.body.appendChild(crowEl);

  let crowState = { active: false, x: -60, y: 0, targetX: 0, targetY: 0, wingPhase: 0, nextFlight: Date.now() + 5000 + Math.random() * 15000 };

  function launchCrow() {
    const side = Math.random() > .5;
    crowState.x = side ? -60 : window.innerWidth + 60;
    crowState.y = 40 + Math.random() * (window.innerHeight * .4);
    crowState.targetX = side ? window.innerWidth + 80 : -80;
    crowState.targetY = 30 + Math.random() * (window.innerHeight * .3);
    crowState.active = true;
    crowState.wingPhase = 0;
    crowEl.style.opacity = '0.7';
  }

  // --- ANIMATION LOOP ---
  const follow = {
    skullX: mouse.x, skullY: mouse.y,
    boneAngle: 0,
    time: 0
  };

  function animateFollowers() {
    follow.time++;
    const dt = 1;

    // Skull lerps toward mouse
    const skullLerp = 0.055;
    follow.skullX += (mouse.x + 30 - follow.skullX) * skullLerp;
    follow.skullY += (mouse.y - 35 - follow.skullY) * skullLerp;

    const skullVisible = mouse.active && mouse.speed > 1;
    skullEl.classList.toggle('visible', skullVisible);
    skullEl.style.transform = `translate3d(${follow.skullX}px, ${follow.skullY}px, 0) rotate(${(mouse.x - follow.skullX) * .02}deg)`;

    // Bones orbit the skull
    follow.boneAngle += 0.018;
    const boneVisible = skullVisible;
    bones.forEach((b, i) => {
      const angle = follow.boneAngle * (b.speed / 0.015) + b.baseAngle;
      const radiusMod = b.radius + Math.sin(follow.time * .03 + b.phase) * 8;
      const bx = follow.skullX + 20 + Math.cos(angle) * radiusMod;
      const by = follow.skullY + 25 + Math.sin(angle) * radiusMod * .55;
      b.el.classList.toggle('visible', boneVisible);
      b.el.style.transform = `translate3d(${bx}px, ${by}px, 0) rotate(${angle + Math.PI / 2}rad)`;
    });

    // Ghost trail
    const trailLerpBase = 0.12;
    ghostTrail.forEach((g, i) => {
      const lerp = trailLerpBase - i * 0.007;
      g.x += (mouse.x - g.x) * Math.max(lerp, 0.02);
      g.y += (mouse.y - g.y) * Math.max(lerp, 0.02);
      const trailOpacity = mouse.active ? Math.max(0, (.35 - i * .025) * Math.min(mouse.speed / 8, 1)) : 0;
      g.el.style.transform = `translate3d(${g.x - 3}px, ${g.y - 3}px, 0)`;
      g.el.style.opacity = String(trailOpacity);
    });

    // Watching eyes blink and track
    watchingEyes.forEach((w, i) => {
      w.blinkPhase += w.blinkSpeed * 0.016;
      const blinkVal = Math.sin(w.blinkPhase);
      const visible = blinkVal > .3;

      // Appear/disappear on long cycles
      w.appearCycle += 16;
      const cycleVisible = Math.sin(w.appearCycle * .0003 + i) > .2;

      w.el.classList.toggle('visible', visible && cycleVisible);

      // Eyes track mouse
      if (visible && cycleVisible) {
        const rect = w.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = mouse.x - cx;
        const dy = mouse.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const shift = Math.min(2, 12 / dist);
        const sx = (dx / dist) * shift;
        const sy = (dy / dist) * shift;
        w.el.querySelectorAll('.eye').forEach(eye => {
          eye.style.transform = `translate(${sx}px, ${sy}px)`;
        });
      }
    });

    // Crow
    if (!crowState.active && Date.now() > crowState.nextFlight) {
      launchCrow();
    }
    if (crowState.active) {
      const cdx = crowState.targetX - crowState.x;
      const cdy = crowState.targetY - crowState.y;
      crowState.x += cdx * .008;
      crowState.y += cdy * .008 + Math.sin(follow.time * .1) * 1.5;
      crowState.wingPhase += .15;
      const wingFlap = Math.sin(crowState.wingPhase) * 15;
      crowEl.style.transform = `translate3d(${crowState.x}px, ${crowState.y + wingFlap}px, 0) scaleX(${crowState.targetX > crowState.x ? 1 : -1})`;

      if (Math.abs(cdx) < 20) {
        crowState.active = false;
        crowEl.style.opacity = '0';
        crowState.nextFlight = Date.now() + 12000 + Math.random() * 25000;
      }
    }

    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
    requestAnimationFrame(animateFollowers);
  }

  requestAnimationFrame(animateFollowers);

  /* =============================================
     MESSAGE HANDLING
     ============================================= */

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type !== 'state') return;
    tombstones = message.tombstones;
    buried = message.buried;
    statAlive.textContent = String(message.stats.alive);
    statDead.textContent = String(message.stats.dead);
    statBuried.textContent = String(message.stats.buried);
    render();
  });

  searchInput.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); render(); });
  sortSelect.addEventListener('change', () => { sortBy = sortSelect.value; render(); });
  filtersEl.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const kind = target.getAttribute('data-kind');
    if (!kind) return;
    activeKind = kind;
    filtersEl.querySelectorAll('.filter-chip').forEach(chip => chip.classList.toggle('is-active', chip === target));
    render();
  });

  function visibleTombstones() {
    let list = tombstones.slice();
    if (activeKind !== 'all') list = list.filter(t => t.kind === activeKind);
    if (query) list = list.filter(t => t.name.toLowerCase().includes(query) || t.fileName.toLowerCase().includes(query) || t.causeOfDeath.toLowerCase().includes(query));
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'recent') list.sort((a, b) => b.detectedAt - a.detectedAt);
    else list.sort((a, b) => a.fileName.localeCompare(b.fileName) || a.line - b.line);
    return list;
  }

  function render() {
    const list = visibleTombstones();
    grid.innerHTML = '';
    empty.hidden = tombstones.length > 0;
    for (const t of list) grid.appendChild(t.id === expandedId ? renderDetail(t) : renderTomb(t));
    renderBuriedList();
  }

  /* =============================================
     REALISTIC TOMBSTONE RENDERER
     ============================================= */

  function renderTomb(t) {
    const button = document.createElement('button');
    button.className = 'tomb';
    button.setAttribute('aria-expanded', 'false');

    // R.I.P. header
    const rip = document.createElement('span');
    rip.className = 'tomb-rip';
    rip.textContent = 'R.I.P.';

    // Inscription panel (recessed carving area)
    const inscription = document.createElement('span');
    inscription.className = 'inscription';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = t.name;

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${t.fileName}:${t.line + 1}\n${t.causeOfDeath}`;

    inscription.append(name, meta);

    // Kind tag
    const tag = document.createElement('span');
    tag.className = 'kind-tag';
    tag.textContent = t.kind;

    // Crack overlay
    const crack = document.createElement('span');
    crack.className = 'tomb-crack';
    crack.setAttribute('aria-hidden', 'true');

    // Ecto whisper glow (every 3rd tomb)
    const isHaunted = (tombstones.indexOf(t) + 1) % 3 === 0;
    let whisper = null;
    if (isHaunted) {
      whisper = document.createElement('span');
      whisper.className = 'whisper-glow';
      whisper.setAttribute('aria-hidden', 'true');
    }

    button.append(rip, inscription, tag, crack);
    if (whisper) button.appendChild(whisper);

    button.addEventListener('click', () => { expandedId = t.id; render(); });
    return button;
  }

  function renderDetail(t) {
    const wrap = document.createElement('article');
    wrap.className = 'detail';
    const title = document.createElement('h2'); title.textContent = t.name;
    const location = document.createElement('div'); location.className = 'location'; location.textContent = `${t.fileName}:${t.line + 1}:${t.character + 1}`;
    const epitaph = document.createElement('p'); epitaph.className = 'epitaph'; epitaph.textContent = t.epitaph || 'Here lies a declaration that was never referenced.';
    const cause = document.createElement('p'); cause.className = 'cause'; cause.textContent = `Cause of death: ${t.causeOfDeath}`;
    const actions = document.createElement('div'); actions.className = 'actions';
    actions.innerHTML = '<button class="btn-jump">Visit the grave</button><button class="btn-bury">Bury it</button><button class="btn-ignore">Spare this one</button><button class="btn-close">Close</button>';
    wrap.append(title, location, epitaph, cause, actions);
    actions.querySelector('.btn-jump').addEventListener('click', () => vscode.postMessage({ type: 'jump', id: t.id }));
    actions.querySelector('.btn-bury').addEventListener('click', () => { vscode.postMessage({ type: 'bury', id: t.id }); expandedId = null; });
    actions.querySelector('.btn-ignore').addEventListener('click', () => { vscode.postMessage({ type: 'ignore', id: t.id }); expandedId = null; });
    actions.querySelector('.btn-close').addEventListener('click', () => { expandedId = null; render(); });
    return wrap;
  }

  function renderBuriedList() {
    buriedListEl.innerHTML = '';
    if (!buried.length) {
      const li = document.createElement('li');
      li.className = 'empty-note';
      li.textContent = 'Nothing buried yet. The cemetery is suspiciously empty.';
      buriedListEl.appendChild(li);
      return;
    }
    buried.slice().sort((a, b) => b.buriedAt - a.buriedAt).slice(0, 8).forEach(b => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="name"></span><button class="resurrect">Resurrect</button>';
      li.querySelector('.name').textContent = `${b.name} · ${b.fileName}:${b.line + 1}`;
      li.querySelector('.resurrect').addEventListener('click', () => vscode.postMessage({ type: 'resurrect', id: b.id }));
      buriedListEl.appendChild(li);
    });
  }

  vscode.postMessage({ type: 'ready' });
})();