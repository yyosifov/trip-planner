import { execSync } from "node:child_process";
import * as path from "node:path";

export function resetTestDb() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://myuser:mypassword@localhost:5432/trip_planner_test";
  execSync("pnpm exec prisma migrate deploy", {
    cwd: path.join(__dirname, "../.."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
}
