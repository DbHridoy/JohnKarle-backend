import { z } from "zod";

export const legacyAccessRequestIdParamsSchema = z
  .object({
    requestId: z.string().trim().min(1),
  })
  .strict();

export const legacyAccessSettingsBodySchema = z
  .object({
    legacyAccessEnabled: z.boolean(),
    currentPassword: z.string().min(1).max(128),
  })
  .strict();

export type LegacyAccessRequestIdParams = z.infer<typeof legacyAccessRequestIdParamsSchema>;
export type LegacyAccessSettingsInput = z.infer<typeof legacyAccessSettingsBodySchema>;
