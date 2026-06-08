import multer from "multer";
import type { RequestHandler } from "express";

import { ApiError } from "../../utils/api-error.util.js";

const maxFiles = 10;
const maxFileSizeBytes = 25 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeBytes,
    files: maxFiles,
  },
});

export const memoryVaultUpload: RequestHandler = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "files", maxCount: maxFiles },
]);

export const normalizeMemoryVaultPayload: RequestHandler = (req, _res, next) => {
  const tags = req.body.tag ?? req.body.tags;
  const narrative = req.body.narrative ?? req.body.description;
  const whoseMemoryIsThis = req.body.whoseMemoryIsThis ?? req.body.memoryOwner;

  req.body = {
    ...req.body,
    ...(tags === undefined ? {} : { tags }),
    ...(narrative === undefined ? {} : { narrative }),
    ...(whoseMemoryIsThis === undefined ? {} : { whoseMemoryIsThis }),
  };

  next();
};

export const extractMemoryVaultFiles = (req: Express.Request): Express.Multer.File[] => {
  const fieldMap = req.files;

  if (!fieldMap || Array.isArray(fieldMap)) {
    return fieldMap ?? [];
  }

  return [...(fieldMap.file ?? []), ...(fieldMap.files ?? [])];
};

export const ensureFilesAllowedForType = (
  type: string | undefined,
  files: Express.Multer.File[],
): void => {
  if (type === "journal") {
    return;
  }

  if (files.length === 0) {
    throw new ApiError(400, "At least one file is required for this memory type.", "FILE_REQUIRED");
  }
};
