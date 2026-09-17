import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { database } from "../database/client.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  refreshFameRating,
} from "../services/fame-rating.service.js";
import {
  createNotification,
} from "../services/notification.service.js";
import {
  emitToUser,
} from "../sockets/socket.js";

const userParamsSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

const reportSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Please provide a meaningful reason")
    .max(500),
});

export const interactionRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  /*
   * Like another user.
   */
  app.post(
    "/:userId/like",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams = userParamsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      const currentUserId = request.user.sub;
      const likedUserId = parsedParams.data.userId;

      if (currentUserId === likedUserId) {
        return reply.status(400).send({
          error: "You cannot like your own profile",
        });
      }

      const client = await database.connect();

      try {
        await client.query("BEGIN");

        const ownPicture = await client.query(
          `SELECT id
           FROM profile_pictures
           WHERE user_id = $1
             AND is_profile_picture = TRUE
           LIMIT 1`,
          [currentUserId],
        );

        if (ownPicture.rowCount === 0) {
          await client.query("ROLLBACK");

          return reply.status(403).send({
            error:
              "You need a profile picture before liking another user",
          });
        }

        const targetUser = await client.query(
          `SELECT users.id
           FROM users
           INNER JOIN profiles
             ON profiles.user_id = users.id
           WHERE users.id = $1
             AND users.is_verified = TRUE
             AND users.is_profile_complete = TRUE
           LIMIT 1`,
          [likedUserId],
        );

        if (targetUser.rowCount === 0) {
          await client.query("ROLLBACK");

          return reply.status(404).send({
            error: "Profile not found",
          });
        }

        const blocked = await client.query(
          `SELECT 1
           FROM blocks
           WHERE (
             blocker_id = $1
             AND blocked_id = $2
           )
           OR (
             blocker_id = $2
             AND blocked_id = $1
           )
           LIMIT 1`,
          [currentUserId, likedUserId],
        );

        if (blocked.rowCount !== 0) {
          await client.query("ROLLBACK");

          return reply.status(404).send({
            error: "Profile not found",
          });
        }

        const insertedLike = await client.query(
          `INSERT INTO likes (
             liker_id,
             liked_id
           )
           VALUES ($1, $2)
           ON CONFLICT (liker_id, liked_id)
           DO NOTHING
           RETURNING liker_id`,
          [currentUserId, likedUserId],
        );

        const reciprocalLike = await client.query(
          `SELECT 1
           FROM likes
           WHERE liker_id = $1
             AND liked_id = $2
           LIMIT 1`,
          [likedUserId, currentUserId],
        );

                const fameRating =
          await refreshFameRating(
            likedUserId,
            client,
          );

        const connected =
          reciprocalLike.rowCount !== 0;

        if (insertedLike.rowCount !== 0) {
          await createNotification(
            {
              recipientId: likedUserId,
              actorId: currentUserId,
              type: "like",
              message:
                `${request.user.username} liked your profile`,
            },
            client,
          );

          if (connected) {
            await createNotification(
              {
                recipientId: likedUserId,
                actorId: currentUserId,
                type: "match",
                message:
                  `You matched with ${request.user.username}`,
              },
              client,
            );

            const likedUserResult =
              await client.query<{
                username: string;
              }>(
                `SELECT username
                 FROM users
                 WHERE id = $1`,
                [likedUserId],
              );

            const likedUsername =
              likedUserResult.rows[0]?.username;

            if (likedUsername) {
              await createNotification(
                {
                  recipientId: currentUserId,
                  actorId: likedUserId,
                  type: "match",
                  message:
                    `You matched with ${likedUsername}`,
                },
                client,
              );
            }
          }
        }
        await client.query("COMMIT");

                if (insertedLike.rowCount !== 0) {
          emitToUser(
            likedUserId,
            "notification:new",
            {
              type: connected
                ? "match"
                : "like",
            },
          );

          if (connected) {
            emitToUser(
              currentUserId,
              "notification:new",
              {
                type: "match",
              },
            );
          }
        }


        return reply.status(
          insertedLike.rowCount === 0 ? 200 : 201,
        ).send({
          message:
            insertedLike.rowCount === 0
              ? "Profile was already liked"
              : connected
                ? "It is a match"
                : "Profile liked successfully",
          connected,
          fameRating,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );

    app.delete(
    "/:userId/like",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams = userParamsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      const currentUserId = request.user.sub;
      const likedUserId = parsedParams.data.userId;

      if (currentUserId === likedUserId) {
        return reply.status(400).send({
          error: "You cannot unlike your own profile",
        });
      }

      const client = await database.connect();

      try {
        await client.query("BEGIN");

        const reciprocalLike =
          await client.query(
            `SELECT 1
             FROM likes
             WHERE liker_id = $1
               AND liked_id = $2
             LIMIT 1`,
            [likedUserId, currentUserId],
          );

        const result = await client.query(
          `DELETE FROM likes
           WHERE liker_id = $1
             AND liked_id = $2
           RETURNING liker_id`,
          [currentUserId, likedUserId],
        );

        const fameRating =
          await refreshFameRating(
            likedUserId,
            client,
          );

        const wasConnected =
          reciprocalLike.rowCount !== 0;

        if (
          result.rowCount !== 0 &&
          wasConnected
        ) {
          await createNotification(
            {
              recipientId: likedUserId,
              actorId: currentUserId,
              type: "unlike",
              message:
                `${request.user.username} disconnected from you`,
            },
            client,
          );
        }

        await client.query("COMMIT");
        await client.query("COMMIT");

        if (
          result.rowCount !== 0 &&
          wasConnected
        ) {
          emitToUser(
            likedUserId,
            "notification:new",
            {
              type: "unlike",
            },
          );
        }

        return reply.status(200).send({
          message:
            result.rowCount === 0
              ? "Profile was not liked"
              : "Like removed successfully",
          connected: false,
          fameRating,
        });
        
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );
    app.post(
    "/:userId/block",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams = userParamsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      const currentUserId = request.user.sub;
      const blockedUserId = parsedParams.data.userId;

      if (currentUserId === blockedUserId) {
        return reply.status(400).send({
          error: "You cannot block your own account",
        });
      }

      const client = await database.connect();

      try {
        await client.query("BEGIN");

        const targetUser = await client.query(
          `SELECT id
           FROM users
           WHERE id = $1
           LIMIT 1`,
          [blockedUserId],
        );

        if (targetUser.rowCount === 0) {
          await client.query("ROLLBACK");

          return reply.status(404).send({
            error: "User not found",
          });
        }

        await client.query(
          `INSERT INTO blocks (
             blocker_id,
             blocked_id
           )
           VALUES ($1, $2)
           ON CONFLICT (blocker_id, blocked_id)
           DO NOTHING`,
          [currentUserId, blockedUserId],
        );

        await client.query(
          `DELETE FROM likes
           WHERE (
             liker_id = $1
             AND liked_id = $2
           )
           OR (
             liker_id = $2
             AND liked_id = $1
           )`,
          [currentUserId, blockedUserId],
        );

        await refreshFameRating(
          currentUserId,
          client,
        );

        await refreshFameRating(
          blockedUserId,
          client,
        );

        await client.query("COMMIT");

        return reply.status(200).send({
          message: "User blocked successfully",
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );

    app.delete(
    "/:userId/block",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams = userParamsSchema.safeParse(
        request.params,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      const blockedUserId = parsedParams.data.userId;

      if (request.user.sub === blockedUserId) {
        return reply.status(400).send({
          error: "Invalid unblock request",
        });
      }

      const result = await database.query(
        `DELETE FROM blocks
         WHERE blocker_id = $1
           AND blocked_id = $2
         RETURNING blocker_id`,
        [
          request.user.sub,
          blockedUserId,
        ],
      );

      return reply.status(200).send({
        message:
          result.rowCount === 0
            ? "User was not blocked"
            : "User unblocked successfully",
      });
    },
  );
    app.post(
    "/:userId/report",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams = userParamsSchema.safeParse(
        request.params,
      );

      const parsedBody = reportSchema.safeParse(
        request.body,
      );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid report",
          details:
            parsedBody.error.flatten().fieldErrors,
        });
      }

      const reportedUserId =
        parsedParams.data.userId;

      if (request.user.sub === reportedUserId) {
        return reply.status(400).send({
          error: "You cannot report your own account",
        });
      }

      const targetUser = await database.query(
        `SELECT id
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [reportedUserId],
      );

      if (targetUser.rowCount === 0) {
        return reply.status(404).send({
          error: "User not found",
        });
      }

      await database.query(
        `INSERT INTO reports (
           reporter_id,
           reported_id,
           reason
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (reporter_id, reported_id)
         DO UPDATE SET
           reason = EXCLUDED.reason,
           created_at = CURRENT_TIMESTAMP`,
        [
          request.user.sub,
          reportedUserId,
          parsedBody.data.reason,
        ],
      );

      return reply.status(201).send({
        message: "User reported successfully",
      });
    },
  );
};
