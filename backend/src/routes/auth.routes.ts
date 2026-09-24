import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import crypto from "node:crypto";
import { z } from "zod";
import { database } from "../database/client.js";
import { validatePasswordStrength } from "../services/password.service.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../services/email.service.js";

const registrationSchema = z.object({
  email: z
    .string()
    .trim()
    .email("A valid email address is required")
    .max(255),

  username: z
    .string()
    .trim()
    .min(3, "Username must contain at least 3 characters")
    .max(50)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores and hyphens",
    ),

  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters")
    .max(128),
});

const verificationSchema = z.object({
  token: z
    .string()
    .length(64, "Invalid verification token")
    .regex(/^[a-f0-9]+$/, "Invalid verification token"),
});

const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Username or email is required")
    .max(255),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128),
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("A valid email address is required")
    .max(255),
});

const resetPasswordSchema = z.object({
  token: z
    .string()
    .length(64, "Invalid password-reset token")
    .regex(/^[a-f0-9]+$/, "Invalid password-reset token"),

  password: z
    .string()
    .min(12, "Password must contain at least 12 characters")
    .max(128),
});

export const authRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.post(
    "/register",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsedBody = registrationSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid registration information",
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      const {
        email,
        username,
        firstName,
        lastName,
        password,
      } = parsedBody.data;

      const normalizedEmail = email.toLowerCase();
      const normalizedUsername = username.toLowerCase();

      const passwordError = validatePasswordStrength(password, [
        normalizedEmail,
        normalizedUsername,
        firstName,
        lastName,
      ]);

      if (passwordError) {
        return reply.status(400).send({
          error: "Weak password",
          details: {
            password: [passwordError],
          },
        });
      }

      const client = await database.connect();

      try {
        await client.query("BEGIN");

        const existingUser = await client.query(
          `SELECT id
           FROM users
           WHERE lower(email) = $1
              OR lower(username) = $2
           LIMIT 1`,
          [normalizedEmail, normalizedUsername],
        );

        if (existingUser.rowCount !== 0) {
          await client.query("ROLLBACK");

          return reply.status(409).send({
            error: "Email address or username is already registered",
          });
        }

        const passwordHash = await argon2.hash(password, {
          type: argon2.argon2id,
        });

        const insertedUser = await client.query<{
          id: string;
          email: string;
          username: string;
          first_name: string;
          last_name: string;
          created_at: Date;
        }>(
          `INSERT INTO users (
             email,
             username,
             first_name,
             last_name,
             password_hash
           )
           VALUES ($1, $2, $3, $4, $5)
           RETURNING
             id,
             email,
             username,
             first_name,
             last_name,
             created_at`,
          [
            normalizedEmail,
            username,
            firstName,
            lastName,
            passwordHash,
          ],
        );

        const user = insertedUser.rows[0];

        if (!user) {
          throw new Error("User creation failed");
        }

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
          [user.id, tokenHash],
        );
        
                await sendVerificationEmail({
          recipient: user.email,
          username: user.username,
          token: verificationToken,
        });

        await client.query("COMMIT");

        return reply.status(201).send({
          message: "Account created. Please verify your email address.",
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            createdAt: user.created_at,
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

  app.post("/verify-email", async (request, reply) => {
    const parsedBody = verificationSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid verification request",
        details: parsedBody.error.flatten().fieldErrors,
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(parsedBody.data.token)
      .digest("hex");

    const result = await database.query<{ id: string }>(
      `WITH valid_token AS (
         UPDATE account_tokens
         SET used_at = CURRENT_TIMESTAMP
         WHERE token_hash = $1
           AND token_type = 'email_verification'
           AND used_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
         RETURNING user_id
       )
       UPDATE users
       SET
         is_verified = TRUE,
         updated_at = CURRENT_TIMESTAMP
       FROM valid_token
       WHERE users.id = valid_token.user_id
       RETURNING users.id`,
      [tokenHash],
    );

    if (result.rowCount === 0) {
      return reply.status(400).send({
        error: "Verification token is invalid, expired or already used",
      });
    }

    return reply.status(200).send({
      message: "Email address verified successfully",
    });
  });
    app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsedBody = loginSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid login information",
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      const identifier = parsedBody.data.identifier.toLowerCase();

      const result = await database.query<{
        id: string;
        email: string;
        username: string;
        first_name: string;
        last_name: string;
        password_hash: string;
        is_verified: boolean;
      }>(
        `SELECT
           id,
           email,
           username,
           first_name,
           last_name,
           password_hash,
           is_verified
         FROM users
         WHERE lower(email) = $1
            OR lower(username) = $1
         LIMIT 1`,
        [identifier],
      );

      const user = result.rows[0];

      if (!user) {
        return reply.status(401).send({
          error: "Invalid username, email or password",
        });
      }

      const validPassword = await argon2.verify(
        user.password_hash,
        parsedBody.data.password,
      );

      if (!validPassword) {
        return reply.status(401).send({
          error: "Invalid username, email or password",
        });
      }

      if (!user.is_verified) {
        return reply.status(403).send({
          error: "Please verify your email address before logging in",
        });
      }

      const authenticationToken = app.jwt.sign(
        {
          sub: user.id,
          username: user.username,
        },
        {
          expiresIn: "7d",
        },
      );

      await database.query(
        `UPDATE users
         SET
           last_login_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id],
      );

      reply.setCookie("matcha_token", authenticationToken, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });

      return reply.status(200).send({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
        },
      });
    },
  );
    app.get(
    "/me",
    {
      preHandler: authenticate,
    },
    async (request, reply) => {const userId = request.user.sub;

      if (!userId) {
        return reply.status(401).send({
          error: "Invalid authentication token",
        });
      }

      const result = await database.query<{
        id: string;
        email: string;
        username: string;
        first_name: string;
        last_name: string;
        is_verified: boolean;
        is_profile_complete: boolean;
        last_login_at: Date | null;
      }>(
        `SELECT
           id,
           email,
           username,
           first_name,
           last_name,
           is_verified,
           is_profile_complete,
           last_login_at
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId],
      );

      const user = result.rows[0];

      if (!user) {
        return reply.status(401).send({
          error: "User account no longer exists",
        });
      }

      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          isVerified: user.is_verified,
          isProfileComplete: user.is_profile_complete,
          lastLoginAt: user.last_login_at,
        },
      });
    },
  );
    app.post("/logout", async (_request, reply) => {
    reply.clearCookie("matcha_token", {
      path: "/",
    });

    return reply.status(200).send({
      message: "Logout successful",
    });
  });

  app.post(
    "/forgot-password",
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsedBody = forgotPasswordSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid password-reset request",
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      const email = parsedBody.data.email.toLowerCase();

      const result = await database.query<{
        id: string;
        email: string;
        username: string;
      }>(
        `SELECT id, email, username
         FROM users
         WHERE lower(email) = $1
         LIMIT 1`,
        [email],
      );

      const user = result.rows[0];

      if (user) {
        const resetToken = crypto.randomBytes(32).toString("hex");

        const tokenHash = crypto
          .createHash("sha256")
          .update(resetToken)
          .digest("hex");

        const client = await database.connect();

        try {
          await client.query("BEGIN");

          await client.query(
            `UPDATE account_tokens
             SET used_at = CURRENT_TIMESTAMP
             WHERE user_id = $1
               AND token_type = 'password_reset'
               AND used_at IS NULL`,
            [user.id],
          );

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
               'password_reset',
               CURRENT_TIMESTAMP + INTERVAL '1 hour'
             )`,
            [user.id, tokenHash],
          );

          await sendPasswordResetEmail({
            recipient: user.email,
            username: user.username,
            token: resetToken,
          });

          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }

      return reply.status(200).send({
        message:
          "If an account exists for that email, a password-reset link has been sent.",
      });
    },
  );

    app.post(
    "/reset-password",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsedBody = resetPasswordSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: "Invalid password-reset information",
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      const tokenHash = crypto
        .createHash("sha256")
        .update(parsedBody.data.token)
        .digest("hex");

      const client = await database.connect();

      try {
        await client.query("BEGIN");

        const result = await client.query<{
          id: string;
          email: string;
          username: string;
          first_name: string;
          last_name: string;
        }>(
          `SELECT
             users.id,
             users.email,
             users.username,
             users.first_name,
             users.last_name
           FROM account_tokens
           INNER JOIN users
             ON users.id = account_tokens.user_id
           WHERE account_tokens.token_hash = $1
             AND account_tokens.token_type = 'password_reset'
             AND account_tokens.used_at IS NULL
             AND account_tokens.expires_at > CURRENT_TIMESTAMP
           LIMIT 1
           FOR UPDATE OF account_tokens, users`,
          [tokenHash],
        );

        const user = result.rows[0];

        if (!user) {
          await client.query("ROLLBACK");

          return reply.status(400).send({
            error:
              "Password-reset token is invalid, expired or already used",
          });
        }

        const passwordError = validatePasswordStrength(
          parsedBody.data.password,
          [
            user.email,
            user.username,
            user.first_name,
            user.last_name,
          ],
        );

        if (passwordError) {
          await client.query("ROLLBACK");

          return reply.status(400).send({
            error: "Weak password",
            details: {
              password: [passwordError],
            },
          });
        }

        const passwordHash = await argon2.hash(
          parsedBody.data.password,
          {
            type: argon2.argon2id,
          },
        );

        await client.query(
          `UPDATE users
           SET
             password_hash = $1,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [passwordHash, user.id],
        );

        await client.query(
          `UPDATE account_tokens
           SET used_at = CURRENT_TIMESTAMP
           WHERE user_id = $1
             AND token_type = 'password_reset'
             AND used_at IS NULL`,
          [user.id],
        );

        await client.query("COMMIT");

        reply.clearCookie("matcha_token", {
          path: "/",
        });

        return reply.status(200).send({
          message: "Password changed successfully. Please log in again.",
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