import type { FastifyInstance } from "fastify";
import { database } from "../database/client.js";
import { authenticate } from "../middleware/authenticate.js";

type ActivityProfile = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  fame_rating: number;
  main_picture: string | null;
  activity_at: Date;
};

const formatProfiles = (
  profiles: ActivityProfile[],
) => {
  return profiles.map((profile) => ({
    id: profile.id,
    username: profile.username,
    firstName: profile.first_name,
    lastName: profile.last_name,
    fameRating: profile.fame_rating,
    mainPicture:
      profile.main_picture === null
        ? null
        : `/uploads/${profile.main_picture}`,
    activityAt: profile.activity_at,
  }));
};

export const activityRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  /*
   * Latest visit from each user.
   */
  app.get(
    "/visitors",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const result =
        await database.query<ActivityProfile>(
          `SELECT *
           FROM (
             SELECT DISTINCT ON (
               profile_views.viewer_id
             )
               users.id,
               users.username,
               users.first_name,
               users.last_name,
               profiles.fame_rating,
               profile_pictures.file_path
                 AS main_picture,
               profile_views.viewed_at
                 AS activity_at
             FROM profile_views
             INNER JOIN users
               ON users.id =
                  profile_views.viewer_id
             INNER JOIN profiles
               ON profiles.user_id = users.id
             LEFT JOIN profile_pictures
               ON profile_pictures.user_id =
                  users.id
               AND profile_pictures
                     .is_profile_picture = TRUE
             WHERE profile_views.viewed_id = $1
               AND NOT EXISTS (
                 SELECT 1
                 FROM blocks
                 WHERE (
                   blocker_id = $1
                   AND blocked_id = users.id
                 )
                 OR (
                   blocker_id = users.id
                   AND blocked_id = $1
                 )
               )
             ORDER BY
               profile_views.viewer_id,
               profile_views.viewed_at DESC
           ) recent_visitors
           ORDER BY activity_at DESC`,
          [request.user.sub],
        );

      return reply.status(200).send({
        visitors: formatProfiles(result.rows),
      });
    },
  );

  /*
   * Users who liked the current user.
   */
  app.get(
    "/likes-received",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const result =
        await database.query<ActivityProfile>(
          `SELECT
             users.id,
             users.username,
             users.first_name,
             users.last_name,
             profiles.fame_rating,
             profile_pictures.file_path
               AS main_picture,
             likes.created_at AS activity_at
           FROM likes
           INNER JOIN users
             ON users.id = likes.liker_id
           INNER JOIN profiles
             ON profiles.user_id = users.id
           LEFT JOIN profile_pictures
             ON profile_pictures.user_id =
                users.id
             AND profile_pictures
                   .is_profile_picture = TRUE
           WHERE likes.liked_id = $1
             AND NOT EXISTS (
               SELECT 1
               FROM blocks
               WHERE (
                 blocker_id = $1
                 AND blocked_id = users.id
               )
               OR (
                 blocker_id = users.id
                 AND blocked_id = $1
               )
             )
           ORDER BY likes.created_at DESC`,
          [request.user.sub],
        );

      return reply.status(200).send({
        likes: formatProfiles(result.rows),
      });
    },
  );

  /*
   * Mutual likes: users allowed to chat.
   */
  app.get(
    "/connections",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const result =
        await database.query<ActivityProfile>(
          `SELECT
             users.id,
             users.username,
             users.first_name,
             users.last_name,
             profiles.fame_rating,
             profile_pictures.file_path
               AS main_picture,
             GREATEST(
               outgoing.created_at,
               incoming.created_at
             ) AS activity_at
           FROM likes outgoing
           INNER JOIN likes incoming
             ON incoming.liker_id =
                outgoing.liked_id
             AND incoming.liked_id =
                outgoing.liker_id
           INNER JOIN users
             ON users.id = outgoing.liked_id
           INNER JOIN profiles
             ON profiles.user_id = users.id
           LEFT JOIN profile_pictures
             ON profile_pictures.user_id =
                users.id
             AND profile_pictures
                   .is_profile_picture = TRUE
           WHERE outgoing.liker_id = $1
             AND NOT EXISTS (
               SELECT 1
               FROM blocks
               WHERE (
                 blocker_id = $1
                 AND blocked_id = users.id
               )
               OR (
                 blocker_id = users.id
                 AND blocked_id = $1
               )
             )
           ORDER BY activity_at DESC`,
          [request.user.sub],
        );

      return reply.status(200).send({
        connections: formatProfiles(
          result.rows,
        ),
      });
    },
  );
};
