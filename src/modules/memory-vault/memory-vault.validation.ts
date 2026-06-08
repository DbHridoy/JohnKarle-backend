import { z } from "zod";

import { memoryVaultTypes } from "./memory-vault.types.js";

const isoDateSchema = z.coerce.date({
  error: "Date must be a valid date.",
});

const normalizeTags = (value: unknown): string[] => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];

  return rawValues.flatMap((entry) => {
    if (typeof entry !== "string") {
      return [];
    }

    const trimmed = entry.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;

        if (!Array.isArray(parsed)) {
          return [trimmed];
        }

        return parsed.map((item) => String(item).trim()).filter(Boolean);
      } catch {
        return [trimmed];
      }
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });
};

const tagsSchema = z.preprocess(normalizeTags, z.array(z.string().trim().min(1).max(40)).max(20));

const bodyBaseSchema = z.object({
  type: z.enum(memoryVaultTypes),
  whoseMemoryIsThis: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  narrative: z.string().trim().min(1).max(5000),
  date: isoDateSchema,
  tags: tagsSchema.default([]),
});

export const createMemoryVaultBodySchema = bodyBaseSchema.strict();

export const updateMemoryVaultBodySchema = bodyBaseSchema.partial().strict();

export const memoryVaultParamsSchema = z
  .object({
    memoryId: z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid memory id."),
  })
  .strict();

export type CreateMemoryVaultInput = z.infer<typeof createMemoryVaultBodySchema>;
export type UpdateMemoryVaultInput = z.infer<typeof updateMemoryVaultBodySchema>;
export type MemoryVaultParams = z.infer<typeof memoryVaultParamsSchema>;
