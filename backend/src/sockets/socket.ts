import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { z } from "zod";
import { database } from "../database/client.js";
import { env } from "../config/env.js";
import {
  canUsersChat,
} from "../services/chat.service.js";
import {
  createNotification,
} from "../services/notification.service.js";

let socketServer: Server | null = null;

const chatMessageSchema = z.object({
  receiverId: z
    .string()
    .uuid("Invalid receiver ID"),

  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(
      2000,
      "Message cannot exceed 2000 characters",
    ),
});

const chatReadSchema = z.object({
  otherUserId: z
    .string()
    .uuid("Invalid user ID"),
});

const readCookie = (
  cookieHeader: string | undefined,
  cookieName: string,
): string | null => {
  if (!cookieHeader) {
    return null;
  }

  for (
    const cookiePart of cookieHeader.split(";")
  ) {
    const separatorIndex =
      cookiePart.indexOf("=");

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

  /*
   * Authenticate every Socket.IO connection
   * using the HTTP-only login cookie.
   */
  io.use(async (socket, next) => {
    try {
      const token = readCookie(
        socket.handshake.headers.cookie,
        "matcha_token",
      );

      if (!token) {
        return next(
          new Error(
            "Authentication required",
          ),
        );
      }

      const payload = app.jwt.verify<{
        sub: string;
        username: string;
      }>(token);

      socket.data.userId = payload.sub;
      socket.data.username =
        payload.username;

      return next();
    } catch {
      return next(
        new Error(
          "Invalid authentication token",
        ),
      );
    }
  });

  io.on("connection", async (socket) => {
    const userId =
      socket.data.userId as string;

    const username =
      socket.data.username as string;

    const userRoom = `user:${userId}`;

    await socket.join(userRoom);

    await database.query(
      `UPDATE profiles
       SET
         last_online_at =
           CURRENT_TIMESTAMP,
         updated_at =
           CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId],
    );

    socket.broadcast.emit(
      "user:status",
      {
        userId,
        isOnline: true,
        lastOnlineAt: null,
      },
    );

    /*
     * Send and persist a chat message.
     */
    socket.on(
      "chat:send",
      async (
        payload: unknown,
        acknowledge?: (
          response: unknown,
        ) => void,
      ) => {
        const parsedPayload =
          chatMessageSchema.safeParse(
            payload,
          );

        if (!parsedPayload.success) {
          const response = {
            ok: false,
            error: "Invalid message",
            details:
              parsedPayload.error
                .flatten()
                .fieldErrors,
          };

          acknowledge?.(response);
          socket.emit(
            "chat:error",
            response,
          );

          return;
        }

        const {
          receiverId,
          content,
        } = parsedPayload.data;

        if (receiverId === userId) {
          const response = {
            ok: false,
            error:
              "You cannot message yourself",
          };

          acknowledge?.(response);
          socket.emit(
            "chat:error",
            response,
          );

          return;
        }

        const client =
          await database.connect();

        try {
          await client.query("BEGIN");

          const allowed =
            await canUsersChat(
              userId,
              receiverId,
              client,
            );

          if (!allowed) {
            await client.query(
              "ROLLBACK",
            );

            const response = {
              ok: false,
              error:
                "You can only chat with mutual connections",
            };

            acknowledge?.(response);
            socket.emit(
              "chat:error",
              response,
            );

            return;
          }

          const messageResult =
            await client.query<{
              id: string;
              sender_id: string;
              receiver_id: string;
              content: string;
              read_at: Date | null;
              created_at: Date;
            }>(
              `INSERT INTO messages (
                 sender_id,
                 receiver_id,
                 content
               )
               VALUES ($1, $2, $3)
               RETURNING
                 id,
                 sender_id,
                 receiver_id,
                 content,
                 read_at,
                 created_at`,
              [
                userId,
                receiverId,
                content,
              ],
            );

          const message =
            messageResult.rows[0];

          if (!message) {
            throw new Error(
              "Message creation failed",
            );
          }

          const notification =
            await createNotification(
              {
                recipientId:
                  receiverId,
                actorId: userId,
                type: "message",
                message:
                  `${username} sent you a message`,
                relatedId: message.id,
              },
              client,
            );

          await client.query("COMMIT");

          const messagePayload = {
            id: message.id,
            senderId:
              message.sender_id,
            receiverId:
              message.receiver_id,
            content: message.content,
            isRead:
              message.read_at !== null,
            readAt: message.read_at,
            createdAt:
              message.created_at,
          };

          /*
           * Send to every open tab/device
           * belonging to both users.
           */
          io.to(`user:${userId}`).emit(
            "chat:message",
            messagePayload,
          );

          io.to(
            `user:${receiverId}`,
          ).emit(
            "chat:message",
            messagePayload,
          );

          if (notification) {
            emitToUser(
              receiverId,
              "notification:new",
              {
                id:
                  notification.id,
                type:
                  notification.type,
                message:
                  notification.message,
                actorId:
                  notification.actor_id,
                relatedId:
                  notification.related_id,
                createdAt:
                  notification.created_at,
              },
            );
          }

          acknowledge?.({
            ok: true,
            message: messagePayload,
          });
        } catch (error) {
          await client.query(
            "ROLLBACK",
          );

          app.log.error(error);

          const response = {
            ok: false,
            error:
              "Message could not be sent",
          };

          acknowledge?.(response);
          socket.emit(
            "chat:error",
            response,
          );
        } finally {
          client.release();
        }
      },
    );

    /*
     * Mark a conversation as read.
     */
    socket.on(
      "chat:read",
      async (
        payload: unknown,
        acknowledge?: (
          response: unknown,
        ) => void,
      ) => {
        const parsedPayload =
          chatReadSchema.safeParse(
            payload,
          );

        if (!parsedPayload.success) {
          acknowledge?.({
            ok: false,
            error:
              "Invalid read request",
          });

          return;
        }

        const otherUserId =
          parsedPayload.data
            .otherUserId;

        try {
          const allowed =
            await canUsersChat(
              userId,
              otherUserId,
            );

          if (!allowed) {
            acknowledge?.({
              ok: false,
              error:
                "Chat is not available",
            });

            return;
          }

          const readAt = new Date();

          const result =
            await database.query(
              `UPDATE messages
               SET read_at = $1
               WHERE sender_id = $2
                 AND receiver_id = $3
                 AND read_at IS NULL
               RETURNING id`,
              [
                readAt,
                otherUserId,
                userId,
              ],
            );

          emitToUser(
            otherUserId,
            "chat:read",
            {
              readerId: userId,
              readAt,
              updatedCount:
                result.rowCount ?? 0,
            },
          );

          acknowledge?.({
            ok: true,
            updatedCount:
              result.rowCount ?? 0,
            readAt,
          });
        } catch (error) {
          app.log.error(error);

          acknowledge?.({
            ok: false,
            error:
              "Messages could not be marked as read",
          });
        }
      },
    );

    /*
     * Track the last connection time.
     */
    socket.on(
      "disconnect",
      async () => {
        const remainingConnections =
          io.sockets.adapter.rooms.get(
            userRoom,
          )?.size ?? 0;

        if (remainingConnections === 0) {
          const result =
            await database.query<{
              last_online_at: Date;
            }>(
              `UPDATE profiles
               SET
                 last_online_at =
                   CURRENT_TIMESTAMP,
                 updated_at =
                   CURRENT_TIMESTAMP
               WHERE user_id = $1
               RETURNING
                 last_online_at`,
              [userId],
            );

          socket.broadcast.emit(
            "user:status",
            {
              userId,
              isOnline: false,
              lastOnlineAt:
                result.rows[0]
                  ?.last_online_at ??
                new Date(),
            },
          );
        }
      },
    );
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
    .emit(
      eventName,
      payload,
    );
};

export const isUserOnline = (
  userId: string,
): boolean => {
  const room =
    socketServer
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

    await new Promise<void>(
      (resolve) => {
        socketServer?.close(() => {
          resolve();
        });
      },
    );

    socketServer = null;
  };