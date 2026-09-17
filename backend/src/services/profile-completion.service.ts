import type { PoolClient } from "pg";
import { database } from "../database/client.js";

type DatabaseConnection = PoolClient | typeof database;

export const refreshProfileCompletion = async (
  userId: string,
  connection: DatabaseConnection = database,
): Promise<boolean> => {
  const result = await connection.query<{
    is_complete: boolean;
  }>(
    `SELECT (
       EXISTS (
         SELECT 1
         FROM profiles
         WHERE user_id = $1
           AND gender IS NOT NULL
           AND sexual_preference IS NOT NULL
           AND length(trim(biography)) > 0
           AND birth_date IS NOT NULL
           AND (
             (
               location_consent = TRUE
               AND latitude IS NOT NULL
               AND longitude IS NOT NULL
             )
             OR
             (
               location_consent = FALSE
               AND city IS NOT NULL
               AND length(trim(city)) > 0
             )
           )
       )
       AND EXISTS (
         SELECT 1
         FROM user_tags
         WHERE user_id = $1
       )
       AND EXISTS (
         SELECT 1
         FROM profile_pictures
         WHERE user_id = $1
           AND is_profile_picture = TRUE
       )
     ) AS is_complete`,
    [userId],
  );

  const isComplete = result.rows[0]?.is_complete ?? false;

  await connection.query(
    `UPDATE users
     SET
       is_profile_complete = $1,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [isComplete, userId],
  );

  return isComplete;
};
