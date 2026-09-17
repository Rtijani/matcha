import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { database } from "../database/client.js";
import { authenticate } from "../middleware/authenticate.js";

const searchSchema = z
  .object({
    minAge: z.coerce
      .number()
      .int()
      .min(18)
      .max(120)
      .default(18),

    maxAge: z.coerce
      .number()
      .int()
      .min(18)
      .max(120)
      .default(120),

    minFame: z.coerce
      .number()
      .int()
      .min(0)
      .max(100)
      .default(0),

    maxFame: z.coerce
      .number()
      .int()
      .min(0)
      .max(100)
      .default(100),

    city: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .optional(),

    tags: z
      .string()
      .trim()
      .optional(),

    sortBy: z
      .enum([
        "age",
        "distance",
        "fame",
        "tags",
      ])
      .default("fame"),

    sortOrder: z
      .enum(["asc", "desc"])
      .default("desc"),
  })
  .superRefine((query, context) => {
    if (query.minAge > query.maxAge) {
      context.addIssue({
        code: "custom",
        path: ["minAge"],
        message:
          "Minimum age cannot exceed maximum age",
      });
    }

    if (query.minFame > query.maxFame) {
      context.addIssue({
        code: "custom",
        path: ["minFame"],
        message:
          "Minimum fame cannot exceed maximum fame",
      });
    }
  });

export const searchRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get(
    "/profiles",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedQuery = searchSchema.safeParse(
        request.query,
      );

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: "Invalid search criteria",
          details:
            parsedQuery.error.flatten().fieldErrors,
        });
      }

      const {
        minAge,
        maxAge,
        minFame,
        maxFame,
        city,
        tags,
        sortBy,
        sortOrder,
      } = parsedQuery.data;

      const selectedTags = [
        ...new Set(
          (tags ?? "")
            .split(",")
            .map((tag) =>
              tag
                .trim()
                .replace(/^#/, "")
                .toLowerCase(),
            )
            .filter((tag) => tag.length > 0),
        ),
      ];

      if (selectedTags.length > 20) {
        return reply.status(400).send({
          error:
            "A maximum of 20 tags can be searched",
        });
      }

      const currentProfileResult =
        await database.query<{
          gender: string;
          sexual_preference: string;
        }>(
          `SELECT
             profiles.gender,
             profiles.sexual_preference
           FROM profiles
           INNER JOIN users
             ON users.id = profiles.user_id
           WHERE profiles.user_id = $1
             AND users.is_profile_complete = TRUE
           LIMIT 1`,
          [request.user.sub],
        );

      if (!currentProfileResult.rows[0]) {
        return reply.status(403).send({
          error:
            "Complete your profile before searching",
        });
      }

      const values: unknown[] = [
        request.user.sub,
        minAge,
        maxAge,
        minFame,
        maxFame,
      ];

      const filters: string[] = [
        `users.id <> $1`,
        `users.is_verified = TRUE`,
        `users.is_profile_complete = TRUE`,

        `EXTRACT(
           YEAR FROM age(
             CURRENT_DATE,
             profiles.birth_date
           )
         )::integer BETWEEN $2 AND $3`,

        `profiles.fame_rating
           BETWEEN $4 AND $5`,

        `(
           current_profile.sexual_preference =
             'everyone'
           OR current_profile.sexual_preference =
              profiles.gender
         )`,

        `(
           profiles.sexual_preference = 'everyone'
           OR profiles.sexual_preference =
              current_profile.gender
         )`,

        `NOT EXISTS (
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
         )`,
      ];

      if (city) {
        values.push(city);

        filters.push(
          `lower(profiles.city) =
             lower($${values.length})`,
        );
      }

      if (selectedTags.length > 0) {
        values.push(selectedTags);

        filters.push(
          `EXISTS (
             SELECT 1
             FROM user_tags searched_user_tags
             INNER JOIN tags searched_tags
               ON searched_tags.id =
                  searched_user_tags.tag_id
             WHERE searched_user_tags.user_id =
               users.id
               AND lower(searched_tags.name) =
                 ANY($${values.length}::text[])
           )`,
        );
      }

      const direction =
        sortOrder === "asc" ? "ASC" : "DESC";

      const orderColumns: Record<
        typeof sortBy,
        string
      > = {
        age: `age ${direction}`,
        distance:
          `distance_km ${direction} NULLS LAST`,
        fame:
          `profiles.fame_rating ${direction}`,
        tags: `common_tags ${direction}`,
      };

      const orderBy = orderColumns[sortBy];

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
      }>(
        `WITH current_profile AS (
           SELECT
             gender,
             sexual_preference,
             latitude,
             longitude
           FROM profiles
           WHERE user_id = $1
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
           END AS distance_km

         FROM users

         INNER JOIN profiles
           ON profiles.user_id = users.id

         CROSS JOIN current_profile

         LEFT JOIN profile_pictures
           ON profile_pictures.user_id = users.id
           AND profile_pictures.is_profile_picture =
               TRUE

         WHERE ${filters.join("\nAND ")}

         ORDER BY
           ${orderBy},
           users.username ASC

         LIMIT 100`,
        values,
      );

      return reply.status(200).send({
        criteria: {
          minAge,
          maxAge,
          minFame,
          maxFame,
          city: city ?? null,
          tags: selectedTags.map(
            (tag) => `#${tag}`,
          ),
          sortBy,
          sortOrder,
        },

        count: result.rows.length,

        profiles: result.rows.map(
          (profile) => ({
            id: profile.id,
            username: profile.username,
            firstName: profile.first_name,
            lastName: profile.last_name,
            gender: profile.gender,
            biography: profile.biography,
            age: profile.age,
            fameRating:
              profile.fame_rating,
            city: profile.city,
            neighborhood:
              profile.neighborhood,
            commonTags:
              profile.common_tags,
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
};

