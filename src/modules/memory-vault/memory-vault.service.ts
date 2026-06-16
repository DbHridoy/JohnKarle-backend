import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

import { env } from "../../config/env.config.js";
import { ApiError } from "../../utils/api-error.util.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { areAcceptedFamilyMembers } from "../users/user-family-membership.service.js";
import { MemoryVaultModel, type MemoryVaultDocument } from "./memory-vault.model.js";
import { toPublicMemoryVaultItem } from "./memory-vault.presenter.js";
import type { MemoryTimelineGroup, MemoryVaultFile } from "./memory-vault.types.js";
import type {
  CreateMemoryVaultInput,
  MemoryVaultParams,
  MemoryVaultQuery,
  UpdateMemoryVaultInput,
} from "./memory-vault.validation.js";

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

const uploadFilesToS3 = async (
  userId: string,
  files: Express.Multer.File[],
): Promise<MemoryVaultFile[]> => {
  const client = getS3Client();

  return Promise.all(
    files.map(async (file) => {
      const extension = file.originalname.includes(".")
        ? file.originalname.slice(file.originalname.lastIndexOf("."))
        : "";
      const key = `memory-vault/${userId}/${Date.now()}-${randomUUID()}${extension}`;

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
    }),
  );
};

const deleteFilesFromS3 = async (files: MemoryVaultFile[]): Promise<void> => {
  if (files.length === 0) {
    return;
  }

  const client = getS3Client();

  await client.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET_NAME,
      Delete: {
        Objects: files.map((file) => ({ Key: file.key })),
        Quiet: true,
      },
    }),
  );
};

const findOwnedMemoryOrThrow = async (
  userId: string,
  memoryId: string,
): Promise<MemoryVaultDocument> => {
  const memory = await MemoryVaultModel.findOne({
    _id: memoryId,
    userId,
  }).exec();

  if (!memory) {
    throw new ApiError(404, "Memory vault item not found.", "MEMORY_VAULT_NOT_FOUND");
  }

  return memory;
};

const findReadableMemoryOrThrow = async (
  authenticatedUser: AuthenticatedUser,
  memoryId: string,
): Promise<MemoryVaultDocument> => {
  const memory = await MemoryVaultModel.findById(memoryId).exec();

  if (!memory) {
    throw new ApiError(404, "Memory vault item not found.", "MEMORY_VAULT_NOT_FOUND");
  }

  if (memory.userId.toString() === authenticatedUser.id) {
    return memory;
  }

  const isFamilyMember = await areAcceptedFamilyMembers(
    authenticatedUser.id,
    memory.userId.toString(),
  );

  if (!isFamilyMember) {
    throw new ApiError(
      403,
      "You do not have permission to view this family member's memories.",
      "FORBIDDEN",
    );
  }

  return memory;
};

const ensureMemoryHasRequiredFiles = (type: string, fileCount: number): void => {
  if (type !== "journal" && fileCount === 0) {
    throw new ApiError(400, "At least one file is required for this memory type.", "FILE_REQUIRED");
  }
};

const resolveReadableUserId = async (
  authenticatedUser: AuthenticatedUser,
  query?: MemoryVaultQuery,
): Promise<string> => {
  const familyMemberUserId = query?.familyMemberUserId;

  if (!familyMemberUserId || familyMemberUserId === authenticatedUser.id) {
    return authenticatedUser.id;
  }

  const isFamilyMember = await areAcceptedFamilyMembers(authenticatedUser.id, familyMemberUserId);

  if (!isFamilyMember) {
    throw new ApiError(
      403,
      "You do not have permission to view this family member's memories.",
      "FORBIDDEN",
    );
  }

  return familyMemberUserId;
};

