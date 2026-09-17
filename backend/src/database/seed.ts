import argon2 from "argon2";
import path from "node:path";
import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import { database } from "./client.js";
import { env } from "../config/env.js";

if (env.NODE_ENV === "production") {
  throw new Error(
    "The seed script cannot run in production",
  );
}

const cities = [
  {
    name: "Le Havre",
    latitude: 49.4944,
    longitude: 0.1079,
  },
  {
    name: "Rouen",
    latitude: 49.4432,
    longitude: 1.0993,
  },
  {
    name: "Paris",
    latitude: 48.8566,
    longitude: 2.3522,
  },
  {
    name: "Caen",
    latitude: 49.1829,
    longitude: -0.3707,
  },
  {
    name: "Lille",
    latitude: 50.6292,
    longitude: 3.0573,
  },
  {
    name: "Nantes",
    latitude: 47.2184,
    longitude: -1.5536,
  },
  {
    name: "Bordeaux",
    latitude: 44.8378,
    longitude: -0.5792,
  },
  {
    name: "Lyon",
    latitude: 45.764,
    longitude: 4.8357,
  },
  {
    name: "Marseille",
    latitude: 43.2965,
    longitude: 5.3698,
  },
  {
    name: "Toulouse",
    latitude: 43.6047,
    longitude: 1.4442,
  },
];

const availableTags = [
  "technology",
  "travel",
  "music",
  "cooking",
  "gaming",
  "fitness",
  "cinema",
  "reading",
  "photography",
  "art",
  "nature",
  "hiking",
  "fashion",
  "football",
  "dancing",
  "coffee",
  "animals",
  "volunteering",
  "languages",
  "entrepreneurship",
];

const biographies = [
  "I enjoy discovering new places and meeting interesting people.",
  "Technology, music and good conversations make me happy.",
  "I love cooking, travelling and learning new things.",
  "Looking for someone kind, curious and honest.",
  "I enjoy outdoor activities, cinema and photography.",
];

const seedImageBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC" +
  "AAAAC0lEQVR42mP8/x8AAusB9Y9Zs7sAAAAASUVORK5CYII=";

const createSeedImage = async (): Promise<{
  relativePath: string;
  fileSize: number;
}> => {
  const image = Buffer.from(
    seedImageBase64,
    "base64",
  );

  const relativePath = "seed/default-profile.png";

  const absoluteDirectory = path.resolve(
    process.cwd(),
    "uploads",
    "seed",
  );

  await mkdir(absoluteDirectory, {
    recursive: true,
  });

  const absolutePath = path.join(
    absoluteDirectory,
    "default-profile.png",
  );

  await writeFile(absolutePath, image);

  return {
    relativePath,
    fileSize: image.length,
  };
};

