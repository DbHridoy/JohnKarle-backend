import type { RequestHandler } from "express";
import multer from "multer";

import { ApiError } from "../../utils/api-error.util.js";

const maxAttachments = 5;
const maxFileSizeBytes = 5 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const isAllowedMimeType = (mimeType: string): boolean =>
  mimeType.startsWith("image/") || allowedMimeTypes.has(mimeType);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeBytes,
    files: maxAttachments,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedMimeType(file.mimetype)) {
      callback(new ApiError(400, "Unsupported attachment type.", "UNSUPPORTED_FILE_TYPE"));
      return;
    }

    callback(null, true);
  },
});

export const reportFeedbackUpload: RequestHandler = upload.fields([
  { name: "attachments", maxCount: maxAttachments },
  { name: "attachments[]", maxCount: maxAttachments },
]);

export const extractReportFeedbackFiles = (req: Express.Request): Express.Multer.File[] => {
  const fieldMap = req.files;

  if (!fieldMap || Array.isArray(fieldMap)) {
    return fieldMap ?? [];
  }

  return [...(fieldMap.attachments ?? []), ...(fieldMap["attachments[]"] ?? [])];
};
