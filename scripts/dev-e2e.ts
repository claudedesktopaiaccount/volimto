import { spawn } from "child_process";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
if (!e2eDatabaseUrl) {
  console.error("E2E_DATABASE_URL is required for npm run test:e2e.");
  process.exit(1);
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL === e2eDatabaseUrl) {
  console.error("E2E_DATABASE_URL must not equal DATABASE_URL.");
  process.exit(1);
}

const child = process.platform === "win32"
  ? spawn("cmd.exe", ["/d", "/s", "/c", "npm.cmd run dev"], {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: e2eDatabaseUrl,
        VOLIMTO_E2E: "1",
      },
    })
  : spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: e2eDatabaseUrl,
    VOLIMTO_E2E: "1",
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
