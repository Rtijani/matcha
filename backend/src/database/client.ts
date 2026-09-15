import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const database = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

database.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error:", error);
});