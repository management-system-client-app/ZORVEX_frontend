import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteUrl = "https://www.bazargrid.com";
const configuredApi = (process.env.VITE_API_URL || "https://zorvex-backend.vercel.app/api/v1")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/i, "")
  .replace(/\/api$/i, "");
const apiUrl = `${configuredApi}/api/v1`;

async function getData(path) {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`API request failed (${response.status}): ${path}`);
  const result = await response.json();
  if (result.success === false || !Array.isArray(result.data)) {
    throw new Error(`Unexpected API response: ${path}`);
  }
  return result;
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

const urls = new Set([
  `${siteUrl}/`,
  `${siteUrl}/shop`,
  `${siteUrl}/women`,
  `${siteUrl}/mohasagor`,
  `${siteUrl}/outlets`,
]);

const pages = await getData("/pages?limit=100");
for (const page of pages.data) {
  if (page.isActive !== false && typeof page.slug === "string" && page.slug.trim()) {
    urls.add(`${siteUrl}/pages/${encodeURIComponent(page.slug.trim())}`);
  }
}

const first = await getData("/products?status=ACTIVE&page=1&limit=100");
const products = [...first.data];
const totalPages = Math.max(1, Number(first.meta?.totalPages) || 1);
for (let start = 2; start <= totalPages; start += 5) {
  const batch = await Promise.all(Array.from({ length: Math.min(5, totalPages - start + 1) }, (_, index) =>
    getData(`/products?status=ACTIVE&page=${start + index}&limit=100`),
  ));
  for (const page of batch) products.push(...page.data);
}

for (const product of products) {
  if (product.id !== undefined && product.id !== null) {
    urls.add(`${siteUrl}/product/${encodeURIComponent(String(product.id))}`);
  }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  [...urls].map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")
}\n</urlset>\n`;
const output = resolve("public/sitemap.xml");
await mkdir(resolve("public"), { recursive: true });
await writeFile(output, sitemap, "utf8");
console.log(`Generated sitemap with ${urls.size} URLs at ${output}`);
