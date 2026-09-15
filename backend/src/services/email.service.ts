import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const emailTransport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
});

type VerificationEmailOptions = {
  recipient: string;
  username: string;
  token: string;
};

export const sendVerificationEmail = async ({
  recipient,
  username,
  token,
}: VerificationEmailOptions): Promise<void> => {
  const verificationUrl =
    `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;

  await emailTransport.sendMail({
    from: env.SMTP_FROM,
    to: recipient,
    subject: "Verify your Matcha account",
    text: [
      `Hello ${username},`,
      "",
      "Welcome to Matcha.",
      "Use the following link to verify your email address:",
      "",
      verificationUrl,
      "",
      "This link expires after 24 hours.",
      "If you did not create this account, ignore this email.",
    ].join("\n"),
  }); 
};

type PasswordResetEmailOptions = {
  recipient: string;
  username: string;
  token: string;
};

export const sendPasswordResetEmail = async ({
  recipient,
  username,
  token,
}: PasswordResetEmailOptions): Promise<void> => {
  const resetUrl =
    `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

  await emailTransport.sendMail({
    from: env.SMTP_FROM,
    to: recipient,
    subject: "Reset your Matcha password",
    text: [
      `Hello ${username},`,
      "",
      "A password reset was requested for your Matcha account.",
      "Use the following link to choose a new password:",
      "",
      resetUrl,
      "",
      "This link expires after one hour.",
      "If you did not request this change, ignore this email.",
    ].join("\n"),
  });
};