export function imagePreviewSrc(id: string) {
  return `/api/images/${encodeURIComponent(id)}/download?inline=1`;
}
