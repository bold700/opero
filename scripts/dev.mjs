import { join } from "node:path";
import concurrently from "concurrently";

// Some Windows shells omit System32 from PATH, which prevents concurrently
// from finding cmd.exe to launch its child processes.
if (process.platform === "win32") {
  const system32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  const currentPath = process.env[pathKey] ?? "";
  if (!currentPath.split(";").some((entry) => entry.toLowerCase() === system32.toLowerCase())) {
    process.env[pathKey] = `${system32};${currentPath}`;
  }
}

const { result } = concurrently(
  [
    { command: "corepack pnpm --filter @opero/backend dev", name: "api" },
    { command: "corepack pnpm --filter @opero/client dev", name: "client" },
  ],
  { prefixColors: ["blue", "magenta"] },
);

try {
  await result;
} catch {
  process.exitCode = 1;
}
