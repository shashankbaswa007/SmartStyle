export const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export const USAGE_LIMITS = {
  recommend: 10,
  wardrobeOutfit: 10,
  wardrobeUpload: 20,
} as const;

export const RATE_LIMIT_SCOPES = {
  recommend: 'recommend',
  wardrobeOutfit: 'wardrobe-outfit',
  wardrobeUpload: 'wardrobe-upload',
} as const;
