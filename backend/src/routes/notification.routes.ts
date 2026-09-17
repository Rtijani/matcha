import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { database } from "../database/client.js";
import { authenticate } from "../middleware/authenticate.js";

const notificationParamsSchema = z.object({
  notificationId: z
    .string()
    .uuid("Invalid notification ID"),
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
    .default(20),
});

export const notificationRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  /*
   * List notifications.
   */
  app.get(
    "/",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedQuery = paginationSchema.safeParse(
        request.query,
      );

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: "Invalid pagination",
          details:
            parsedQuery.error.flatten().fieldErrors,
        });
      }

      const { page, limit } = parsedQuery.data;
      const offset = (page - 1) * limit;

      const result = await database.query<{
        id: string;
        type: string;
        message: string;
        related_id: string | null;
        read_at: Date | null;
        created_at: Date;
        actor_id: string | null;
        actor_username: string | null;
        actor_picture: string | null;
      }>(
        `SELECT
           notifications.id,
           notifications.type,
           notifications.message,
           notifications.related_id,
           notifications.read_at,
           notifications.created_at,
           notifications.actor_id,
           actor.username AS actor_username,
           actor_picture.file_path
             AS actor_picture
         FROM notifications
         LEFT JOIN users actor
           ON actor.id =
              notifications.actor_id
         LEFT JOIN profile_pictures
           actor_picture
           ON actor_picture.user_id =
              actor.id
           AND actor_picture
                 .is_profile_picture = TRUE
         WHERE notifications.recipient_id = $1
         ORDER BY
           notifications.created_at DESC
         LIMIT $2
         OFFSET $3`,
        [
          request.user.sub,
          limit,
          offset,
        ],
      );

      const countResult = await database.query<{
        total: number;
      }>(
        `SELECT COUNT(*)::integer AS total
         FROM notifications
         WHERE recipient_id = $1`,
        [request.user.sub],
      );

      const total =
        countResult.rows[0]?.total ?? 0;

      return reply.status(200).send({
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),

        notifications: result.rows.map(
          (notification) => ({
            id: notification.id,
            type: notification.type,
            message: notification.message,
            relatedId:
              notification.related_id,
            isRead:
              notification.read_at !== null,
            readAt: notification.read_at,
            createdAt:
              notification.created_at,

            actor:
              notification.actor_id === null
                ? null
                : {
                    id:
                      notification.actor_id,
                    username:
                      notification.actor_username,
                    picture:
                      notification.actor_picture ===
                      null
                        ? null
                        : `/uploads/${notification.actor_picture}`,
                  },
          }),
        ),
      });
    },
  );

  /*
   * Count unread notifications.
   */
  app.get(
    "/unread-count",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const result = await database.query<{
        count: number;
      }>(
        `SELECT COUNT(*)::integer AS count
         FROM notifications
         WHERE recipient_id = $1
           AND read_at IS NULL`,
        [request.user.sub],
      );

      return reply.status(200).send({
        unreadCount:
          result.rows[0]?.count ?? 0,
      });
    },
  );

  /*
   * Mark one notification as read.
   */
  app.patch(
    "/:notificationId/read",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams =
        notificationParamsSchema.safeParse(
          request.params,
        );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid notification ID",
        });
      }

      const result = await database.query(
        `UPDATE notifications
         SET read_at = COALESCE(
           read_at,
           CURRENT_TIMESTAMP
         )
         WHERE id = $1
           AND recipient_id = $2
         RETURNING id`,
        [
          parsedParams.data.notificationId,
          request.user.sub,
        ],
      );

      if (result.rowCount === 0) {
        return reply.status(404).send({
          error: "Notification not found",
        });
      }

      return reply.status(200).send({
        message:
          "Notification marked as read",
      });
    },
  );

  /*
   * Mark all notifications as read.
   */
  app.patch(
    "/read-all",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const result = await database.query(
        `UPDATE notifications
         SET read_at = CURRENT_TIMESTAMP
         WHERE recipient_id = $1
           AND read_at IS NULL
         RETURNING id`,
        [request.user.sub],
      );

      return reply.status(200).send({
        message:
          "All notifications marked as read",
        updatedCount:
          result.rowCount ?? 0,
      });
    },
  );
};
