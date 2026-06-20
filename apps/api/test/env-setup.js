const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });
// Override to use test DB
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
