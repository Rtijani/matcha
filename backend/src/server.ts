import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { database } from "./database/client.js";
import { authRoutes } from "./routes/auth.routes.js";
import { profileRoutes } from "./routes/profile.routes.js";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  accountRoutes,
} from "./routes/account.routes.js";
import {
  discoveryRoutes,
} from "./routes/discovery.routes.js";
import {
  interactionRoutes,
} from "./routes/interaction.routes.js";
import {
  searchRoutes,
} from "./routes/search.routes.js";
import {
  activityRoutes,
} from "./routes/activity.routes.js";
import {
  notificationRoutes,
} from "./routes/notification.routes.js";

const app = Fastify({
  logger: true,
});
import {
  closeSocketServer,
  initializeSocketServer,
} from "./sockets/socket.js";




await app.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
});

await app.register(cookie, {
  secret: env.COOKIE_SECRET,
});

await app.register(jwt, {
  secret: env.JWT_SECRET,
  cookie: {
    cookieName: "matcha_token",
    signed: false,
  },
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

await app.register(accountRoutes, {
  prefix: "/api/account",
});

await app.register(interactionRoutes, {
  prefix: "/api/interactions",
});

await app.register(searchRoutes, {
  prefix: "/api/search",
});

await app.register(activityRoutes, {
  prefix: "/api/activity",
});

await app.register(notificationRoutes, {
  prefix: "/api/notifications",
});

initializeSocketServer(app);

const uploadsRoot = path.resolve(process.cwd(), "uploads");

await mkdir(uploadsRoot, {
  recursive: true,
});

await app.register(multipart, {
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
    fields: 5,
  },
});

await app.register(fastifyStatic, {
  root: uploadsRoot,
  prefix: "/uploads/",
  decorateReply: false,
});

await app.register(authRoutes, {
  prefix: "/api/auth",
});

await app.register(profileRoutes, {
  prefix: "/api/profile",
});

await app.register(discoveryRoutes, {
  prefix: "/api/profiles",
});

app.get("/health", async () => {
  const result = await database.query<{ database_time: Date }>(
    "SELECT CURRENT_TIMESTAMP AS database_time",
  );

  return {
    status: "ok",
    service: "matcha-backend",
    database: "connected",
    databaseTime: result.rows[0]?.database_time,
  };
});

app.setNotFoundHandler(async (_request, reply) => {
  return reply.status(404).send({
    error: "Route not found",
  });
});

app.setErrorHandler(
  async (error: FastifyError, _request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode ?? 500;

    return reply.status(statusCode).send({
      error:
        statusCode < 500
          ? error.message
          : "Internal server error",
    });
  },
);

app.addHook("onClose", async () => {
  await closeSocketServer();
  await database.end();
});

const start = async (): Promise<void> => {
  try {
    await database.query("SELECT 1");
    app.log.info("PostgreSQL connection established");

    await app.listen({
      port: env.BACKEND_PORT,
      host: env.BACKEND_HOST,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

await start();