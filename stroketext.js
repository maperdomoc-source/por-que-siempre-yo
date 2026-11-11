/* ============================================================
   StrokeText (vanilla JS + SVG + GSAP)
   Réplica de la animación de React Bits:
   - dibuja el contorno de cada palabra (stroke-dashoffset)
   - rellena con un "wipe" direccional
   - trigger: una vez al montar + redibujar al pasar el mouse
   - flotación independiente por palabra (cada palabra en su propio <g>,
     que SÍ respeta transform en todos los navegadores)
   Las "O" se sustituyen por canicas.
   ============================================================ */

const SVGNS = 'http://www.w3.org/2000/svg';

// Palabras del título con su color. ⊙ marca la posición de una canica.
const TITLE_SEGMENTS = [
  { text: '¿P⊙R',    color: '#ebc254', signAt: [0] },  // POR QUÉ = amarillo; ¿ = verde
  { text: 'QUÉ',     color: '#ebc254' },
  { text: 'SIEMPRE', color: '#0b46cd' },               // azul
  { text: 'Y⊙?',     color: '#e44c50', signAt: [2] },  // YO = rojo; ? = verde
];
const SIGN_COLOR = '#9fa650';                           // signos de interrogación = verde

function buildStrokeTitle(host, opts = {}) {
  const fontSize = opts.fontSize || 60;
  const fontWeight = opts.fontWeight || 800;
  const letterSpacing = opts.letterSpacing != null ? opts.letterSpacing : -1;
  const strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : Math.max(fontSize * 0.04, 2.5);

  host.innerHTML = '';
  host.classList.add('stroke-title-host');

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'stroke-title-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-label', '¿POR QUÉ SIEMPRE YO?');
  svg.setAttribute('role', 'img');
  host.appendChild(svg);

  const fontStyle = `font-family:'Righteous',cursive;font-size:${fontSize}px;font-weight:${fontWeight};letter-spacing:${letterSpacing}px;`;
  const spaceWidth = fontSize * 0.32; // separación entre palabras

  // --- Construcción: un GRUPO <g> por palabra ---
  // Cada grupo contiene su <text> de contorno + <text> de relleno (con wipe
  // propio) + sus canicas. Medimos y posicionamos palabra por palabra.
  const words = [];  // { g, strokeText, fillText, wipeRect, marbleSlots:[{tspan}], strokes:[] }

  TITLE_SEGMENTS.forEach((seg, segIdx) => {
    // Grupo EXTERNO: lo anima GSAP (flotación). No lleva transform propio.
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('data-word-group', segIdx);
    svg.appendChild(g);
    // Grupo INTERNO: lleva la traslación de posicionamiento (no lo toca GSAP).
    const gPos = document.createElementNS(SVGNS, 'g');
    g.appendChild(gPos);

    // contorno
    const strokeText = document.createElementNS(SVGNS, 'text');
    strokeText.setAttribute('x', '0'); strokeText.setAttribute('y', '0');
    strokeText.setAttribute('fill', 'none');
    strokeText.setAttribute('stroke-width', strokeWidth);
    strokeText.setAttribute('stroke-linejoin', 'round');
    strokeText.setAttribute('stroke-linecap', 'round');
    strokeText.setAttribute('style', fontStyle);

    // relleno (con stroke del mismo color para engrosar)
    const fillText = document.createElementNS(SVGNS, 'text');
    fillText.setAttribute('x', '0'); fillText.setAttribute('y', '0');
    fillText.setAttribute('stroke-width', strokeWidth);
    fillText.setAttribute('stroke-linejoin', 'round');
    fillText.setAttribute('stroke-linecap', 'round');
    fillText.setAttribute('paint-order', 'stroke');
    fillText.setAttribute('style', fontStyle);

    const marbleSlots = [];
    const chars = Array.from(seg.text);
    chars.forEach((ch, i) => {
      const isSign = seg.signAt && seg.signAt.includes(i);
      const color = isSign ? SIGN_COLOR : seg.color;
      if (ch === '⊙') {
        const sp = document.createElementNS(SVGNS, 'tspan');
        sp.setAttribute('fill', 'transparent');
        sp.setAttribute('stroke', 'none');
        sp.textContent = 'O';
        fillText.appendChild(sp);
        const sp2 = document.createElementNS(SVGNS, 'tspan');
        sp2.setAttribute('stroke', 'none');
        sp2.textContent = 'O';
        strokeText.appendChild(sp2);
        marbleSlots.push({ tspan: sp });
      } else {
        const t = document.createElementNS(SVGNS, 'tspan');
        t.setAttribute('fill', color);
        t.setAttribute('stroke', color);
        t.setAttribute('data-fill-char', '1');
        t.textContent = ch;
        fillText.appendChild(t);
        const ts = document.createElementNS(SVGNS, 'tspan');
        ts.setAttribute('stroke', color);
        ts.setAttribute('data-stroke-char', '1');
        ts.textContent = ch;
        strokeText.appendChild(ts);
      }
    });

    // wipe clip para esta palabra
    const defs = document.createElementNS(SVGNS, 'defs');
    const wipeId = 'stk-w-' + Math.random().toString(36).slice(2, 7);
    const clip = document.createElementNS(SVGNS, 'clipPath');
    clip.setAttribute('id', wipeId);
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const wipeRect = document.createElementNS(SVGNS, 'rect');
    clip.appendChild(wipeRect);
    defs.appendChild(clip);
    fillText.setAttribute('clip-path', `url(#${wipeId})`);

    gPos.appendChild(defs);
    gPos.appendChild(strokeText);
    gPos.appendChild(fillText);

    const marbleGroup = document.createElementNS(SVGNS, 'g');
    gPos.appendChild(marbleGroup);

    words.push({ g, gPos, strokeText, fillText, wipeRect, marbleSlots, marbleGroup, box: null });
  });

  // --- Medir, posicionar cada palabra en secuencia, animar ---
  const run = () => {
    // Medir cada palabra (en su origen 0,0)
    let totalW = 0, maxTop = Infinity, maxBot = -Infinity;
    const metrics = [];
    for (const wd of words) {
      let bb;
      try { bb = wd.strokeText.getBBox(); } catch (e) { return; }
      if (!bb || !bb.width) return;
      metrics.push(bb);
      totalW += bb.width;
      maxTop = Math.min(maxTop, bb.y);
      maxBot = Math.max(maxBot, bb.y + bb.height);
    }
    totalW += spaceWidth * (words.length - 1);

    // Posicionar palabras una tras otra, centradas en x=0
    let cursor = -totalW / 2;
    words.forEach((wd, i) => {
      const bb = metrics[i];
      const tx = cursor - bb.x;
      wd.gPos.setAttribute('transform', `translate(${tx},0)`);
      // wipe cubre la caja de ESTA palabra
      wd.box = { x: bb.x - strokeWidth, y: bb.y - strokeWidth, width: bb.width + strokeWidth * 2, height: bb.height + strokeWidth * 2 };
      cursor += bb.width + spaceWidth;
      positionMarbles(wd);
    });

    const pad = Math.max(strokeWidth, fontSize * 0.14);
    const vb = { x: -totalW / 2 - pad, y: maxTop - pad, width: totalW + pad * 2, height: (maxBot - maxTop) + pad * 2 };
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
    host.style.setProperty('--stroke-title-w', vb.width + 'px');

    animate();
  };

  function positionMarbles(wd) {
    wd.marbleGroup.innerHTML = '';
    wd.marbleSlots.forEach((slot, idx) => {
      let ext;
      try { ext = slot.tspan.getExtentOfChar(0); } catch (e) { return; }
      const cx = ext.x + ext.width / 2;
      const cy = ext.y + ext.height / 2;
      const d = Math.min(ext.width * 1.05, ext.height * 0.9);
      const wrap = document.createElementNS(SVGNS, 'svg');
      wrap.setAttribute('x', cx - d / 2);
      wrap.setAttribute('y', cy - d / 2);
      wrap.setAttribute('width', d);
      wrap.setAttribute('height', d);
      wrap.setAttribute('viewBox', '0 0 100 100');
      wrap.setAttribute('overflow', 'visible');
      wrap.innerHTML = (typeof svgMarble === 'function') ? svgMarble('tt' + Math.random().toString(36).slice(2, 6)) : '';
      wd.marbleGroup.appendChild(wrap);
    });
  }

  let tl = null;
  let floatTweens = [];

  function animate() {
    const drawDuration = opts.drawDuration || 1.6;
    const fillDelay = opts.fillDelay != null ? opts.fillDelay : 0.2;
    const stagger = opts.stagger != null ? opts.stagger : 0.05;
    const ease = opts.ease || 'power3.out';
    const fillDuration = Math.max(0.4, drawDuration * 0.5);
    const dash = Math.max(fontSize * 7, 200);

    const allStrokes = [];
    words.forEach(wd => { wd.strokes = Array.from(wd.strokeText.querySelectorAll('[data-stroke-char]')); allStrokes.push(...wd.strokes); });

    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof gsap === 'undefined' || prefersReduced) { finalState(dash); startFloatCSS(); return; }

    const play = () => {
      stopFloat();
      words.forEach(wd => {
        wd.marbles = Array.from(wd.marbleGroup.children); // array real (no HTMLCollection)
        if (wd.strokes.length) gsap.set(wd.strokes, { strokeDasharray: dash, strokeDashoffset: dash, strokeOpacity: 1 });
        gsap.set(wd.wipeRect, { attr: { x: wd.box.x, y: wd.box.y, width: 0, height: wd.box.height } });
        if (wd.marbles.length) gsap.set(wd.marbles, { opacity: 0 });
      });

      tl = gsap.timeline({ onComplete: startFloat });
      if (allStrokes.length) tl.to(allStrokes, { strokeDashoffset: 0, duration: drawDuration, ease, stagger }, 0);
      words.forEach(wd => {
        tl.to(wd.wipeRect, { attr: { width: wd.box.width }, duration: fillDuration, ease: 'power2.inOut' }, drawDuration + fillDelay);
        if (wd.marbles.length) tl.to(wd.marbles, { opacity: 1, duration: 0.5, ease: 'power2.out' }, drawDuration + fillDelay);
      });
    };
    stopFloat();
    play();

    if (opts.hoverRedraw !== false) {
      host.addEventListener('pointerenter', () => {
        if (!tl || tl.progress() < 1) return;
        play();
      });
    }
  }

  // Flotación por palabra con CSS puro (fiable en SVG): cada <g> recibe su
  // propia animación con amplitud/duración/desfase distintos.
  function startFloat() {
    words.forEach((wd, w) => {
      const dur = (2.3 + w * 0.4).toFixed(2);
      const delay = (w * 0.3).toFixed(2);
      const amp = 7 + (w % 2) * 4;
      // Solo translateY vía atributo SVG (fiable en todos los navegadores).
      wd.g.style.setProperty('--fl-amp', `-${amp}px`);
      wd.g.style.animation = `wordFloatY ${dur}s ease-in-out ${delay}s infinite`;
      wd.floating = true;
    });
  }
  function stopFloat() {
    words.forEach(wd => { if (wd.g) { wd.g.style.animation = 'none'; wd.floating = false; } });
  }
  const startFloatCSS = startFloat;

  function finalState(dash) {
    words.forEach(wd => {
      const strokes = Array.from(wd.strokeText.querySelectorAll('[data-stroke-char]'));
      if (typeof gsap !== 'undefined') {
        gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0, strokeOpacity: 1 });
        gsap.set(wd.wipeRect, { attr: { x: wd.box.x, y: wd.box.y, width: wd.box.width, height: wd.box.height } });
      } else {
        wd.wipeRect.setAttribute('x', wd.box.x); wd.wipeRect.setAttribute('y', wd.box.y);
        wd.wipeRect.setAttribute('width', wd.box.width); wd.wipeRect.setAttribute('height', wd.box.height);
      }
      Array.from(wd.marbleGroup.children).forEach(c => { c.style.opacity = '1'; });
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(run)).catch(() => requestAnimationFrame(run));
  } else {
    requestAnimationFrame(run);
  }
  // Reposicionar en resize, SIN reiniciar la animación/flotación (evita
  // que el observer mate la flotación recién iniciada). Debounce + solo si
  // cambió el ancho de forma relevante.
  if (typeof ResizeObserver !== 'undefined') {
    let lastW = 0, roTimer = null;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0] && entries[0].contentRect ? Math.round(entries[0].contentRect.width) : 0;
      if (Math.abs(w - lastW) < 2) return;  // ignora micro-cambios
      lastW = w;
      clearTimeout(roTimer);
      roTimer = setTimeout(() => { try { run(); } catch (e) {} }, 250);
    });
    ro.observe(host);
  }

  return { replay: () => run() };
}

function renderStrokeTitles() {
  document.querySelectorAll('[data-stroke-title]').forEach(host => {
    const fs = parseInt(host.getAttribute('data-title-fontsize') || '60', 10);
    // hoverRedraw desactivado: evita que el título se redibuje (glitch) al
    // pasar el mouse por el header durante el juego.
    buildStrokeTitle(host, { fontSize: fs, hoverRedraw: false });
  });
}
