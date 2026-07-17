// Shared constants for the production database schema.

// Photo statuses that are visible on the public site.
export const PUBLIC_PHOTO_STATUSES = ["live", "approved"];

// All photo statuses used in the admin workflow.
export const PHOTO_STATUSES = ["queued", "approved", "live", "hidden"] as const;

// AI pipeline statuses on photos.ai_status.
export const AI_STATUSES = ["pending", "processing", "done", "error"] as const;

export interface CelebRef {
  name: string;
  slug: string;
}
