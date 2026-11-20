/** Request appropriately sized modern-format delivery for existing Cloudinary uploads. */
export function optimizeCloudinaryImage(url: string, width: number): string {
  if (!url) return url;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("cloudinary.com") || !parsed.pathname.includes("/image/upload/")) {
      return url;
    }

    const match = parsed.pathname.match(/^(.*\/image\/upload\/)(.*)$/);
    if (!match) return url;

    const [, prefix, remainder] = match;
    const segments = remainder.split("/");
    const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
    if (versionIndex > 0) return url; // An explicit transformation is already present.

    const transformation = `f_auto,q_auto,c_limit,w_${Math.max(1, Math.round(width))}`;
    parsed.pathname = `${prefix}${transformation}/${remainder}`;
    return parsed.toString();
  } catch {
    return url;
  }
}
