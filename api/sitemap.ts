type SitemapProduct = { id: string | number; status?: string };
type SitemapPage = { slug: string; isActive?: boolean };
type ApiEnvelope<T> = { data?: T; meta?: { totalPages?: number } };

const siteUrl = "https://www.bazargrid.com";
const apiUrl = (process.env.VITE_API_URL || "https://zorvex-backend.vercel.app/api/v1")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/i, "") + "/api/v1";

async function getData<T>(path: string): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Sitemap source failed (${response.status}): ${path}`);
  return response.json() as Promise<ApiEnvelope<T>>;
}

function xmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export default async function handler(_request: unknown, response: {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
  send(body: string): void;
}) {
  try {
    const pageResult = await getData<SitemapPage[]>("/pages?limit=100");
    const urls = new Set([
      `${siteUrl}/`,
      `${siteUrl}/shop`,
      `${siteUrl}/women`,
      `${siteUrl}/mohasagor`,
      `${siteUrl}/outlets`,
    ]);

    for (const page of pageResult.data ?? []) {
      if (page.isActive !== false && page.slug) urls.add(`${siteUrl}/pages/${encodeURIComponent(page.slug)}`);
    }

    const first = await getData<SitemapProduct[]>("/products?status=ACTIVE&page=1&limit=100");
    const products = [...(first.data ?? [])];
    const pageCount = Math.min(Math.max(first.meta?.totalPages ?? 1, 1), 200);
    if (pageCount > 1) {
      const remaining = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) =>
        getData<SitemapProduct[]>(`/products?status=ACTIVE&page=${index + 2}&limit=100`),
      ));
      for (const page of remaining) products.push(...(page.data ?? []));
    }
    for (const product of products) {
      if (product.id !== undefined && product.id !== null) urls.add(`${siteUrl}/product/${encodeURIComponent(String(product.id))}`);
    }

    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      [...urls].map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`).join("\n")
    }\n</urlset>`;
    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).send(body);
  } catch (error) {
    console.error("Could not generate sitemap", error);
    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.status(502).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Sitemap generation failed</error>");
  }
}
