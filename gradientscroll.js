/* ============================================================
   TextGradientScroll (vanilla JS)
   Réplica del efecto de React + Framer Motion:
   el texto empieza tenue y cada palabra se ILUMINA (opacity 0→1)
   a medida que el usuario hace scroll dentro del contenedor.
   ============================================================ */

const GRADIENT_BASE_OPACITY = 0.12; // opacidad de arranque (como "soft")

// Prepara un contenedor [data-gradient-scroll]: envuelve cada palabra en un
// <span> con dos capas (una tenue fija + una que se ilumina con el scroll).
function setupGradientScroll(scrollEl) {
  const inner = scrollEl.querySelector('[data-gradient-scroll]');
  if (!inner || inner.dataset.gsReady === '1') { updateGradientScroll(scrollEl); return; }

  // Envolver cada palabra de cada bloque de texto en spans animables
  const blocks = inner.querySelectorAll('p, li');
  const wordSpans = [];
  blocks.forEach(block => {
    const color = block.style.color || '';
    const walker = Array.from(block.childNodes);
    block.innerHTML = '';
    walker.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const words = node.textContent.split(/(\s+)/); // conserva espacios
        words.forEach(w => {
          if (/^\s+$/.test(w) || w === '') { block.appendChild(document.createTextNode(w)); return; }
          const span = document.createElement('span');
          span.className = 'gs-word';
          span.textContent = w;
          if (color) span.style.color = color;
          block.appendChild(span);
          wordSpans.push(span);
        });
      } else {
        // elementos (strong, etc.): tratarlos como una unidad animable
        node.classList && node.classList.add('gs-word');
        block.appendChild(node);
        if (node.classList) wordSpans.push(node);
      }
    });
  });

  inner._gsWords = wordSpans;
  inner.dataset.gsReady = '1';

  scrollEl.addEventListener('scroll', () => updateGradientScroll(scrollEl), { passive: true });
  updateGradientScroll(scrollEl);
}

// Calcula, para cada palabra, su opacidad según la posición de scroll.
// La "línea de revelado" está en el centro del contenedor: lo que ya pasó
// por encima del centro queda iluminado; lo de abajo, tenue.
function updateGradientScroll(scrollEl) {
  const inner = scrollEl.querySelector('[data-gradient-scroll]');
  if (!inner || !inner._gsWords) return;

  const rect = scrollEl.getBoundingClientRect();
  const revealLine = rect.top + rect.height * 0.62;   // zona de revelado
  const fade = rect.height * 0.35;                    // suavidad de la transición

  inner._gsWords.forEach(span => {
    const r = span.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    // progreso: 1 cuando la palabra está por encima de la línea, 0 por debajo
    let p = (revealLine - mid) / fade;
    p = Math.max(0, Math.min(1, p));
    const opacity = GRADIENT_BASE_OPACITY + (1 - GRADIENT_BASE_OPACITY) * p;
    span.style.opacity = opacity.toFixed(3);
  });
}

// Inicializa todos los contenedores de scroll-reveal presentes
function initGradientScrolls() {
  document.querySelectorAll('.gradient-scroll').forEach(setupGradientScroll);
}
