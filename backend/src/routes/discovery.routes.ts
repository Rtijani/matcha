import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { database } from "../database/client.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  createNotification,
} from "../services/notification.service.js";
import {
  emitToUser, isUserOnline,
} from "../sockets/socket.js";


const userParamsSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});


export const discoveryRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
    app.get(
    "/suggestions",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const currentProfileResult =
        await database.query<{
          gender: string;
          sexual_preference: string;
          latitude: string | null;
          longitude: string | null;
          city: string | null;
          is_profile_complete: boolean;
        }>(
          `SELECT
             profiles.gender,
             profiles.sexual_preference,
             profiles.latitude,
             profiles.longitude,
             profiles.city,
             users.is_profile_complete
           FROM users
           INNER JOIN profiles
             ON profiles.user_id = users.id
           WHERE users.id = $1
           LIMIT 1`,
          [request.user.sub],
        );

      const currentProfile =
        currentProfileResult.rows[0];

      if (
        !currentProfile ||
        !currentProfile.is_profile_complete
      ) {
        return reply.status(403).send({
          error:
            "Complete your profile before browsing suggestions",
        });
      }

      const result = await database.query<{
        id: string;
        username: string;
        first_name: string;
        last_name: string;
        gender: string;
        biography: string;
        age: number;
        fame_rating: number;
        city: string | null;
        neighborhood: string | null;
        main_picture: string | null;
        common_tags: number;
        distance_km: string | null;
        same_city: boolean;
      }>(
        `WITH current_profile AS (
           SELECT
             profiles.gender,
             profiles.sexual_preference,
             profiles.latitude,
             profiles.longitude,
             profiles.city
           FROM profiles
           WHERE profiles.user_id = $1
         )
         SELECT
           users.id,
           users.username,
           users.first_name,
           users.last_name,
           profiles.gender,
           profiles.biography,
           EXTRACT(
             YEAR FROM age(
               CURRENT_DATE,
               profiles.birth_date
             )
           )::integer AS age,
           profiles.fame_rating,
           profiles.city,
           profiles.neighborhood,
           profile_pictures.file_path
             AS main_picture,

           (
             SELECT COUNT(*)::integer
             FROM user_tags candidate_tags
             INNER JOIN user_tags current_tags
               ON current_tags.tag_id =
                  candidate_tags.tag_id
             WHERE candidate_tags.user_id =
               users.id
               AND current_tags.user_id = $1
           ) AS common_tags,

           CASE
             WHEN
               current_profile.latitude IS NOT NULL
               AND current_profile.longitude IS NOT NULL
               AND profiles.latitude IS NOT NULL
               AND profiles.longitude IS NOT NULL
             THEN (
               6371 * 2 * ASIN(
                 SQRT(
                   POWER(
                     SIN(
                       RADIANS(
                         profiles.latitude -
                         current_profile.latitude
                       ) / 2
                     ),
                     2
                   )
                   +
                   COS(
                     RADIANS(
                       current_profile.latitude
                     )
                   )
                   *
                   COS(
                     RADIANS(
                       profiles.latitude
                     )
                   )
                   *
                   POWER(
                     SIN(
                       RADIANS(
                         profiles.longitude -
                         current_profile.longitude
                       ) / 2
                     ),
                     2
                   )
                 )
               )
             )
             ELSE NULL
           END AS distance_km,

           (
             current_profile.city IS NOT NULL
             AND profiles.city IS NOT NULL
             AND lower(current_profile.city) =
                 lower(profiles.city)
           ) AS same_city

         FROM users
         INNER JOIN profiles
           ON profiles.user_id = users.id

         CROSS JOIN current_profile

         LEFT JOIN profile_pictures
           ON profile_pictures.user_id = users.id
           AND profile_pictures.is_profile_picture =
               TRUE

         WHERE users.id <> $1
           AND users.is_verified = TRUE
           AND users.is_profile_complete = TRUE

           AND (
             current_profile.sexual_preference =
               'everyone'
             OR current_profile.sexual_preference =
                profiles.gender
           )

           AND (
             profiles.sexual_preference = 'everyone'
             OR profiles.sexual_preference =
                current_profile.gender
           )

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
           same_city DESC,
           distance_km ASC NULLS LAST,
           common_tags DESC,
           profiles.fame_rating DESC,
           users.created_at DESC

         LIMIT 100`,
        [request.user.sub],
      );

      return reply.status(200).send({
        suggestions: result.rows.map(
          (profile) => ({
            id: profile.id,
            username: profile.username,
            firstName: profile.first_name,
            lastName: profile.last_name,
            gender: profile.gender,
            biography: profile.biography,
            age: profile.age,
            fameRating: profile.fame_rating,
            city: profile.city,
            neighborhood: profile.neighborhood,
            commonTags: profile.common_tags,
            sameCity: profile.same_city,
            distanceKm:
              profile.distance_km === null
                ? null
                : Number(
                    Number(
                      profile.distance_km,
                    ).toFixed(1),
                  ),
            mainPicture:
              profile.main_picture === null
                ? null
                : `/uploads/${profile.main_picture}`,
          }),
        ),
      });
    },
  );

  app.get(
    "/:userId",
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
      const viewedUserId = parsedParams.data.userId;

      if (currentUserId === viewedUserId) {
        return reply.status(400).send({
          error: "Use /api/profile/me to view your own profile",
        });
      }

      const blockedResult = await database.query(
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
        [currentUserId, viewedUserId],
      );

      if (blockedResult.rowCount !== 0) {
        return reply.status(404).send({
          error: "Profile not found",
        });
      }

      const profileResult = await database.query<{
        id: string;
        username: string;
        first_name: string;
        last_name: string;
        gender: string;
        sexual_preference: string;
        biography: string;
        birth_date: string;
        age: number;
        fame_rating: number;
        city: string | null;
        neighborhood: string | null;
        last_online_at: Date | null;
        last_login_at: Date | null;
      }>(
        `SELECT
           users.id,
           users.username,
           users.first_name,
           users.last_name,
           profiles.gender,
           profiles.sexual_preference,
           profiles.biography,
           TO_CHAR(
             profiles.birth_date,
             'YYYY-MM-DD'
           ) AS birth_date,
           EXTRACT(
             YEAR FROM age(
               CURRENT_DATE,
               profiles.birth_date
             )
           )::integer AS age,
           profiles.fame_rating,
           profiles.city,
           profiles.neighborhood,
           profiles.last_online_at,
           users.last_login_at
         FROM users
         INNER JOIN profiles
           ON profiles.user_id = users.id
         WHERE users.id = $1
           AND users.is_verified = TRUE
           AND users.is_profile_complete = TRUE
         LIMIT 1`,
        [viewedUserId],
      );

      const profile = profileResult.rows[0];

      if (!profile) {
        return reply.status(404).send({
          error: "Profile not found",
        });
      }

      const tagsResult = await database.query<{
        id: string;
        name: string;
      }>(
        `SELECT
           tags.id,
           tags.name
         FROM tags
         INNER JOIN user_tags
           ON user_tags.tag_id = tags.id
         WHERE user_tags.user_id = $1
         ORDER BY tags.name`,
        [viewedUserId],
      );

      const picturesResult = await database.query<{
        id: string;
        file_path: string;
        is_profile_picture: boolean;
        position: number;
      }>(
        `SELECT
           id,
           file_path,
           is_profile_picture,
           position
         FROM profile_pictures
         WHERE user_id = $1
         ORDER BY position`,
        [viewedUserId],
      );

      const relationshipResult =
        await database.query<{
          viewer_liked: boolean;
          viewed_liked: boolean;
        }>(
          `SELECT
             EXISTS (
               SELECT 1
               FROM likes
               WHERE liker_id = $1
                 AND liked_id = $2
             ) AS viewer_liked,
             EXISTS (
               SELECT 1
               FROM likes
               WHERE liker_id = $2
                 AND liked_id = $1
             ) AS viewed_liked`,
          [currentUserId, viewedUserId],
        );

      const relationship =
        relationshipResult.rows[0];

            const viewResult = await database.query<{
        id: string;
      }>(
        `INSERT INTO profile_views (
           viewer_id,
           viewed_id
         )
         VALUES ($1, $2)
         RETURNING id`,
        [currentUserId, viewedUserId],
      );

      const recordedView = viewResult.rows[0];

            if (recordedView) {
        const notification =
          await createNotification({
            recipientId: viewedUserId,
            actorId: currentUserId,
            type: "profile_view",
            message:
              `${request.user.username} viewed your profile`,
            relatedId: recordedView.id,
          });

        if (notification) {
          emitToUser(
            viewedUserId,
            "notification:new",
            {
              id: notification.id,
              type: notification.type,
              message: notification.message,
              actorId:
                notification.actor_id,
              relatedId:
                notification.related_id,
              createdAt:
                notification.created_at,
            },
          );
        }
      }
      const viewerLiked =
        relationship?.viewer_liked ?? false;

      const viewedLiked =
        relationship?.viewed_liked ?? false;

      return reply.status(200).send({
        profile: {
          id: profile.id,
          username: profile.username,
          firstName: profile.first_name,
          lastName: profile.last_name,
          gender: profile.gender,
          sexualPreference:
            profile.sexual_preference,
          biography: profile.biography,
          birthDate: profile.birth_date,
          age: profile.age,
          fameRating: profile.fame_rating,
          city: profile.city,
          neighborhood: profile.neighborhood,
          
          isOnline: isUserOnline(viewedUserId),

          lastConnection:
            profile.last_online_at ??
            profile.last_login_at,

          tags: tagsResult.rows.map((tag) => ({
            id: tag.id,
            name: `#${tag.name}`,
          })),

          pictures: picturesResult.rows.map(
            (picture) => ({
              id: picture.id,
              url: `/uploads/${picture.file_path}`,
              isProfilePicture:
                picture.is_profile_picture,
              position: picture.position,
            }),
          ),

          relationship: {
            youLiked: viewerLiked,
            likedYou: viewedLiked,
            connected:
              viewerLiked && viewedLiked,
          },
        },
      });
    },
  );
};
