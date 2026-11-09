/* ============================================================
   StrokeText (vanilla JS + SVG + GSAP)
   Réplica de la animación de React Bits:
   - dibuja el contorno de cada palabra (stroke-dashoffset)
   - rellena con un "wipe" direccional
   - trigger: una vez al montar + redibujar al pasar el mouse (hoverRedraw)
   Las "O" se sustituyen por canicas (sin trazo animado).
   ============================================================ */

const SVGNS = 'http://www.w3.org/2000/svg';

// Palabras del título con su color. El texto se segmenta por palabra para
// poder darle un color distinto a cada una. Las "O" (marcadas con *) se
// renderizan como canica en lugar de glifo.
// Formato: { text, color }  — usamos un marcador ⊙ para la posición de canica.
const TITLE_SEGMENTS = [
  { text: '¿P⊙R',   color: '#9fa650', signAt: [0] },         // ¿ dorado, resto oliva
  { text: 'QUÉ',    color: '#9fa650' },
  { text: 'SIEMPRE', color: '#0b46cd' },
  { text: 'Y⊙?',    color: '#e44c50', signAt: [2] },         // ? dorado
];
const SIGN_COLOR = '#ebc254';

/* Construye un <span> con el SVG del título animado dentro de `host`. */
function buildStrokeTitle(host, opts = {}) {
  const fontSize = opts.fontSize || 60;
  const fontWeight = opts.fontWeight || 700;        // Caveat llega hasta 700
  const letterSpacing = opts.letterSpacing != null ? opts.letterSpacing : 1;
  const strokeColor = opts.strokeColor || 'rgba(255,255,255,0.55)';
  const strokeWidth = opts.strokeWidth != null ? opts.strokeWidth : Math.max(fontSize * 0.045, 3); // grosor para engordar la fuente

  host.innerHTML = '';
  host.classList.add('stroke-title-host');

  // SVG raíz (se dimensiona tras medir)
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'stroke-title-svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-label', '¿POR QUÉ SIEMPRE YO?');
  svg.setAttribute('role', 'img');
  host.appendChild(svg);

  const defs = document.createElementNS(SVGNS, 'defs');
  svg.appendChild(defs);

  // Fuente del título: Caveat (manuscrita) en MAYÚSCULAS, bien gruesa.
  const fontStyle = `font-family:'Caveat',cursive;font-size:${fontSize}px;font-weight:${fontWeight};letter-spacing:${letterSpacing}px;text-transform:uppercase;`;

  // Grupo de relleno (texto con color, revelado por wipe).
  // Añadimos un stroke del MISMO color que el relleno para engrosar la fuente.
  const fillText = document.createElementNS(SVGNS, 'text');
  fillText.setAttribute('x', '0'); fillText.setAttribute('y', '0');
  fillText.setAttribute('stroke-width', strokeWidth);
  fillText.setAttribute('stroke-linejoin', 'round');
  fillText.setAttribute('stroke-linecap', 'round');
  fillText.setAttribute('paint-order', 'stroke');
  fillText.setAttribute('style', fontStyle);

  // Grupo de contorno (se dibuja con dashoffset). El color del trazo coincide
  // con el color de cada palabra (asignado por tspan) para que NO se vea una
  // línea de otro color: el borde es del mismo color que la letra.
  const strokeText = document.createElementNS(SVGNS, 'text');
  strokeText.setAttribute('x', '0'); strokeText.setAttribute('y', '0');
  strokeText.setAttribute('fill', 'none');
  strokeText.setAttribute('stroke-width', strokeWidth);
  strokeText.setAttribute('stroke-linejoin', 'round');
  strokeText.setAttribute('stroke-linecap', 'round');
  strokeText.setAttribute('style', fontStyle);

  // Posiciones de canica (en coordenadas de glifo) las calculamos tras medir
  const marbleSlots = []; // { tspan, color }

  // Construir tspans palabra por palabra
  TITLE_SEGMENTS.forEach((seg, segIdx) => {
    const chars = Array.from(seg.text);
    chars.forEach((ch, i) => {
      const isSign = seg.signAt && seg.signAt.includes(i);
      const color = isSign ? SIGN_COLOR : seg.color;

      if (ch === '⊙') {
        // Hueco para canica: un tspan espaciador invisible del ancho de una "O"
        const sp = document.createElementNS(SVGNS, 'tspan');
        sp.setAttribute('fill', 'transparent');
        sp.setAttribute('stroke', 'none');
        sp.textContent = 'O';
        sp.setAttribute('data-marble', '1');
        fillText.appendChild(sp);

        const sp2 = document.createElementNS(SVGNS, 'tspan');
        sp2.setAttribute('stroke', 'none');
        sp2.textContent = 'O';
        strokeText.appendChild(sp2); // en contorno dejamos la O (se dibuja) para forma; luego la tapamos con canica
        marbleSlots.push({ tspan: sp });
      } else {
        const t = document.createElementNS(SVGNS, 'tspan');
        t.setAttribute('fill', color);
        t.setAttribute('stroke', color);     // mismo color → engrosa sin verse borde
        t.setAttribute('data-fill-char', '1');
        t.textContent = ch;
        fillText.appendChild(t);

        const ts = document.createElementNS(SVGNS, 'tspan');
        ts.setAttribute('stroke', color);    // contorno del MISMO color de la palabra
        ts.setAttribute('data-stroke-char', '1');
        ts.textContent = ch;
        strokeText.appendChild(ts);
      }
    });
    // Espacio entre palabras (excepto la última)
    if (segIdx < TITLE_SEGMENTS.length - 1) {
      [fillText, strokeText].forEach(parent => {
        const sp = document.createElementNS(SVGNS, 'tspan');
        sp.textContent = ' ';
        parent.appendChild(sp);
      });
    }
  });

  // clipPath para el wipe del relleno
  const wipeId = 'stk-wipe-' + Math.random().toString(36).slice(2, 7);
  const clip = document.createElementNS(SVGNS, 'clipPath');
  clip.setAttribute('id', wipeId);
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const wipeRect = document.createElementNS(SVGNS, 'rect');
  clip.appendChild(wipeRect);
  defs.appendChild(clip);
  fillText.setAttribute('clip-path', `url(#${wipeId})`);

  // Orden de pintado: contorno primero, luego relleno (encima)
  svg.appendChild(strokeText);
  svg.appendChild(fillText);

  // Grupo de canicas DENTRO del SVG (mismo sistema de coordenadas que el texto)
  const marbleGroup = document.createElementNS(SVGNS, 'g');
  svg.appendChild(marbleGroup);

  // Medir y animar cuando el layout esté listo
  const run = () => {
    let bbox;
    try { bbox = strokeText.getBBox(); } catch (e) { return; }
    if (!bbox || !bbox.width) return;

    const pad = Math.max(strokeWidth, fontSize * 0.12);
    const box = { x: bbox.x - pad, y: bbox.y - pad, width: bbox.width + pad * 2, height: bbox.height + pad * 2 };
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
    host.style.setProperty('--stroke-title-w', box.width + 'px');

    // Posicionar canicas sobre cada hueco "O"
    positionMarbles();

    // Preparar y lanzar la animación
    animate(box);
  };

  function positionMarbles() {
    marbleGroup.innerHTML = '';
    marbleSlots.forEach((slot, idx) => {
      let ext;
      try { ext = slot.tspan.getExtentOfChar(0); } catch (e) { return; }
      // Centro y tamaño del glifo "O" en coordenadas SVG (robusto, sin px)
      const cx = ext.x + ext.width / 2;
      const cy = ext.y + ext.height / 2;
      // La canica cubre el aro de la "O". En fuentes manuscritas la "O" es
      // más estrecha, así que la basamos en el alto del glifo.
      const d = ext.height * 0.9;
      // Contenedor SVG que hospeda el SVG de la canica
      const wrap = document.createElementNS(SVGNS, 'svg');
      wrap.setAttribute('class', 'stroke-title-marble-svg');
      wrap.setAttribute('x', cx - d / 2);
      wrap.setAttribute('y', cy - d / 2);
      wrap.setAttribute('width', d);
      wrap.setAttribute('height', d);
      wrap.setAttribute('viewBox', '0 0 100 100');
      wrap.setAttribute('overflow', 'visible');
      wrap.innerHTML = (typeof svgMarble === 'function') ? svgMarble('tt' + idx) : '';
      // el svg interno de svgMarble ya trae su propio viewBox 0 0 100 100
      marbleGroup.appendChild(wrap);
    });
  }

  let tl = null;
  let drawnOnce = false;

  function animate(box) {
    if (typeof gsap === 'undefined') { // sin GSAP: mostrar estado final
      finalState(box); return;
    }
    const strokes = Array.from(strokeText.querySelectorAll('[data-stroke-char]'));
    const dash = Math.max(fontSize * 7, 200);
    const drawDuration = opts.drawDuration || 1.6;
    const fillDelay = opts.fillDelay != null ? opts.fillDelay : 0.2;
    const stagger = opts.stagger != null ? opts.stagger : 0.05;
    const ease = opts.ease || 'power3.out';
    const fillDuration = Math.max(0.4, drawDuration * 0.5);

    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { finalState(box); return; }

    const play = () => {
      gsap.killTweensOf([...strokes, wipeRect, ...marbleGroup.children]);
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash, strokeOpacity: 1 });
      gsap.set(wipeRect, { attr: { x: box.x, y: box.y, width: 0, height: box.height } });
      gsap.set(marbleGroup.children, { opacity: 0 });

      tl = gsap.timeline();
      tl.to(strokes, { strokeDashoffset: 0, duration: drawDuration, ease, stagger }, 0);
      tl.to(wipeRect, { attr: { width: box.width }, duration: fillDuration, ease: 'power2.inOut' }, drawDuration + fillDelay);
      tl.to(marbleGroup.children, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, drawDuration + fillDelay);
      drawnOnce = true;
    };
    play();

    // Redibujar al pasar el mouse (una vez completado el primer dibujo)
    if (opts.hoverRedraw !== false) {
      host.addEventListener('pointerenter', () => {
        if (!tl || tl.progress() < 1) return;
        play();
      });
    }
  }

  function finalState(box) {
    const strokes = Array.from(strokeText.querySelectorAll('[data-stroke-char]'));
    const dash = Math.max(fontSize * 7, 200);
    if (typeof gsap !== 'undefined') {
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0, strokeOpacity: 1 });
      gsap.set(wipeRect, { attr: { x: box.x, y: box.y, width: box.width, height: box.height } });
    } else {
      wipeRect.setAttribute('x', box.x); wipeRect.setAttribute('y', box.y);
      wipeRect.setAttribute('width', box.width); wipeRect.setAttribute('height', box.height);
    }
    // canicas visibles
    Array.from(marbleGroup.children).forEach(c => { c.style.opacity = '1'; });
  }

  // Esperar a que la fuente esté lista para medir bien
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(run)).catch(() => requestAnimationFrame(run));
  } else {
    requestAnimationFrame(run);
  }
  // Reposicionar canicas si cambia el tamaño
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { try { positionMarbles(); } catch (e) {} });
    ro.observe(host);
  }

  return { replay: () => run() };
}

// Renderiza el título animado en todos los contenedores [data-stroke-title]
function renderStrokeTitles() {
  document.querySelectorAll('[data-stroke-title]').forEach(host => {
    const fs = parseInt(host.getAttribute('data-title-fontsize') || '60', 10);
    buildStrokeTitle(host, { fontSize: fs });
  });
}
