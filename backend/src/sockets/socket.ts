import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { database } from "../database/client.js";
import { env } from "../config/env.js";

let socketServer: Server | null = null;

const readCookie = (
  cookieHeader: string | undefined,
  cookieName: string,
): string | null => {
  if (!cookieHeader) {
    return null;
  }

  for (const cookiePart of cookieHeader.split(";")) {
    const separatorIndex = cookiePart.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookiePart
      .slice(0, separatorIndex)
      .trim();

    const value = cookiePart
      .slice(separatorIndex + 1)
      .trim();

    if (name === cookieName) {
      return decodeURIComponent(value);
    }
  }

  return null;
};

export const initializeSocketServer = (
  app: FastifyInstance,
): Server => {
  const io = new Server(app.server, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  socketServer = io;

  io.use(async (socket, next) => {
    try {
      const token = readCookie(
        socket.handshake.headers.cookie,
        "matcha_token",
      );

      if (!token) {
        return next(
          new Error("Authentication required"),
        );
      }

      const payload = app.jwt.verify<{
        sub: string;
        username: string;
      }>(token);

      socket.data.userId = payload.sub;
      socket.data.username = payload.username;

      return next();
    } catch {
      return next(
        new Error("Invalid authentication token"),
      );
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;

    const userRoom = `user:${userId}`;

    await socket.join(userRoom);

    await database.query(
      `UPDATE profiles
       SET
         last_online_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId],
    );

    socket.broadcast.emit("user:status", {
      userId,
      isOnline: true,
      lastOnlineAt: null,
    });

    socket.on("disconnect", async () => {
      const remainingConnections =
        io.sockets.adapter.rooms.get(
          userRoom,
        )?.size ?? 0;

      if (remainingConnections === 0) {
        const result = await database.query<{
          last_online_at: Date;
        }>(
          `UPDATE profiles
           SET
             last_online_at =
               CURRENT_TIMESTAMP,
             updated_at =
               CURRENT_TIMESTAMP
           WHERE user_id = $1
           RETURNING last_online_at`,
          [userId],
        );

        socket.broadcast.emit("user:status", {
          userId,
          isOnline: false,
          lastOnlineAt:
            result.rows[0]?.last_online_at ??
            new Date(),
        });
      }
    });
  });

  return io;
};

export const emitToUser = (
  userId: string,
  eventName: string,
  payload: unknown,
): void => {
  socketServer
    ?.to(`user:${userId}`)
    .emit(eventName, payload);
};

export const isUserOnline = (
  userId: string,
): boolean => {
  const room = socketServer
    ?.sockets.adapter.rooms.get(
      `user:${userId}`,
    );

  return (room?.size ?? 0) > 0;
};

export const closeSocketServer =
  async (): Promise<void> => {
    if (!socketServer) {
      return;
    }

    await new Promise<void>((resolve) => {
      socketServer?.close(() => {
        resolve();
      });
    });

    socketServer = null;
  };
