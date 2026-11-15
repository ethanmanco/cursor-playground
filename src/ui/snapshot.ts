/**
 * Save a PNG of the current scene: the starry sky, the background layer, and
 * the front layer, at full screen resolution.
 */
export async function savePicture(layers: HTMLCanvasElement[], filename = 'cursor-playground.png'): Promise<boolean> {
  const [first] = layers;
  if (!first) return false;
  const out = document.createElement('canvas');
  out.width = first.width;
  out.height = first.height;
  const ctx = out.getContext('2d');
  if (!ctx) return false;
  for (const layer of layers) ctx.drawImage(layer, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
