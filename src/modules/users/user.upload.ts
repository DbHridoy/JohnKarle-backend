import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { RequestHandler } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import type { UserProfilePicture } from "./user.types.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (s3Client) {
    return s3Client;
  }

  if (
    !env.AWS_REGION ||
    !env.S3_BUCKET_NAME ||
    !env.AWS_ACCESS_KEY_ID ||
    !env.AWS_SECRET_ACCESS_KEY
  ) {
    throw new ApiError(500, "S3 credentials are not configured.", "S3_CONFIGURATION_ERROR");
  }

  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
};

const buildObjectUrl = (key: string): string =>
  `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

export const userProfileUpload: RequestHandler = upload.single("profilePicture");

export const uploadProfilePicture = async (
  userId: string,
  file: Express.Multer.File,
): Promise<UserProfilePicture> => {
  const client = getS3Client();
  const extension = file.originalname.includes(".")
    ? file.originalname.slice(file.originalname.lastIndexOf("."))
    : "";
  const key = `users/${userId}/profile/${Date.now()}-${randomUUID()}${extension}`;

  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  return {
    key,
    url: buildObjectUrl(key),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
};

export const deleteProfilePicture = async (profilePicture?: UserProfilePicture): Promise<void> => {
  if (!profilePicture) {
    return;
  }

  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: profilePicture.key,
    }),
  );
};
