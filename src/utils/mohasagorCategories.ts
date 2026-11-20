import type { Category, MohasagorProduct } from "../types";

const categoryRules = [
  { name: "T-Shirts", pattern: /\b(?:t[\s-]?shirts?|tshirt|tees?|polo)\b|টি[\s-]?শার্ট|টিশার্ট/i },
  { name: "Electronics & Gadgets", pattern: /\b(?:electronics?|gadget|bluetooth|usb|charger|charging|power bank|headphones?|earphones?|earbuds?|speaker|cable|adapter|mouse|keyboard|computer|laptop|mobile|phone|projector|smart watch|smartwatch|led light)\b|ইলেকট্রনিক|গ্যাজেট|চার্জার|হেডফোন|ইয়ারফোন|মোবাইল/i },
  { name: "Clothing & Fashion", pattern: /\b(?:shirt|hoodie|jacket|coat|pants?|trousers?|jeans|kurti|dress|saree|sari|hijab|borka|abaya|clothing|fashion|sweater|vest|fabric)\b|জামা|শার্ট|প্যান্ট|শাড়ি|শাড়ি|হিজাব|বোরকা|কাপড়|পোশাক/i },
  { name: "Home & Kitchen", pattern: /\b(?:home|lifestyle|kitchen|cooker|mixer|chopper|storage|rack|organizer|cleaning|furniture|lamp|juicer|pot|faucet|tissue box)\b|রান্নাঘর|কিচেন|র‍্যাক|স্টোরেজ/i },
  { name: "Beauty & Personal Care", pattern: /\b(?:beauty|personal care|skincare|skin care|makeup|cosmetic|perfume|attar|hair|shampoo|trimmer|grooming)\b|সৌন্দর্য|প্রসাধনী|আতর|পারফিউম/i },
  { name: "Bags & Accessories", pattern: /\b(?:bags?|accessories|wallet|sunglasses|belt|jewell?ery|chain|necklace|bracelet|watch|watches)\b|ব্যাগ|ওয়ালেট|চশমা|ঘড়ি/i },
  { name: "Toys & Kids", pattern: /\b(?:toys?|kids?|baby|child|children|doll)\b|খেলনা|শিশু|বেবি/i },
  { name: "Food & Grocery", pattern: /\b(?:food|grocery|snack|spice|oil|ghee|honey|tea|coffee)\b|খাবার|মসলা|মধু|চা|কফি/i },
] as const;

const categoryOrder = [...categoryRules.map((category) => category.name), "Other Products"];

function categoryForText(text: string): string {
  const searchable = text
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .toLowerCase();
  return categoryRules.find((rule) => rule.pattern.test(searchable))?.name ?? "Other Products";
}

export function groupMohasagorProducts(products: MohasagorProduct[], storeCategories: Category[] = []) {
  const sortedCategories = storeCategories
    .filter((category) => category.isActive !== false)
    .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0));
  const storeNamesByType = new Map<string, string>();
  for (const category of sortedCategories) {
    const type = categoryForText(category.name);
    if (type !== "Other Products" && !storeNamesByType.has(type)) {
      storeNamesByType.set(type, category.name);
    }
  }

  const groups = new Map<string, MohasagorProduct[]>();
  for (const product of products) {
    const apiCategory = product.category?.trim();
    const type = categoryForText(`${product.name} ${product.details ?? ""}`);
    const category = apiCategory || storeNamesByType.get(type) || type;
    const items = groups.get(category) ?? [];
    items.push(product);
    groups.set(category, items);
  }

  const orderedNames = [...new Set(categoryOrder.map((type) => storeNamesByType.get(type) ?? type))];
  return orderedNames.flatMap((category) => {
    const items = groups.get(category);
    return items?.length ? [{ category, products: items }] : [];
  });
}
