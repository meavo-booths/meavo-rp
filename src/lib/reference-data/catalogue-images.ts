export function getCatalogueDriveThumbnailUrl(fileId: string): string | null {
  const id = fileId.trim();
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w200`;
}
