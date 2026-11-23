const PREFIX = "sub2api-games:";

function readInt(key, fallback = 0) {
  try {
    const value = Number.parseInt(window.localStorage.getItem(PREFIX + key) ?? "", 10);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function paintBestScores() {
  for (const node of document.querySelectorAll("[data-best-for]")) {
    const key = node.dataset.bestFor;
    const best = readInt(`${key}:best`, 0);
    const label = node.dataset.label || "最高分";
    const value = node.querySelector("strong");

    if (value) {
      value.textContent = best > 0 ? String(best) : "—";
    } else {
      node.textContent = best > 0 ? `${label} ${best}` : `${label} —`;
    }

    node.classList.toggle("has-score", best > 0);
  }
}

function paintEntrance() {
  const cards = document.querySelectorAll(".game-card");

  cards.forEach((card, index) => {
    card.style.setProperty("--i", String(index));
  });
}

paintBestScores();
paintEntrance();

// 从游戏页返回时（bfcache 恢复），分数可能已经变了。
window.addEventListener("pageshow", paintBestScores);
