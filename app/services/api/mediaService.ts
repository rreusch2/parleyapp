import { supabase } from './supabaseClient';
import type { MediaItem } from '../../components/MediaGallery';

const BUCKET = 'media';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm'];

function stripExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.substring(0, idx) : name;
}

function baseName(path: string): string {
  const parts = path.split('/');
  const name = parts[parts.length - 1] || path;
  return stripExt(name).toLowerCase();
}

function getExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.substring(idx).toLowerCase() : '';
}

function isImage(name: string) {
  const ext = getExt(name);
  return IMAGE_EXTENSIONS.includes(ext);
}

function isVideo(name: string) {
  const ext = getExt(name);
  return VIDEO_EXTENSIONS.includes(ext);
}

function publicUrl(path: string): string | null {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export async function listMedia(): Promise<MediaItem[]> {
  // Preferred folder order for thumbnails
  const prefixes = ['', 'images', 'images/thumbnails', 'thumbnails', 'videos'];

  // Collect raw entries first
  const imageEntries: { path: string; url: string; base: string }[] = [];
  const videoEntries: { path: string; url: string; name: string; base: string }[] = [];

  for (const prefix of prefixes) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix || undefined, {
      limit: 100,
      offset: 0,
    });

    if (error) {
      console.warn('mediaService.listMedia list error', prefix, error.message);
      continue;
    }

    if (!data) continue;

    for (const obj of data) {
      if (!obj.metadata) continue; // skip folders
      const name = obj.name;
      const path = prefix ? `${prefix}/${name}` : name;
      const url = publicUrl(path);
      if (!url) continue;

      if (isImage(name)) {
        imageEntries.push({ path, url, base: baseName(path) });
      } else if (isVideo(name)) {
        videoEntries.push({ path, url, name, base: baseName(path) });
      }
    }
  }

  // Build lookup maps for thumbnails by folder preference
  const imageMaps: Record<string, Map<string, string>> = {
    'videos': new Map(),
    'images/thumbnails': new Map(),
    'thumbnails': new Map(),
    'images': new Map(),
    'root': new Map(),
  };

  for (const img of imageEntries) {
    if (img.path.startsWith('videos/')) imageMaps['videos'].set(img.base, img.url);
    else if (img.path.startsWith('images/thumbnails/')) imageMaps['images/thumbnails'].set(img.base, img.url);
    else if (img.path.startsWith('thumbnails/')) imageMaps['thumbnails'].set(img.base, img.url);
    else if (img.path.startsWith('images/')) imageMaps['images'].set(img.base, img.url);
    else imageMaps['root'].set(img.base, img.url);
  }

  const placeholderThumb = 'https://images.unsplash.com/photo-1542332213-9b6f1b4a5efa?q=80&w=1200&auto=format&fit=crop';

  const results: MediaItem[] = [];

  // Add images directly to results
  for (const img of imageEntries) {
    results.push({
      id: `img-${img.path}`,
      type: 'image',
      title: img.path.split('/').pop() || img.path,
      thumbnail: img.url,
      source: img.url,
    });
  }

  // Add videos with thumbnail resolution
  for (const vid of videoEntries) {
    const thumbUrl =
      imageMaps['videos'].get(vid.base) ||
      imageMaps['images/thumbnails'].get(vid.base) ||
      imageMaps['thumbnails'].get(vid.base) ||
      imageMaps['images'].get(vid.base) ||
      imageMaps['root'].get(vid.base) ||
      placeholderThumb;

    results.push({
      id: `vid-${vid.path}`,
      type: 'video',
      title: vid.name,
      thumbnail: thumbUrl,
      source: vid.url,
    });
  }

  // Stable sort by title
  results.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return results;
}
