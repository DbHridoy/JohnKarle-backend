import type { MemoryVaultDocument } from "./memory-vault.model.js";
import type { PublicMemoryVaultItem } from "./memory-vault.types.js";

export const toPublicMemoryVaultItem = (memory: MemoryVaultDocument): PublicMemoryVaultItem => ({
  id: memory._id.toString(),
  type: memory.type,
  whoseMemoryIsThis: memory.whoseMemoryIsThis,
  files: memory.files,
  title: memory.title,
  narrative: memory.narrative,
  date: memory.date.toISOString(),
  tags: memory.tags,
  createdAt: memory.createdAt.toISOString(),
  updatedAt: memory.updatedAt.toISOString(),
});
