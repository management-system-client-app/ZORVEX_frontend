const NEW_WINDOW = 30 * 24 * 60 * 60 * 1000;

const BANGLA_SLUG_CHARACTERS: Record<string, string> = {
  "অ": "o", "আ": "a", "ই": "i", "ঈ": "i", "উ": "u", "ঊ": "u", "ঋ": "ri", "এ": "e", "ঐ": "oi", "ও": "o", "ঔ": "ou",
  "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng", "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "ny",
  "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n", "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
  "প": "p", "ফ": "f", "ব": "b", "ভ": "bh", "ম": "m", "য": "j", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh",
  "স": "s", "হ": "h", "ড়": "r", "ঢ়": "rh", "য়": "y", "ৎ": "t",
  "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri", "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
  "ং": "ng", "ঃ": "h", "ঁ": "n", "্": "", "ৢ": "li", "ৣ": "li",
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
};

export function slugifyProductName(value: string): string {
  return Array.from(value.normalize("NFC").replace(/য়/g, "y"))
    .map((character) => BANGLA_SLUG_CHARACTERS[character] ?? (/[a-z0-9]/i.test(character) ? character : " "))
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
  price?: string | number | null;
  compareAtPrice?: string | number | null;
  createdAt?: string;
  onSale?: boolean;
  isNew?: boolean;
}) {
  const price = Number(product.price ?? product.basePrice);
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

export function extractSupplierSizes(description?: string | null): string[] {
  if (!description) return [];
  const groups = [
    description.match(/(?:^|\n)Supplier options:\s*([^\n]+)/i)?.[1] ?? "",
    ...[...description.matchAll(/(?:available\s+sizes?|sizes?\s+available|choose\s+sizes?|select\s+sizes?|সাইজ[^:\n]{0,60})\s*[:：]\s*\(?([^\n).]{1,80})\)?/gi)]
      .map((match) => match[1] ?? ""),
  ].filter(Boolean);
  return [...new Set(groups.flatMap((options) => options.split("|").flatMap((group) => {
    const separator = group.indexOf(":");
    const values = separator >= 0 && /^(?:size|age)$/i.test(group.slice(0, separator).trim())
      ? group.slice(separator + 1)
      : group;
    return values.split(/[,/;]+/)
      .map((value) => value.trim().replace(/[()\s]+$/g, ""))
      .filter((value) => /^(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|free\s*size|one\s*size|\d{1,3}(?:\s*(?:cm|mm|in|inch))?)$/i.test(value));
  })))];
}

export function productThumbnailUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = "/image/upload/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0 || !value.includes("res.cloudinary.com")) return value;

  const prefix = value.slice(0, markerIndex + marker.length);
  const path = value.slice(markerIndex + marker.length).split("/");
  const firstSegment = path[0] ?? "";
  if (firstSegment.split(",").some((part) => /^(?:a|b|c|dpr|e|f|fl|g|h|q|r|w|x|y|z)_/.test(part))) {
    path.shift();
  }
  return `${prefix}c_limit,w_640,h_800,f_auto,q_auto/${path.join("/")}`;
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
