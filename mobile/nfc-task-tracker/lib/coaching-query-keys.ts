// Both share the invalidation prefix, but their result shapes must never share a cache entry.
export const coachingJobKeys = {
  list: (userId?: string) => ["coaching-jobs", userId ?? "", "list"] as const,
  details: (userId?: string) =>
    ["coaching-jobs", userId ?? "", "details"] as const,
};
