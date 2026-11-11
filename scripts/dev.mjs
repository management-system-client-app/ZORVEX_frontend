import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const viteCli = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const child = spawn(process.execPath, [viteCli, ...process.argv.slice(2)], {
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;

function restoreInput() {
  if (!process.stdin.isTTY) return;
  process.stdin.off("data", stopOnKey);
  if (process.stdin.isRaw) process.stdin.setRawMode(false);
  process.stdin.pause();
}

function stop() {
  if (stopping) return;
  stopping = true;
  restoreInput();
  child.kill("SIGINT");
}

function stopOnKey() {
  stop();
}

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", stopOnKey);
  console.log("Press any key to stop the dev server.");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGTSTP", stop);

child.on("error", (error) => {
  restoreInput();
  console.error("Failed to start the Vite dev server:", error);
  process.exitCode = 1;
});

child.on("close", (code) => {
  restoreInput();
  process.exitCode = stopping ? 0 : (code ?? 1);
});
