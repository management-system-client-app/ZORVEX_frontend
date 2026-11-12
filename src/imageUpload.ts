const MAX_IMAGE_EDGE = 1600;
const MAX_UPLOAD_IMAGE_BYTES = 550 * 1024;

export async function prepareImageForUpload(file: File): Promise<File> {
  const isAvif = file.type.toLowerCase() === "image/avif" || /\.avif$/i.test(file.name);
  if (!isAvif && file.size <= MAX_UPLOAD_IMAGE_BYTES) return file;

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This browser could not prepare the selected image. Please choose a JPEG, PNG, or WebP image.");
  });
  try {
    const canvas = document.createElement("canvas");
    const initialScale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the selected image for upload.");
    const outputType = isAvif
      ? "image/jpeg"
      : file.type.toLowerCase() === "image/png"
        ? "image/webp"
        : file.type.toLowerCase() === "image/webp"
          ? "image/webp"
          : "image/jpeg";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const dimensionScale = initialScale * 0.85 ** Math.floor(attempt / 2);
      canvas.width = Math.max(1, Math.round(bitmap.width * dimensionScale));
      canvas.height = Math.max(1, Math.round(bitmap.height * dimensionScale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.45, 0.82 - (attempt % 2) * 0.12 - Math.floor(attempt / 2) * 0.05);
      const converted = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the selected image for upload."))),
          outputType,
          quality,
        );
      });
      if (converted.type !== outputType) {
        throw new Error("This browser does not support the image format needed to reduce the upload size.");
      }
      if (converted.size <= MAX_UPLOAD_IMAGE_BYTES) {
        const extension = outputType === "image/webp" ? ".webp" : ".jpg";
        const name = file.name.replace(/\.[^.]+$/, extension);
        return new File([converted], name, {
          type: outputType,
          lastModified: file.lastModified,
        });
      }
    }
    throw new Error(`Could not reduce ${file.name} enough to upload. Please choose a smaller image.`);
  } finally {
    bitmap.close();
  }
}
