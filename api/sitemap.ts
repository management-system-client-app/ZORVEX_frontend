type ApiResult<T> = {
  success?: boolean;
  data?: T;
  meta?: { totalPages?: number };
};

type ProductRecord = { id: string | number };
type CmsPageRecord = { slug: string; isActive?: boolean };

const SITE_URL = "https://www.bazargrid.com";
const API_URL = "https://zorvex-backend.vercel.app/api/v1";
const PAGE_SIZE = 100;
const PAGE_BATCH_SIZE = 8;

async function fetchData<T>(path: string): Promise<ApiResult<T>> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`API returned ${response.status} for ${path}`);
  const result = await response.json() as ApiResult<T>;
  if (result.success === false || !Array.isArray(result.data)) {
    throw new Error(`Unexpected API response for ${path}`);
  }
  return result;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

async function getAllProducts() {
  const first = await fetchData<ProductRecord[]>(`/products?status=ACTIVE&page=1&limit=${PAGE_SIZE}`);
  const products = [...(first.data ?? [])];
  const totalPages = Math.max(1, Number(first.meta?.totalPages) || 1);

  for (let start = 2; start <= totalPages; start += PAGE_BATCH_SIZE) {
    const count = Math.min(PAGE_BATCH_SIZE, totalPages - start + 1);
    const pages = await Promise.all(Array.from({ length: count }, (_, index) =>
      fetchData<ProductRecord[]>(`/products?status=ACTIVE&page=${start + index}&limit=${PAGE_SIZE}`),
    ));
    for (const page of pages) products.push(...(page.data ?? []));
  }
  return products;
}

export default async function sitemapHandler(_request: unknown, response: {
  setHeader(name: string, value: string): void;
  status(code: number): { send(body: string): void };
}) {
  try {
    const [pagesResponse, products] = await Promise.all([
      fetchData<CmsPageRecord[]>("/pages?limit=100"),
      getAllProducts(),
    ]);

    const urls = new Set([
      `${SITE_URL}/`,
      `${SITE_URL}/shop`,
      `${SITE_URL}/women`,
      `${SITE_URL}/mohasagor`,
      `${SITE_URL}/outlets`,
    ]);
    for (const page of pagesResponse.data ?? []) {
      if (page.isActive !== false && typeof page.slug === "string" && page.slug.trim()) {
        urls.add(`${SITE_URL}/pages/${encodeURIComponent(page.slug.trim())}`);
      }
    }
    for (const product of products) {
      if (product.id !== undefined && product.id !== null) {
        urls.add(`${SITE_URL}/product/${encodeURIComponent(String(product.id))}`);
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      [...urls].map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")
    }\n</urlset>\n`;

    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    response.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap generation failed", error);
    response.setHeader("Content-Type", "application/xml; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.status(502).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Sitemap is temporarily unavailable</error>");
  }
}
