const LEVELS = { info: "info", warn: "warn", error: "error" };

function write(level, event, fields = {}) {
  const line = {
    ts: new Date().toISOString(),
    level: LEVELS[level] || "info",
    event,
    ...fields
  };

  const text = JSON.stringify(line);

  if (level === "error") {
    console.error(text);
    return;
  }

  if (level === "warn") {
    console.warn(text);
    return;
  }

  console.log(text);
}

export function logInfo(event, fields) {
  write("info", event, fields);
}

export function logWarn(event, fields) {
  write("warn", event, fields);
}

export function logError(event, fields) {
  write("error", event, fields);
}