const seed = async (): Promise<void> => {
  const client = await database.connect();

  try {
    console.log("Starting Matcha database seed...");

    const passwordHash = await argon2.hash(
      "Seed-Matcha84_Crystal-Wave9",
      {
        type: argon2.argon2id,
      },
    );

    const seedImage = await createSeedImage();

    await client.query("BEGIN");

    const tagIds = new Map<string, string>();

    for (const tagName of availableTags) {
      const result = await client.query<{
        id: string;
      }>(
        `INSERT INTO tags (name)
         VALUES ($1)
         ON CONFLICT ((lower(name)))
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tagName],
      );

      const tag = result.rows[0];

      if (!tag) {
        throw new Error(
          `Could not create tag ${tagName}`,
        );
      }

      tagIds.set(tagName, tag.id);
    }

    for (let index = 1; index <= 500; index += 1) {
      const suffix = index
        .toString()
        .padStart(3, "0");

      const username = `seed_user_${suffix}`;
      const email = `${username}@matcha.local`;

      const gender =
        index % 4 === 0
          ? "non_binary"
          : index % 2 === 0
            ? "male"
            : "female";

      const sexualPreference =
        index % 5 === 0
          ? "everyone"
          : gender === "male"
            ? "female"
            : gender === "female"
              ? "male"
              : "everyone";

      const city =
        cities[index % cities.length];

      if (!city) {
        throw new Error(
          "Seed city could not be selected",
        );
      }

      const birthYear =
        1970 + (index % 30);

      const birthMonth =
        ((index % 12) + 1)
          .toString()
          .padStart(2, "0");

      const birthDay =
        ((index % 27) + 1)
          .toString()
          .padStart(2, "0");

      const userResult = await client.query<{
        id: string;
      }>(
        `INSERT INTO users (
           email,
           username,
           first_name,
           last_name,
           password_hash,
           is_verified,
           is_profile_complete
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           TRUE,
           TRUE
         )
         ON CONFLICT ((lower(email)))
         DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           password_hash = EXCLUDED.password_hash,
           is_verified = TRUE,
           is_profile_complete = TRUE,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          email,
          username,
          `User${suffix}`,
          `Matcha${suffix}`,
          passwordHash,
        ],
      );

      const user = userResult.rows[0];

      if (!user) {
        throw new Error(
          `Could not create user ${username}`,
        );
      }

      await client.query(
        `INSERT INTO profiles (
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
           neighborhood,
           last_online_at
         )
         VALUES (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           TRUE,
           $7,
           $8,
           $9,
           $10,
           CURRENT_TIMESTAMP -
             ($11 * INTERVAL '1 minute')
         )
         ON CONFLICT (user_id)
         DO UPDATE SET
           gender = EXCLUDED.gender,
           sexual_preference =
             EXCLUDED.sexual_preference,
           biography = EXCLUDED.biography,
           birth_date = EXCLUDED.birth_date,
           fame_rating = EXCLUDED.fame_rating,
           location_consent =
             EXCLUDED.location_consent,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           city = EXCLUDED.city,
           neighborhood = EXCLUDED.neighborhood,
           last_online_at =
             EXCLUDED.last_online_at,
           updated_at = CURRENT_TIMESTAMP`,
        [
          user.id,
          gender,
          sexualPreference,
          biographies[
            index % biographies.length
          ],
          `${birthYear}-${birthMonth}-${birthDay}`,
          index % 101,
          city.latitude + (index % 10) * 0.001,
          city.longitude + (index % 10) * 0.001,
          city.name,
          `District ${(index % 8) + 1}`,
          index % 1440,
        ],
      );

      await client.query(
        `DELETE FROM user_tags
         WHERE user_id = $1`,
        [user.id],
      );

      for (
        let tagOffset = 0;
        tagOffset < 4;
        tagOffset += 1
      ) {
        const tagName =
          availableTags[
            (index + tagOffset * 3) %
              availableTags.length
          ];

        if (!tagName) {
          continue;
        }

        const tagId = tagIds.get(tagName);

        if (!tagId) {
          continue;
        }

        await client.query(
          `INSERT INTO user_tags (
             user_id,
             tag_id
           )
           VALUES ($1, $2)
           ON CONFLICT (user_id, tag_id)
           DO NOTHING`,
          [user.id, tagId],
        );
      }

      await client.query(
        `INSERT INTO profile_pictures (
           user_id,
           file_path,
           mime_type,
           file_size,
           is_profile_picture,
           position
         )
         VALUES (
           $1,
           $2,
           'image/png',
           $3,
           TRUE,
           1
         )
         ON CONFLICT (user_id, position)
         DO UPDATE SET
           file_path = EXCLUDED.file_path,
           mime_type = EXCLUDED.mime_type,
           file_size = EXCLUDED.file_size,
           is_profile_picture = TRUE`,
        [
          user.id,
          seedImage.relativePath,
          seedImage.fileSize,
        ],
      );

      if (index % 50 === 0) {
        console.log(
          `${index} profiles prepared...`,
        );
      }
    }

    await client.query("COMMIT");

    console.log(
      "Database seed completed: 500 profiles available.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await database.end();
  }
};

await seed();
