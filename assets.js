/* ============================================================
   ASSETS GRÁFICOS — SVG inline (canica, stickers, tablero)
   Recreados a mano para integrarse nítidos y escalables.
   ============================================================ */

/* Canica de cristal con espiral tricolor colombiana.
   `idSuffix` evita colisiones de IDs de gradientes cuando hay varias. */
function svgMarble(idSuffix = '') {
  const s = String(idSuffix);
  return `
  <svg viewBox="0 0 100 100" class="marble-svg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glass${s}" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="18%" stop-color="#eaf6ff" stop-opacity="0.55"/>
        <stop offset="55%" stop-color="#bcd6e6" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#5b7585" stop-opacity="0.55"/>
      </radialGradient>
      <radialGradient id="rim${s}" cx="50%" cy="50%" r="50%">
        <stop offset="78%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#1b2a33" stop-opacity="0.55"/>
      </radialGradient>
      <clipPath id="ball${s}"><circle cx="50" cy="50" r="46"/></clipPath>
    </defs>

    <!-- cuerpo de cristal -->
    <circle cx="50" cy="50" r="46" fill="url(#glass${s})"/>

    <!-- espiral tricolor en forma de S (amarillo, azul, rojo) -->
    <g clip-path="url(#ball${s})">
      <path d="M62 10 C28 30, 72 55, 38 78 C30 83, 30 90, 36 92
               C44 88, 42 80, 50 74 C84 52, 40 30, 70 14 Z"
            fill="#ffd21e" opacity="0.92"/>
      <path d="M57 11 C25 31, 67 54, 34 77 C40 84, 46 84, 50 80
               C80 56, 38 33, 64 13 Z"
            fill="#0b3fae" opacity="0.92"/>
      <path d="M52 12 C22 32, 60 53, 30 76 C36 82, 44 82, 48 78
               C74 58, 34 35, 58 14 Z"
            fill="#d8232a" opacity="0.9"/>
    </g>

    <!-- borde oscuro de volumen -->
    <circle cx="50" cy="50" r="46" fill="url(#rim${s})"/>
    <!-- brillo superior -->
    <ellipse cx="37" cy="30" rx="18" ry="11" fill="#ffffff" opacity="0.65"/>
    <circle cx="66" cy="66" r="6" fill="#ffffff" opacity="0.25"/>
  </svg>`;
}

/* ---------- STICKERS (tipo parche recortado) ---------- */

const STICKER_CHIVA = `
<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
  <g>
    <rect x="18" y="34" width="86" height="34" rx="6" fill="#e23b3b" stroke="#fff" stroke-width="3"/>
    <rect x="18" y="44" width="86" height="8" fill="#f2c200"/>
    <rect x="18" y="52" width="86" height="8" fill="#1f6fd0"/>
    <rect x="24" y="24" width="74" height="12" rx="4" fill="#3aa655" stroke="#fff" stroke-width="2"/>
    <rect x="30" y="16" width="20" height="10" rx="2" fill="#f2c200"/>
    <rect x="54" y="16" width="20" height="10" rx="2" fill="#e23b3b"/>
    <rect x="78" y="16" width="16" height="10" rx="2" fill="#1f6fd0"/>
    <rect x="26" y="40" width="12" height="12" rx="2" fill="#bfe3ff"/>
    <rect x="44" y="40" width="12" height="12" rx="2" fill="#bfe3ff"/>
    <rect x="62" y="40" width="12" height="12" rx="2" fill="#bfe3ff"/>
    <rect x="80" y="40" width="12" height="12" rx="2" fill="#bfe3ff"/>
    <circle cx="36" cy="70" r="9" fill="#2b2b2b" stroke="#fff" stroke-width="2"/>
    <circle cx="36" cy="70" r="3" fill="#cfcfcf"/>
    <circle cx="86" cy="70" r="9" fill="#2b2b2b" stroke="#fff" stroke-width="2"/>
    <circle cx="86" cy="70" r="3" fill="#cfcfcf"/>
  </g>
</svg>`;

const STICKER_SOMBRERO = `
<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#2b2b2b" stroke-width="2" fill="none">
    <ellipse cx="60" cy="52" rx="52" ry="18" fill="#f3ece0"/>
    <path d="M24 50 Q60 18 96 50" fill="#efe6d6"/>
    <path d="M30 49 Q60 24 90 49" />
    <path d="M36 47 Q60 30 84 47" />
    <path d="M42 45 Q60 34 78 45" />
    <ellipse cx="60" cy="52" rx="52" ry="18" />
  </g>
  <path d="M24 50 Q60 36 96 50 Q60 64 24 50" fill="#1f1f1f" opacity="0.85"/>
</svg>`;

const STICKER_CANASTA = `
<svg viewBox="0 0 110 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="40" cy="40" r="13" fill="#e23b3b"/>
  <circle cx="62" cy="36" r="12" fill="#f2a900"/>
  <circle cx="52" cy="30" r="10" fill="#8bc34a"/>
  <path d="M70 44 q8 -2 10 6 q-8 4 -12 -2 Z" fill="#f2c200"/>
  <path d="M30 44 q-8 0 -8 8 q8 2 11 -4 Z" fill="#f2c200"/>
  <path d="M22 52 h66 l-8 34 a6 6 0 0 1 -6 5 h-32 a6 6 0 0 1 -6 -5 Z"
        fill="#c88a4a" stroke="#8a5a2b" stroke-width="2"/>
  <g stroke="#8a5a2b" stroke-width="2">
    <line x1="34" y1="52" x2="30" y2="91"/>
    <line x1="48" y1="52" x2="46" y2="91"/>
    <line x1="62" y1="52" x2="64" y2="91"/>
    <line x1="76" y1="52" x2="80" y2="91"/>
    <path d="M22 62 h66" fill="none"/>
    <path d="M24 74 h62" fill="none"/>
  </g>
</svg>`;

const STICKER_PLACA = `
<svg viewBox="0 0 120 56" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="114" height="50" rx="7" fill="#f3ead6" stroke="#5a4a2a" stroke-width="3"/>
  <rect x="9" y="9" width="102" height="38" rx="4" fill="none" stroke="#9a8a5a" stroke-width="1.5"/>
  <text x="60" y="34" text-anchor="middle" font-family="Righteous, sans-serif" font-size="22" fill="#2b2b2b" font-weight="700">COL·057</text>
  <text x="60" y="47" text-anchor="middle" font-family="Outfit, sans-serif" font-size="7" fill="#5a4a2a" letter-spacing="2">COLOMBIA</text>
</svg>`;

/* Rama decorativa tallada para el marco del tablero */
const CARVED_LEAF = `
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="1.6" stroke-linecap="round">
    <path d="M20 4 C10 12, 10 28, 20 36 C30 28, 30 12, 20 4 Z"/>
    <path d="M20 8 L20 32"/>
    <path d="M20 14 L13 18 M20 14 L27 18 M20 20 L13 24 M20 20 L27 24"/>
  </g>
</svg>`;
