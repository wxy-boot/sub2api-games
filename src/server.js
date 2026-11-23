import { createApp } from "./app.js";
import { logInfo } from "./log.js";

const { server, config, assets } = await createApp();

server.listen(config.port, () => {
  logInfo("service.started", {
    port: config.port,
    basePath: config.publicBasePath,
    assets: assets.size,
    assetBytes: [...assets.values()].reduce((total, asset) => total + asset.size, 0),
    allowEmbed: config.allowEmbed
  });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    logInfo("service.stopping", { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
