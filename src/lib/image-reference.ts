const MAX_IMAGE_EDGE = 1600;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function compressReferenceImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Format foto tidak didukung.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Ukuran foto maksimal 8 MB.");

  const source = await readFile(file);
  const image = await loadImage(source);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Foto tidak dapat diproses.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Foto tidak dapat dibuka."));
    image.src = src;
  });
}