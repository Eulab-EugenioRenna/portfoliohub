export type PreviewKind = 'image' | 'document' | 'media' | 'archive';

export function previewKind(mimeType: string, fileName = ''): PreviewKind | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'media';
  if (/pdf|officedocument|msword|opendocument|text\//.test(mimeType)) return 'document';
  if (/zip|tar|gzip|7z|rar/.test(mimeType) || /\.(zip|tar|gz|7z|rar)$/i.test(fileName))
    return 'archive';
  return null;
}
