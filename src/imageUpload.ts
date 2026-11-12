const MAX_IMAGE_EDGE = 1920;
const MAX_UNPROCESSED_IMAGE_BYTES = 2 * 1024 * 1024;

export async function prepareImageForUpload(file: File): Promise<File> {
  const isAvif = file.type.toLowerCase() === "image/avif" || /\.avif$/i.test(file.name);
  if (!isAvif && file.size <= MAX_UNPROCESSED_IMAGE_BYTES) return file;

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This browser could not prepare the selected image. Please choose a JPEG, PNG, or WebP image.");
  });
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the selected image for upload.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const outputType = isAvif
      ? "image/jpeg"
      : file.type.toLowerCase() === "image/png"
        ? "image/png"
        : file.type.toLowerCase() === "image/webp"
          ? "image/webp"
          : "image/jpeg";
    const converted = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the selected image for upload."))),
        outputType,
        0.82,
      );
    });
    const name = isAvif
      ? file.name.replace(/\.avif$/i, ".jpg")
      : file.name.replace(/\.[^.]+$/, outputType === "image/png" ? ".png" : outputType === "image/webp" ? ".webp" : ".jpg");
    return new File([converted], name, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
