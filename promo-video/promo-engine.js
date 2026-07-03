const scenes = [...document.querySelectorAll('.scene')];
const progress = document.getElementById('progress');
const totalMs = scenes.reduce((s, el) => s + Number(el.dataset.duration || 3000), 0);
let elapsed = 0;
let idx = 0;

function showScene(i) {
  scenes.forEach((s, n) => s.classList.toggle('active', n === i));
  if (progress) progress.style.width = `${(elapsed / totalMs) * 100}%`;
}

function nextScene() {
  if (idx >= scenes.length) {
    window.__PROMO_DONE__ = true;
    return;
  }
  showScene(idx);
  const dur = Number(scenes[idx].dataset.duration || 3000);
  idx += 1;
  elapsed += dur;
  setTimeout(nextScene, dur);
}

window.__PROMO_TOTAL_MS__ = totalMs;
nextScene();
