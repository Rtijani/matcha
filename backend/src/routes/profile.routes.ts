import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import path from "node:path";
import {
  mkdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { database } from "../database/client.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  refreshProfileCompletion,
} from "../services/profile-completion.service.js";
import {
  locateByIp,
} from "../services/geolocation.service.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const isAdult = (birthDate: string): boolean => {
  const date = new Date(`${birthDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();

  const adultLimit = new Date(
    Date.UTC(
      today.getUTCFullYear() - 18,
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );

  return date <= adultLimit;
};

const profileSchema = z
  .object({
    gender: z.enum([
      "male",
      "female",
      "non_binary",
      "other",
    ]),

    sexualPreference: z.enum([
      "male",
      "female",
      "everyone",
    ]),

    biography: z
      .string()
      .trim()
      .min(1)
      .max(1000),

    birthDate: z
      .string()
      .regex(
        datePattern,
        "Birth date must use YYYY-MM-DD",
      )
      .refine(
        isAdult,
        "You must be at least 18 years old",
      ),

    locationConsent: z.boolean(),

    latitude: z
      .number()
      .min(-90)
      .max(90)
      .nullable()
      .optional(),

    longitude: z
      .number()
      .min(-180)
      .max(180)
      .nullable()
      .optional(),

    city: z
      .string()
      .trim()
      .max(150)
      .nullable()
      .optional()
      .transform((value) => (value ? value : undefined)),

    neighborhood: z
      .string()
      .trim()
      .max(150)
      .nullable()
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .superRefine((profile, context) => {
    if (
      profile.locationConsent &&
      (
        profile.latitude == null ||
        profile.longitude == null
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message:
          "Latitude and longitude are required with GPS consent",
      });
    }

    if (
      !profile.locationConsent &&
      !profile.city
    ) {
      context.addIssue({
        code: "custom",
        path: ["city"],
        message:
          "A city is required when GPS consent is not given",
      });
    }
  });

const tagsSchema = z.object({
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(50)
        .regex(
          /^#?[a-zA-Z0-9_-]+$/,
          "Tags can only contain letters, numbers, underscores and hyphens",
        ),
    )
    .min(1, "Select at least one interest")
    .max(20, "A maximum of 20 interests is allowed"),
});

const pictureParamsSchema = z.object({
  pictureId: z.string().uuid("Invalid picture ID"),
});

export const profileRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  /*
   * Get the authenticated user's full profile.
   */
  /*
   * Best-effort location lookup from the request's IP address, used
   * as a fallback when the user declines the browser's GPS prompt.
   */
  app.get(
    "/geolocate",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const location = await locateByIp(request.ip);

      return reply.status(200).send({ location });
    },
  );
  app.get(
  "/location/approximate",
  {
    preHandler: authenticate,
  },
  async (request, reply) => {
    const location =
      await locateByIp(request.ip);

    /*
     * Failure to determine an IP location is an
     * expected situation, not a server crash.
     */
    return reply.status(200).send({
      location,
    });
  },
);
  app.get(
    "/me",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const profileResult = await database.query<{
        id: string;
        email: string;
        username: string;
        first_name: string;
        last_name: string;
        is_profile_complete: boolean;
        gender: string | null;
        sexual_preference: string | null;
        biography: string | null;
        birth_date: string | null;
        fame_rating: number | null;
        location_consent: boolean | null;
        latitude: string | null;
        longitude: string | null;
        city: string | null;
        neighborhood: string | null;
      }>(
        `SELECT
           users.id,
           users.email,
           users.username,
           users.first_name,
           users.last_name,
           users.is_profile_complete,
           profiles.gender,
           profiles.sexual_preference,
           profiles.biography,
           TO_CHAR(
             profiles.birth_date,
             'YYYY-MM-DD'
           ) AS birth_date,
           profiles.fame_rating,
           profiles.location_consent,
           profiles.latitude,
           profiles.longitude,
           profiles.city,
           profiles.neighborhood
         FROM users
         LEFT JOIN profiles
           ON profiles.user_id = users.id
         WHERE users.id = $1
         LIMIT 1`,
        [request.user.sub],
      );

      const profile = profileResult.rows[0];

      if (!profile) {
        return reply.status(404).send({
          error: "User account not found",
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
        [request.user.sub],
      );

      const picturesResult = await database.query<{
        id: string;
        file_path: string;
        mime_type: string;
        file_size: number;
        is_profile_picture: boolean;
        position: number;
      }>(
        `SELECT
           id,
           file_path,
           mime_type,
           file_size,
           is_profile_picture,
           position
         FROM profile_pictures
         WHERE user_id = $1
         ORDER BY position`,
        [request.user.sub],
      );

      return reply.status(200).send({
        profile: {
          id: profile.id,
          email: profile.email,
          username: profile.username,
          firstName: profile.first_name,
          lastName: profile.last_name,
          isProfileComplete:
            profile.is_profile_complete,
          gender: profile.gender,
          sexualPreference:
            profile.sexual_preference,
          biography: profile.biography,
          birthDate: profile.birth_date,
          fameRating: profile.fame_rating ?? 0,
          locationConsent:
            profile.location_consent ?? false,
          latitude:
            profile.latitude === null
              ? null
              : Number(profile.latitude),
          longitude:
            profile.longitude === null
              ? null
              : Number(profile.longitude),
          city: profile.city,
          neighborhood: profile.neighborhood,

          tags: tagsResult.rows.map((tag) => ({
            id: tag.id,
            name: `#${tag.name}`,
          })),

          pictures: picturesResult.rows.map(
            (picture) => ({
              id: picture.id,
              url: `/uploads/${picture.file_path}`,
              mimeType: picture.mime_type,
              fileSize: picture.file_size,
              isProfilePicture:
                picture.is_profile_picture,
              position: picture.position,
            }),
          ),
        },
      });
    },
  );

  /*
   * Create or update profile information.
   */
  app.put(
    "/me",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedBody = profileSchema.safeParse(
        request.body,
      );

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid profile information",
          details:
            parsedBody.error.flatten().fieldErrors,
        });
      }

      const profile = parsedBody.data;

      const result = await database.query<{
        user_id: string;
        gender: string;
        sexual_preference: string;
        biography: string;
        birth_date: string;
        fame_rating: number;
        location_consent: boolean;
        latitude: string | null;
        longitude: string | null;
        city: string | null;
        neighborhood: string | null;
      }>(
        `INSERT INTO profiles (
           user_id,
           gender,
           sexual_preference,
           biography,
           birth_date,
           location_consent,
           latitude,
           longitude,
           city,
           neighborhood
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10
         )
         ON CONFLICT (user_id)
         DO UPDATE SET
           gender = EXCLUDED.gender,
           sexual_preference =
             EXCLUDED.sexual_preference,
           biography = EXCLUDED.biography,
           birth_date = EXCLUDED.birth_date,
           location_consent =
             EXCLUDED.location_consent,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           city = EXCLUDED.city,
           neighborhood = EXCLUDED.neighborhood,
           updated_at = CURRENT_TIMESTAMP
         RETURNING
           user_id,
           gender,
           sexual_preference,
           biography,
           birth_date,
           fame_rating,
           location_consent,
           latitude,
           longitude,
           city,
           neighborhood`,
        [
          request.user.sub,
          profile.gender,
          profile.sexualPreference,
          profile.biography,
          profile.birthDate,
          profile.locationConsent,
          profile.locationConsent
            ? profile.latitude
            : null,
          profile.locationConsent
            ? profile.longitude
            : null,
          profile.city ?? null,
          profile.neighborhood ?? null,
        ],
      );

      const isProfileComplete =
        await refreshProfileCompletion(
          request.user.sub,
        );

      return reply.status(200).send({
        message: "Profile updated successfully",
        isProfileComplete,
        profile: result.rows[0],
      });
    },
  );

  /*
   * List all reusable interest tags.
   */
  app.get(
    "/tags",
    {
      preHandler: authenticate,
    },
    async (_request, reply) => {
      const result = await database.query<{
        id: string;
        name: string;
        usage_count: string;
      }>(
        `SELECT
           tags.id,
           tags.name,
           COUNT(user_tags.user_id)::text
             AS usage_count
         FROM tags
         LEFT JOIN user_tags
           ON user_tags.tag_id = tags.id
         GROUP BY tags.id, tags.name
         ORDER BY
           COUNT(user_tags.user_id) DESC,
           tags.name ASC`,
      );

      return reply.status(200).send({
        tags: result.rows.map((tag) => ({
          id: tag.id,
          name: `#${tag.name}`,
          usageCount: Number(tag.usage_count),
        })),
      });
    },
  );

  /*
   * Replace the authenticated user's tags.
   */
  app.put(
    "/me/tags",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedBody = tagsSchema.safeParse(
        request.body,
      );

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid interest tags",
          details:
            parsedBody.error.flatten().fieldErrors,
        });
      }

      const normalizedTags = [
        ...new Set(
          parsedBody.data.tags.map((tag) =>
            tag
              .replace(/^#/, "")
              .toLowerCase(),
          ),
        ),
      ];

      const client = await database.connect();

      try {
        await client.query("BEGIN");

        await client.query(
          `DELETE FROM user_tags
           WHERE user_id = $1`,
          [request.user.sub],
        );

        for (const tagName of normalizedTags) {
          const tagResult = await client.query<{
            id: string;
          }>(
            `INSERT INTO tags (name)
             VALUES ($1)
             ON CONFLICT ((lower(name)))
             DO UPDATE SET
               name = EXCLUDED.name
             RETURNING id`,
            [tagName],
          );

          const tag = tagResult.rows[0];

          if (!tag) {
            throw new Error(
              "Tag creation failed",
            );
          }

          await client.query(
            `INSERT INTO user_tags (
               user_id,
               tag_id
             )
             VALUES ($1, $2)`,
            [request.user.sub, tag.id],
          );
        }

        const isProfileComplete =
          await refreshProfileCompletion(
            request.user.sub,
            client,
          );

        await client.query("COMMIT");

        return reply.status(200).send({
          message:
            "Interest tags updated successfully",
          isProfileComplete,
          tags: normalizedTags.map(
            (tag) => `#${tag}`,
          ),
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );

  /*
   * Upload a picture.
   */
  app.post(
    "/me/pictures",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const uploadedFile = await request.file();

      if (!uploadedFile) {
        return reply.status(400).send({
          error: "An image file is required",
        });
      }

      const fileBuffer =
        await uploadedFile.toBuffer();

      const detectedType =
        await fileTypeFromBuffer(fileBuffer);

      const allowedTypes =
        new Map<string, string>([
          ["image/jpeg", "jpg"],
          ["image/png", "png"],
          ["image/webp", "webp"],
        ]);

      if (
        !detectedType ||
        !allowedTypes.has(detectedType.mime)
      ) {
        return reply.status(400).send({
          error:
            "Only JPEG, PNG and WebP images are allowed",
        });
      }

      const client = await database.connect();
      let savedFilePath: string | null = null;

      try {
        await client.query("BEGIN");

        await client.query(
          `SELECT id
           FROM users
           WHERE id = $1
           FOR UPDATE`,
          [request.user.sub],
        );

        const picturesResult =
          await client.query<{
            position: number;
          }>(
            `SELECT position
             FROM profile_pictures
             WHERE user_id = $1
             ORDER BY position`,
            [request.user.sub],
          );

        if (
          picturesResult.rowCount !== null &&
          picturesResult.rowCount >= 5
        ) {
          await client.query("ROLLBACK");

          return reply.status(400).send({
            error:
              "A maximum of five profile pictures is allowed",
          });
        }

        const occupiedPositions = new Set(
          picturesResult.rows.map(
            (picture) => picture.position,
          ),
        );

        let position = 1;

        while (
          occupiedPositions.has(position)
        ) {
          position += 1;
        }

        const extension = allowedTypes.get(
          detectedType.mime,
        );

        if (!extension) {
          throw new Error(
            "Unsupported image extension",
          );
        }

        const filename =
          `${crypto.randomUUID()}.${extension}`;

        const relativeDirectory = path.join(
          "profiles",
          request.user.sub,
        );

        const absoluteDirectory = path.resolve(
          process.cwd(),
          "uploads",
          relativeDirectory,
        );

        await mkdir(absoluteDirectory, {
          recursive: true,
        });

        savedFilePath = path.join(
          absoluteDirectory,
          filename,
        );

        await writeFile(
          savedFilePath,
          fileBuffer,
          {
            flag: "wx",
          },
        );

        const relativeFilePath = path
          .join(
            relativeDirectory,
            filename,
          )
          .replaceAll(path.sep, "/");

        const isFirstPicture =
          picturesResult.rowCount === 0;

        const insertedPicture =
          await client.query<{
            id: string;
            file_path: string;
            mime_type: string;
            file_size: number;
            is_profile_picture: boolean;
            position: number;
          }>(
            `INSERT INTO profile_pictures (
               user_id,
               file_path,
               mime_type,
               file_size,
               is_profile_picture,
               position
             )
             VALUES (
               $1, $2, $3, $4, $5, $6
             )
             RETURNING
               id,
               file_path,
               mime_type,
               file_size,
               is_profile_picture,
               position`,
            [
              request.user.sub,
              relativeFilePath,
              detectedType.mime,
              fileBuffer.length,
              isFirstPicture,
              position,
            ],
          );

        const picture =
          insertedPicture.rows[0];

        if (!picture) {
          throw new Error(
            "Picture creation failed",
          );
        }

        const isProfileComplete =
          await refreshProfileCompletion(
            request.user.sub,
            client,
          );

        await client.query("COMMIT");

        return reply.status(201).send({
          message:
            "Profile picture uploaded successfully",
          isProfileComplete,
          picture: {
            id: picture.id,
            url:
              `/uploads/${picture.file_path}`,
            mimeType: picture.mime_type,
            fileSize: picture.file_size,
            isProfilePicture:
              picture.is_profile_picture,
            position: picture.position,
          },
        });
      } catch (error) {
        await client.query("ROLLBACK");

        if (savedFilePath) {
          await unlink(savedFilePath).catch(
            () => undefined,
          );
        }

        throw error;
      } finally {
        client.release();
      }
    },
  );

  /*
   * Select the main profile picture.
   */
  app.put(
    "/me/pictures/:pictureId/main",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams =
        pictureParamsSchema.safeParse(
          request.params,
        );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid picture ID",
        });
      }

      const client = await database.connect();

      try {
        await client.query("BEGIN");

        await client.query(
          `SELECT id
           FROM users
           WHERE id = $1
           FOR UPDATE`,
          [request.user.sub],
        );

        const pictureExists =
          await client.query(
            `SELECT id
             FROM profile_pictures
             WHERE id = $1
               AND user_id = $2`,
            [
              parsedParams.data.pictureId,
              request.user.sub,
            ],
          );

        if (pictureExists.rowCount === 0) {
          await client.query("ROLLBACK");

          return reply.status(404).send({
            error: "Picture not found",
          });
        }

        await client.query(
          `UPDATE profile_pictures
           SET is_profile_picture = FALSE
           WHERE user_id = $1`,
          [request.user.sub],
        );

        await client.query(
          `UPDATE profile_pictures
           SET is_profile_picture = TRUE
           WHERE id = $1
             AND user_id = $2`,
          [
            parsedParams.data.pictureId,
            request.user.sub,
          ],
        );

        await refreshProfileCompletion(
          request.user.sub,
          client,
        );

        await client.query("COMMIT");

        return reply.status(200).send({
          message:
            "Main profile picture updated successfully",
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );

  /*
   * Delete a picture.
   */
  app.delete(
    "/me/pictures/:pictureId",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedParams =
        pictureParamsSchema.safeParse(
          request.params,
        );

      if (!parsedParams.success) {
        return reply.status(400).send({
          error: "Invalid picture ID",
        });
      }

      const client = await database.connect();
      let deletedFilePath: string | null = null;

      try {
        await client.query("BEGIN");

        await client.query(
          `SELECT id
           FROM users
           WHERE id = $1
           FOR UPDATE`,
          [request.user.sub],
        );

        const pictureResult =
          await client.query<{
            id: string;
            file_path: string;
            is_profile_picture: boolean;
          }>(
            `SELECT
               id,
               file_path,
               is_profile_picture
             FROM profile_pictures
             WHERE id = $1
               AND user_id = $2
             FOR UPDATE`,
            [
              parsedParams.data.pictureId,
              request.user.sub,
            ],
          );

        const picture =
          pictureResult.rows[0];

        if (!picture) {
          await client.query("ROLLBACK");

          return reply.status(404).send({
            error: "Picture not found",
          });
        }

        deletedFilePath = picture.file_path;

        await client.query(
          `DELETE FROM profile_pictures
           WHERE id = $1`,
          [picture.id],
        );

        if (picture.is_profile_picture) {
          await client.query(
            `UPDATE profile_pictures
             SET is_profile_picture = TRUE
             WHERE id = (
               SELECT id
               FROM profile_pictures
               WHERE user_id = $1
               ORDER BY position
               LIMIT 1
             )`,
            [request.user.sub],
          );
        }

        const isProfileComplete =
          await refreshProfileCompletion(
            request.user.sub,
            client,
          );

        await client.query("COMMIT");

        const uploadsRoot = path.resolve(
          process.cwd(),
          "uploads",
        );

        const absoluteFilePath = path.resolve(
          uploadsRoot,
          deletedFilePath,
        );

        const relativeCheck = path.relative(
          uploadsRoot,
          absoluteFilePath,
        );

        if (
          relativeCheck &&
          !relativeCheck.startsWith("..") &&
          !path.isAbsolute(relativeCheck)
        ) {
          await unlink(absoluteFilePath).catch(
            () => undefined,
          );
        }

        return reply.status(200).send({
          message:
            "Picture deleted successfully",
          isProfileComplete,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );
};