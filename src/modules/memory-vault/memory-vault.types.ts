export const memoryVaultTypes = ["photo", "video", "journal", "voice"] as const;

export type MemoryVaultType = (typeof memoryVaultTypes)[number];

export type MemoryVaultFile = {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type PublicMemoryVaultItem = {
  id: string;
  type: MemoryVaultType;
  whoseMemoryIsThis: string;
  files: MemoryVaultFile[];
  title: string;
  narrative: string;
  date: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type MemoryTimelineGroup = {
  date: string;
  memories: PublicMemoryVaultItem[];
};
