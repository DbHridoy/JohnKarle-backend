import nodemailer from "nodemailer";

import { env } from "../config/env.config.js";
import { ApiError } from "./api-error.util.js";

let transporter: nodemailer.Transporter | null = null;

export const getMailTransporter = (): nodemailer.Transporter => {
  if (transporter) {
    return transporter;
  }

  if (!env.GMAIL_EMAIL || !env.GMAIL_APP_PASSWORD) {
    throw new ApiError(
      500,
      "Gmail mail credentials are not configured.",
      "MAIL_CONFIGURATION_ERROR",
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.GMAIL_EMAIL,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const buildBasicHtmlEmail = (lines: string[]): string => {
  const body = lines
    .map((line) =>
      line.trim() === ""
        ? '<div style="height:16px;line-height:16px">&nbsp;</div>'
        : `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`,
    )
    .join("");

  return [
    "<!doctype html>",
    '<html lang="en">',
    '<body style="margin:0;padding:24px;background:#f6f8fb;font-family:Arial,sans-serif;color:#17202a">',
    '<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dfe6ee;border-radius:12px;padding:24px">',
    '<div style="font-size:20px;font-weight:700;margin:0 0 20px">John Karle</div>',
    body,
    '<p style="margin:20px 0 0;color:#5b6672;font-size:12px">Automated transactional email. Please do not reply unless instructed.</p>',
    "</div>",
    "</body>",
    "</html>",
  ].join("");
};

export const sendTransactionalEmail = async (input: {
  subject: string;
  text: string;
  html?: string;
  to: string;
}): Promise<void> => {
  const transporter = getMailTransporter();

  await transporter.sendMail({
    from: {
      address: env.GMAIL_EMAIL,
      name: env.MAIL_FROM_NAME,
    },
    headers: {
      "X-Auto-Response-Suppress": "OOF, AutoReply",
      "X-Entity-Ref-ID": `${Date.now()}`,
    },
    html: input.html ?? buildBasicHtmlEmail(input.text.split("\n")),
    priority: "high",
    replyTo: env.MAIL_REPLY_TO || env.GMAIL_EMAIL,
    subject: input.subject,
    text: input.text,
    to: input.to,
  });
};
