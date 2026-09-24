import type { PoolClient } from "pg";
import { database } from "../database/client.js";

type DatabaseConnection =
  | PoolClient
  | typeof database;

export const canUsersChat = async (
  firstUserId: string,
  secondUserId: string,
  connection: DatabaseConnection = database,
): Promise<boolean> => {
  const result = await connection.query<{
    can_chat: boolean;
  }>(
    `SELECT (
       EXISTS (
         SELECT 1
         FROM likes
         WHERE liker_id = $1
           AND liked_id = $2
       )
       AND EXISTS (
         SELECT 1
         FROM likes
         WHERE liker_id = $2
           AND liked_id = $1
       )
       AND NOT EXISTS (
         SELECT 1
         FROM blocks
         WHERE (
           blocker_id = $1
           AND blocked_id = $2
         )
         OR (
           blocker_id = $2
           AND blocked_id = $1
         )
       )
     ) AS can_chat`,
    [
      firstUserId,
      secondUserId,
    ],
  );

  return result.rows[0]?.can_chat ?? false;
};
