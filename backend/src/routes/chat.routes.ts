import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { database } from "../database/client.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  canUsersChat,
} from "../services/chat.service.js";

import {
  isUserOnline,
} from "../sockets/socket.js";

const userParamsSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50),
});

export const chatRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  /*
   * List mutual connections and their latest messages.
   */
  app.get(
    "/conversations",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const result = await database.query<{
        user_id: string;
        username: string;
        first_name: string;
        last_name: string;
        profile_picture: string | null;
        last_message: string | null;
        last_message_at: Date | null;
        unread_count: number;
        last_online_at: Date | null;
      }>(
        `SELECT
           connected_user.id AS user_id,
           connected_user.username,
           connected_user.first_name,
           connected_user.last_name,

           profile_picture.file_path
             AS profile_picture,

           latest_message.content
             AS last_message,

           latest_message.created_at
             AS last_message_at,

           (
             SELECT COUNT(*)::integer
             FROM messages unread_message
             WHERE unread_message.sender_id =
                     connected_user.id
               AND unread_message.receiver_id = $1
               AND unread_message.read_at IS NULL
           ) AS unread_count,

           connected_profile.last_online_at

         FROM likes outgoing

         INNER JOIN likes incoming
           ON incoming.liker_id =
                outgoing.liked_id
           AND incoming.liked_id =
                outgoing.liker_id

         INNER JOIN users connected_user
           ON connected_user.id =
                outgoing.liked_id

         INNER JOIN profiles connected_profile
           ON connected_profile.user_id =
                connected_user.id

         LEFT JOIN profile_pictures
           profile_picture
           ON profile_picture.user_id =
                connected_user.id
           AND profile_picture
                 .is_profile_picture = TRUE

         LEFT JOIN LATERAL (
           SELECT
             messages.content,
             messages.created_at
           FROM messages
           WHERE (
             messages.sender_id = $1
             AND messages.receiver_id =
                   connected_user.id
           )
           OR (
             messages.sender_id =
                   connected_user.id
             AND messages.receiver_id = $1
           )
           ORDER BY
             messages.created_at DESC
           LIMIT 1
         ) latest_message ON TRUE

         WHERE outgoing.liker_id = $1

           AND NOT EXISTS (
             SELECT 1
             FROM blocks
             WHERE (
               blocker_id = $1
               AND blocked_id =
                   connected_user.id
             )
             OR (
               blocker_id =
                   connected_user.id
               AND blocked_id = $1
             )
           )

         ORDER BY
           latest_message.created_at
             DESC NULLS LAST,
           connected_user.username ASC`,
        [request.user.sub],
      );

      return reply.status(200).send({
        conversations: result.rows.map(
          (conversation) => ({
            user: {
              id: conversation.user_id,
              username:
                conversation.username,
              firstName:
                conversation.first_name,
              lastName:
                conversation.last_name,
              picture:
                conversation.profile_picture ===
                null
                  ? null
                  : `/uploads/${conversation.profile_picture}`,
              isOnline: isUserOnline(
              conversation.user_id,
              ),

              lastOnlineAt:
                conversation.last_online_at,
              },

            lastMessage:
              conversation.last_message,

            lastMessageAt:
              conversation.last_message_at,

            unreadCount:
              conversation.unread_count,
          }),
        ),
      });
    },
  );

  /*
   * Retrieve one conversation.
   */
  app.get(
    "/:userId/messages",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams =
        userParamsSchema.safeParse(
          request.params,
        );

      const parsedQuery =
        paginationSchema.safeParse(
          request.query,
        );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: "Invalid pagination",
          details:
            parsedQuery.error.flatten().fieldErrors,
        });
      }

      const otherUserId =
        parsedParams.data.userId;

      const allowed = await canUsersChat(
        request.user.sub,
        otherUserId,
      );

      if (!allowed) {
        return reply.status(403).send({
          error:
            "You can only chat with mutual connections",
        });
      }

      const { page, limit } =
        parsedQuery.data;

      const offset =
        (page - 1) * limit;

      const result = await database.query<{
        id: string;
        sender_id: string;
        receiver_id: string;
        content: string;
        read_at: Date | null;
        created_at: Date;
      }>(
        `SELECT *
         FROM (
           SELECT
             id,
             sender_id,
             receiver_id,
             content,
             read_at,
             created_at
           FROM messages
           WHERE (
             sender_id = $1
             AND receiver_id = $2
           )
           OR (
             sender_id = $2
             AND receiver_id = $1
           )
           ORDER BY created_at DESC
           LIMIT $3
           OFFSET $4
         ) selected_messages
         ORDER BY created_at ASC`,
        [
          request.user.sub,
          otherUserId,
          limit,
          offset,
        ],
      );

      return reply.status(200).send({
        page,
        limit,

        messages: result.rows.map(
          (message) => ({
            id: message.id,
            senderId: message.sender_id,
            receiverId:
              message.receiver_id,
            content: message.content,
            isRead:
              message.read_at !== null,
            readAt: message.read_at,
            createdAt:
              message.created_at,
          }),
        ),
      });
    },
  );

  /*
   * Mark messages from one user as read.
   */
  app.patch(
    "/:userId/read",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams =
        userParamsSchema.safeParse(
          request.params,
        );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      const otherUserId =
        parsedParams.data.userId;

      const result = await database.query(
        `UPDATE messages
         SET read_at = CURRENT_TIMESTAMP
         WHERE sender_id = $1
           AND receiver_id = $2
           AND read_at IS NULL
         RETURNING id`,
        [
          otherUserId,
          request.user.sub,
        ],
      );

      return reply.status(200).send({
        message:
          "Messages marked as read",
        updatedCount:
          result.rowCount ?? 0,
      });
    },
  );
};
