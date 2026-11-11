/* ============================================================
   TextGradientScroll (vanilla JS)
   El texto arranca casi invisible y cada palabra se ILUMINA
   (opacity ~0 → 1) a medida que el usuario hace scroll.
   Al llegar al final del scroll, TODO el texto queda visible.
   ============================================================ */

const GRADIENT_BASE_OPACITY = 0.03; // casi invisible al inicio

function setupGradientScroll(scrollEl) {
  const inner = scrollEl.querySelector('[data-gradient-scroll]');
  if (!inner) return;

  if (inner.dataset.gsReady !== '1') {
    // Envolver cada palabra en spans animables (conservando color original)
    const blocks = inner.querySelectorAll('p, li');
    const wordSpans = [];
    blocks.forEach(block => {
      const color = block.style.color || '';
      const nodes = Array.from(block.childNodes);
      block.innerHTML = '';
      nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent.split(/(\s+)/).forEach(w => {
            if (/^\s+$/.test(w) || w === '') { block.appendChild(document.createTextNode(w)); return; }
            const span = document.createElement('span');
            span.className = 'gs-word';
            span.textContent = w;
            if (color) span.style.color = color;
            block.appendChild(span);
            wordSpans.push(span);
          });
        } else {
          if (node.classList) { node.classList.add('gs-word'); wordSpans.push(node); }
          block.appendChild(node);
        }
      });
    });
    inner._gsWords = wordSpans;
    inner.dataset.gsReady = '1';
    scrollEl.addEventListener('scroll', () => requestUpdate(scrollEl), { passive: true });
  }

  requestUpdate(scrollEl);
}

// rAF-throttle para que el movimiento sea bien suave
function requestUpdate(scrollEl) {
  if (scrollEl._gsRaf) return;
  scrollEl._gsRaf = requestAnimationFrame(() => {
    scrollEl._gsRaf = null;
    updateGradientScroll(scrollEl);
  });
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function updateGradientScroll(scrollEl) {
  const inner = scrollEl.querySelector('[data-gradient-scroll]');
  if (!inner || !inner._gsWords) return;

  const words = inner._gsWords;
  const n = words.length;
  if (!n) return;

  // Progreso global del scroll 0→1. Si no hay scroll posible, todo visible.
  const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
  const scrolled = maxScroll > 4 ? scrollEl.scrollTop / maxScroll : 1;

  // Cada palabra tiene su propio punto de activación repartido a lo largo
  // del texto. Usamos una "ventana" de revelado para que varias palabras
  // transicionen a la vez (efecto fluido, tipo barrido).
  // El mapeo se comprime un poco (0.9) para que ANTES de llegar al final
  // del scroll el texto ya esté completamente revelado.
  const window = 0.28;                    // ventana amplia = barrido muy suave
  const reach = 0.92;                     // el texto termina de revelarse al 92% del scroll
  const head = scrolled / reach;          // cabeza de revelado normalizada

  words.forEach((span, i) => {
    const wordPos = i / Math.max(1, n - 1);        // 0..1 posición de la palabra
    let p = (head - wordPos) / window + 1;          // progreso local
    p = Math.max(0, Math.min(1, p));
    p = easeInOut(p);
    const opacity = GRADIENT_BASE_OPACITY + (1 - GRADIENT_BASE_OPACITY) * p;
    span.style.opacity = opacity.toFixed(3);
  });
}

function initGradientScrolls() {
  document.querySelectorAll('.gradient-scroll').forEach(setupGradientScroll);
}
