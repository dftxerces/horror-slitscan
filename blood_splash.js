const BLOOD_BASE_SRC = '/assets/blood_cursor.gif';
const SPLASH_DURATION = 950;
const MAX_SPLASHES = 5;

let activeSplashes = [];
let splashCounter = 0;

window.addEventListener('mousedown', (e) => {

  if (activeSplashes.length >= MAX_SPLASHES) return;

  const splash = document.createElement('img');
  splash.className = 'blood-splash';
  const size = 90;

  splash.style.left = (e.clientX - size / 2) + 'px';
  splash.style.top  = (e.clientY - size / 2 + 13) + 'px';


  // new ani
  const uniqueSrc = `${BLOOD_BASE_SRC}?v=${splashCounter++}`;

  document.body.appendChild(splash);
  activeSplashes.push(splash);

  splash.src = uniqueSrc;

  // full tl
  setTimeout(() => {
    if (splash.parentNode) {
      splash.parentNode.removeChild(splash);
    }
    activeSplashes = activeSplashes.filter(el => el !== splash);
  }, SPLASH_DURATION);
});
