import * as path from "node:path";
import * as dotenv from "dotenv";

export default async function globalSetup() {
  dotenv.config({ path: path.join(__dirname, "../../../.env") });
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? "postgresql://myuser:mypassword@localhost:5432/trip_planner_test";
}
