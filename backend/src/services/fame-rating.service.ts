import type { PoolClient } from "pg";
import { database } from "../database/client.js";

type DatabaseConnection = PoolClient | typeof database;

export const refreshFameRating = async (
  userId: string,
  connection: DatabaseConnection = database,
): Promise<number> => {
  const result = await connection.query<{
    fame_rating: number;
  }>(
    `UPDATE profiles
     SET
       fame_rating = LEAST(
         100,
         (
           SELECT COUNT(*)::integer * 5
           FROM likes
           WHERE liked_id = $1
         )
       ),
       updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1
     RETURNING fame_rating`,
    [userId],
  );

  return result.rows[0]?.fame_rating ?? 0;
};

