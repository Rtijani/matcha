import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import crypto from "node:crypto";
import { z } from "zod";
import { database } from "../database/client.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  sendVerificationEmail,
} from "../services/email.service.js";

const updateAccountSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),

  email: z
    .string()
    .trim()
    .email("A valid email address is required")
    .max(255),

  currentPassword: z
    .string()
    .min(1, "Current password is required")
    .max(128),
});

export const accountRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.put(
    "/me",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const parsedBody = updateAccountSchema.safeParse(
        request.body,
      );

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid account information",
          details:
            parsedBody.error.flatten().fieldErrors,
        });
      }

      const {
        firstName,
        lastName,
        email,
        currentPassword,
      } = parsedBody.data;

      const normalizedEmail = email.toLowerCase();
      const client = await database.connect();

      try {
        await client.query("BEGIN");

        const userResult = await client.query<{
          id: string;
          email: string;
          username: string;
          password_hash: string;
        }>(
          `SELECT
             id,
             email,
             username,
             password_hash
           FROM users
           WHERE id = $1
           FOR UPDATE`,
          [request.user.sub],
        );

        const user = userResult.rows[0];

        if (!user) {
          await client.query("ROLLBACK");

          return reply.status(404).send({
            error: "User account not found",
          });
        }

        const passwordIsValid = await argon2.verify(
          user.password_hash,
          currentPassword,
        );

        if (!passwordIsValid) {
          await client.query("ROLLBACK");

          return reply.status(401).send({
            error: "Current password is incorrect",
          });
        }

        const emailChanged =
          user.email.toLowerCase() !== normalizedEmail;

        if (emailChanged) {
          const duplicateEmail = await client.query(
            `SELECT id
             FROM users
             WHERE lower(email) = $1
               AND id <> $2
             LIMIT 1`,
            [
              normalizedEmail,
              request.user.sub,
            ],
          );

          if (duplicateEmail.rowCount !== 0) {
            await client.query("ROLLBACK");

            return reply.status(409).send({
              error: "Email address is already registered",
            });
          }
        }

        await client.query(
          `UPDATE users
           SET
             first_name = $1,
             last_name = $2,
             email = $3,
             is_verified = CASE
               WHEN $4 = TRUE THEN FALSE
               ELSE is_verified
             END,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [
            firstName,
            lastName,
            normalizedEmail,
            emailChanged,
            request.user.sub,
          ],
        );

        if (emailChanged) {
          await client.query(
            `UPDATE account_tokens
             SET used_at = CURRENT_TIMESTAMP
             WHERE user_id = $1
               AND token_type = 'email_verification'
               AND used_at IS NULL`,
            [request.user.sub],
          );

          const verificationToken = crypto
            .randomBytes(32)
            .toString("hex");

          const tokenHash = crypto
            .createHash("sha256")
            .update(verificationToken)
            .digest("hex");

          await client.query(
            `INSERT INTO account_tokens (
               user_id,
               token_hash,
               token_type,
               expires_at
             )
             VALUES (
               $1,
               $2,
               'email_verification',
               CURRENT_TIMESTAMP + INTERVAL '24 hours'
             )`,
            [
              request.user.sub,
              tokenHash,
            ],
          );

          await sendVerificationEmail({
            recipient: normalizedEmail,
            username: user.username,
            token: verificationToken,
          });
        }

        await client.query("COMMIT");

        return reply.status(200).send({
          message: emailChanged
            ? "Account updated. Please verify your new email address."
            : "Account updated successfully",
          requiresEmailVerification: emailChanged,
          user: {
            id: user.id,
            email: normalizedEmail,
            username: user.username,
            firstName,
            lastName,
          },
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
