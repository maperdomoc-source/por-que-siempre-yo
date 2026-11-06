# ¿Por Qué Siempre Yo? 🎲

El clásico juego de mesa **«Caja 6»** llevado al navegador. Juega contra el BOT o en línea con tus amigos, cada uno desde su dispositivo. **El primero en quedarse sin canicas gana.**

![Hecho con](https://img.shields.io/badge/HTML-CSS-JS-orange) ![Sin build](https://img.shields.io/badge/sin_build-100%25_est%C3%A1tico-brightgreen)

## 🎮 Modos de juego

- **1 vs BOT** — juega una partida local contra la máquina.
- **Online** — crea una sala, comparte el código y juega con 2 a 4 personas reales, cada una en su propio dispositivo (móvil o computador).

## 📜 Reglas

- El objetivo es quedarse con **0 canicas**.
- En tu turno lanzas el dado y debes hacer **clic en la casilla que indica el dado**.
- Si te equivocas de casilla: **+1 canica de castigo** y pierdes el turno.
- Si sale **6**: tu canica cae en el pozo central y desaparece.
- Si la casilla (1-5) está **vacía**: colocas una canica ahí.
- Si la casilla (1-5) está **ocupada**: te llevas esa canica (+1) y pierdes el turno.

## ✨ Características

- Tablero 3D de madera con temas de color.
- Dado animado sincronizado en todos los dispositivos (online).
- Efectos de sonido generados con **Web Audio API** (sin archivos externos).
- Pantalla de inicio y pantalla de victoria con confetti en **todos** los dispositivos.
- «Volver a jugar»: solo los jugadores que acepten vuelven a la partida. Si queda uno solo, regresa a la pantalla de inicio.
- Responsive: funciona en celular y computador.

## 🚀 Cómo ejecutar

Es un sitio 100% estático, no necesita build. Ábrelo con cualquier servidor estático:

```bash
# Opción rápida con Python
python3 -m http.server 8000
# luego abre http://localhost:8000
```

O simplemente abre `index.html` en tu navegador.

## 🌐 Desplegar

### Netlify
1. Sube el repo a GitHub.
2. En Netlify: **Add new site → Import from Git** y selecciona el repo.
3. No configures comando de build. Publica el directorio raíz (`.`).

### GitHub Pages
1. Sube el repo a GitHub.
2. **Settings → Pages → Deploy from a branch → `main` / root**.

## 📁 Estructura

```
.
├── index.html    # Estructura y pantallas
├── style.css     # Estilos (tablero 3D, canicas, pantallas)
├── game.js       # Lógica del juego, sonidos y multijugador online
├── netlify.toml  # Config de despliegue en Netlify
└── README.md
```

## 🔌 Multijugador online

Usa [PeerJS](https://peerjs.com/) (WebRTC) para conexiones peer-to-peer usando el servidor público de señalización de PeerJS. El anfitrión actúa como autoridad del estado del juego y sincroniza a los invitados.

> Nota: al depender del servidor público de PeerJS, en redes muy restrictivas la conexión podría fallar.