export const createMemory = async (
  user: AuthenticatedUser,
  input: CreateMemoryVaultInput,
  files: Express.Multer.File[],
) => {
  let uploadedFiles: MemoryVaultFile[] = [];

  try {
    uploadedFiles = await uploadFilesToS3(user.id, files);
    ensureMemoryHasRequiredFiles(input.type, uploadedFiles.length);

    const memory = await MemoryVaultModel.create({
      userId: user.id,
      type: input.type,
      whoseMemoryIsThis: input.whoseMemoryIsThis,
      files: uploadedFiles,
      title: input.title,
      narrative: input.narrative,
      date: input.date,
      tags: input.tags,
    });

    await createAuditLog({
      userId: user.id,
      actorId: user.id,
      actorType: "user",
      action: "memory_created",
      metadata: {
        memoryType: memory.type,
        title: memory.title,
        fileCount: memory.files.length,
      },
      targetType: "memory",
      targetId: memory._id.toString(),
      targetLabel: memory.title,
    });

    return toPublicMemoryVaultItem(memory);
  } catch (error) {
    await deleteFilesFromS3(uploadedFiles).catch(() => undefined);
    throw error;
  }
};

export const listMemories = async (user: AuthenticatedUser, query?: MemoryVaultQuery) => {
  const readableUserId = await resolveReadableUserId(user, query);
  const memories = await MemoryVaultModel.find({ userId: readableUserId })
    .sort({ date: -1, createdAt: -1 })
    .exec();

  return memories.map(toPublicMemoryVaultItem);
};

export const getTimeline = async (
  user: AuthenticatedUser,
  query?: MemoryVaultQuery,
): Promise<MemoryTimelineGroup[]> => {
  const memories = await listMemories(user, query);
  const timeline = new Map<string, MemoryTimelineGroup>();

  for (const memory of memories) {
    const dateKey = memory.date.slice(0, 10);
    const existingGroup = timeline.get(dateKey);

    if (existingGroup) {
      existingGroup.memories.push(memory);
      continue;
    }

    timeline.set(dateKey, {
      date: dateKey,
      memories: [memory],
    });
  }

  return [...timeline.values()];
};

export const getMemory = async (user: AuthenticatedUser, params: MemoryVaultParams) => {
  const memory = await findReadableMemoryOrThrow(user, params.memoryId);

  return toPublicMemoryVaultItem(memory);
};

export const updateMemory = async (
  user: AuthenticatedUser,
  params: MemoryVaultParams,
  input: UpdateMemoryVaultInput,
  files: Express.Multer.File[],
) => {
  const memory = await findOwnedMemoryOrThrow(user.id, params.memoryId);
  const previousFiles = memory.files;
  let uploadedFiles: MemoryVaultFile[] = [];

  try {
    if (files.length > 0) {
      uploadedFiles = await uploadFilesToS3(user.id, files);
      memory.files = uploadedFiles;
    }

    if (input.type !== undefined) {
      memory.type = input.type;
    }

    if (input.whoseMemoryIsThis !== undefined) {
      memory.whoseMemoryIsThis = input.whoseMemoryIsThis;
    }

    if (input.title !== undefined) {
      memory.title = input.title;
    }

    if (input.narrative !== undefined) {
      memory.narrative = input.narrative;
    }

    if (input.date !== undefined) {
      memory.date = input.date;
    }

    if (input.tags !== undefined) {
      memory.tags = input.tags;
    }

    ensureMemoryHasRequiredFiles(memory.type, memory.files.length);

    await memory.save();

    await createAuditLog({
      userId: user.id,
      actorId: user.id,
      actorType: "user",
      action: "memory_updated",
      metadata: {
        memoryType: memory.type,
        title: memory.title,
        fileCount: memory.files.length,
      },
      targetType: "memory",
      targetId: memory._id.toString(),
      targetLabel: memory.title,
    });

    if (files.length > 0) {
      await deleteFilesFromS3(previousFiles).catch(() => undefined);
    }

    return toPublicMemoryVaultItem(memory);
  } catch (error) {
    await deleteFilesFromS3(uploadedFiles).catch(() => undefined);
    throw error;
  }
};

export const deleteMemory = async (user: AuthenticatedUser, params: MemoryVaultParams) => {
  const memory = await findOwnedMemoryOrThrow(user.id, params.memoryId);

  await MemoryVaultModel.deleteOne({ _id: memory._id }).exec();
  await deleteFilesFromS3(memory.files).catch(() => undefined);
  await createAuditLog({
    userId: user.id,
    actorId: user.id,
    actorType: "user",
    action: "memory_deleted",
    metadata: {
      memoryType: memory.type,
      title: memory.title,
      fileCount: memory.files.length,
    },
    targetType: "memory",
    targetId: memory._id.toString(),
    targetLabel: memory.title,
  });
};
