const NEW_WINDOW = 30 * 24 * 60 * 60 * 1000;

export function money(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  const digits = Number.isInteger(amount) ? 0 : 2;
  return `৳${amount.toLocaleString("en-BD", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function productFlags(product: {
  basePrice: string | number;
  compareAtPrice?: string | number | null;
  createdAt?: string;
  onSale?: boolean;
  isNew?: boolean;
}) {
  const price = Number(product.basePrice);
  const compare =
    product.compareAtPrice == null || product.compareAtPrice === ""
      ? null
      : Number(product.compareAtPrice);
  const onSale = product.onSale ?? (compare != null && compare > price);
  const created = product.createdAt ? new Date(product.createdAt).getTime() : Number.NaN;
  const isNew =
    product.isNew ?? (Number.isFinite(created) && Date.now() - created < NEW_WINDOW);
  return { price, compare: onSale ? compare : null, onSale, isNew };
}

export function coverImage(product: {
  images?: { url: string; isPrimary?: boolean }[];
  imageUrl?: string | null;
}): string | null {
  if (product.imageUrl) return product.imageUrl;
  const images = product.images ?? [];
  return images.find((image) => image.isPrimary)?.url ?? images[0]?.url ?? null;
}

export function titleCaseStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
