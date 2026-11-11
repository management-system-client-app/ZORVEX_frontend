export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.type.toLowerCase() !== "image/avif" && !/\.avif$/i.test(file.name)) return file;

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This browser could not read the AVIF image. Please choose a JPEG, PNG, or WebP image.");
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the AVIF image for upload.");
    context.drawImage(bitmap, 0, 0);
    const converted = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not convert the AVIF image for upload."))),
        "image/jpeg",
        0.92,
      );
    });
    const name = /\.avif$/i.test(file.name) ? file.name.replace(/\.avif$/i, ".jpg") : `${file.name}.jpg`;
    return new File([converted], name, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
