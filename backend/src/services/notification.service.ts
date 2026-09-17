import type { PoolClient } from "pg";
import { database } from "../database/client.js";

export type NotificationType =
  | "profile_view"
  | "like"
  | "match"
  | "message"
  | "unlike";

type DatabaseConnection =
  | PoolClient
  | typeof database;

type CreateNotificationOptions = {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  message: string;
  relatedId?: string;
};

export const createNotification = async (
  options: CreateNotificationOptions,
  connection: DatabaseConnection = database,
) => {
  const result = await connection.query<{
    id: string;
    recipient_id: string;
    actor_id: string | null;
    type: NotificationType;
    message: string;
    related_id: string | null;
    read_at: Date | null;
    created_at: Date;
  }>(
    `INSERT INTO notifications (
       recipient_id,
       actor_id,
       type,
       message,
       related_id
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       recipient_id,
       actor_id,
       type,
       message,
       related_id,
       read_at,
       created_at`,
    [
      options.recipientId,
      options.actorId ?? null,
      options.type,
      options.message,
      options.relatedId ?? null,
    ],
  );

  return result.rows[0];
};
