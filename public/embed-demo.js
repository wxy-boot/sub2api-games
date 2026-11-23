const baseMeta = document.querySelector('meta[name="games-base"]');
const base = baseMeta ? baseMeta.content : "/";
const serviceUrl = new URL(base === "/" ? "." : base.replace(/\/$/, "") + "/", window.location.href)
  .href.replace(/\/$/, "");

const doneButton = document.getElementById("simulateDone");
let sdk = null;

function loadSdk() {
  if (window.Sub2ApiGames) {
    return Promise.resolve(window.Sub2ApiGames);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${serviceUrl}/embed.js`;
    script.onload = () => resolve(window.Sub2ApiGames);
    script.onerror = () => reject(new Error("embed.js 加载失败"));
    document.head.appendChild(script);
  });
}

loadSdk()
  .then((api) => {
    sdk = api;
    api.mount({
      src: serviceUrl,
      game: "snake",
      position: "bottom-right",
      label: "摸鱼一下",
      onEvent(event) {
        if (event.type === "over") {
          console.info("[demo] 一局结束，得分", event.score);
        }
      }
    });
  })
  .catch((error) => {
    console.error(error);
    if (doneButton) {
      doneButton.disabled = true;
      doneButton.textContent = "SDK 加载失败";
    }
  });

doneButton?.addEventListener("click", () => {
  if (!sdk) {
    return;
  }

  sdk.notifyTaskDone({ name: "重构计费模块" });
  doneButton.textContent = "已通知，去看右下角";
  doneButton.disabled = true;

  window.setTimeout(() => {
    doneButton.textContent = "模拟任务完成";
    doneButton.disabled = false;
  }, 6000);
});
