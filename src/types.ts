export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Settings = {
  storeName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  address: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  bkashNumber: string | null;
  nagadNumber: string | null;
  rocketNumber: string | null;
  collageManImageUrl: string | null;
  collageWomanImageUrl: string | null;
  collageChildImageUrl: string | null;
  collageAccessoriesImageUrl: string | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl?: string | null;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type AdminHomeBlock = {
  id: string;
  kind: "BANNER" | "CAMPAIGN" | "GADGET_FESTIVE" | "NEW_ARRIVAL" | "TRENDING";
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  productIds: string[];
  linkUrl: string | null;
  categoryId: string | null;
  sortOrder: number;
  isActive: boolean;
  category?: { id: string; name: string; slug: string } | null;
  products?: ProductCardData[];
};

export type Brand = { id: string; name: string; slug: string };
export type Size = { id: string; name: string; slug: string; sortOrder?: number };
export type Fabric = { id: string; name: string; slug: string; composition?: string | null };
export type Color = { id: string; name: string; slug: string; hexCode: string };

export type Catalog = {
  brands: Brand[];
  categories: Category[];
  sizes: Size[];
  colors: Color[];
  fabrics: Fabric[];
};

export type ProductImage = {
  id?: string;
  url: string;
  alt?: string | null;
  isPrimary?: boolean;
  colorId?: string | null;
  sortOrder?: number;
};

export type ProductCardData = {
  id: string;
  name: string;
  slug?: string;
  basePrice: string | number;
  compareAtPrice?: string | number | null;
  createdAt?: string;
  onSale?: boolean;
  isNew?: boolean;
  images?: ProductImage[];
  imageUrl?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  brand?: { id: string; name: string; slug: string } | null;
  variants?: {
    stock: number;
    reserved?: number;
    isActive?: boolean;
    optionLabel?: string | null;
    color?: { id: string; name: string; hexCode: string } | null;
  }[];
};

export type Variant = {
  id: string;
  sku: string;
  price: string | number | null;
  stock: number;
  reserved?: number;
  isActive?: boolean;
  optionLabel?: string | null;
  size: Size | null;
  color: Color | null;
  fabric: Fabric | null;
};

export type ProductDetail = Omit<ProductCardData, "variants"> & {
  description: string;
  gender: string;
  fit: string | null;
  careInstructions: string | null;
  status: string;
  category: { id: string; name: string; slug: string; parentId?: string | null };
  brand: { id: string; name: string; slug: string; logoUrl?: string | null };
  images: ProductImage[];
  variants: Variant[];
  commissionPerUnit?: string | number;
};

export type HomeBlock = {
  id: string;
  kind: "BANNER" | "CAMPAIGN" | "GADGET_FESTIVE" | "NEW_ARRIVAL" | "TRENDING";
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  categoryId: string | null;
  category?: { id: string; name: string; slug: string } | null;
  products?: ProductCardData[];
};

export type HomePayload = {
  banners: HomeBlock[];
  campaigns: HomeBlock[];
  gadgetBanners?: HomeBlock[];
  newArrivals: HomeBlock[];
  trendingProducts: ProductCardData[];
};

export type CartLine = {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string | null;
  availableQuantity: number;
  variant: {
    id: string;
    sku: string;
    optionLabel?: string | null;
    isActive: boolean;
    size: { id: string; name: string } | null;
    color: { id: string; name: string; hexCode: string } | null;
    fabric: { id: string; name: string } | null;
    product: { id: string; name: string; slug: string; status: string };
  };
};

export type Cart = {
  id: string | null;
  sessionId: string | null;
  paymentMethod: "COD" | "STRIPE" | "BKASH" | "NAGAD" | "ROCKET" | null;
  items: CartLine[];
  summary: { itemCount: number; subtotal: number };
};

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl?: string | null;
  accountType?: "USER" | "ADMIN";
  adminRole?: "SUPER_ADMIN" | "MANAGER" | "SUPPORT";
};

export type StaffAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whatsappNumber: string | null;
  commissionDue?: number;
  commissionPaid?: number;
  role: "SUPPORT";
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffReferral = {
  id: string;
  firstName: string;
  lastName: string;
  whatsappNumber: string | null;
};

export type SavedAddress = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

export type DashboardOverview = {
  totalRevenue: number;
  currency: string;
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  activeUsers: number;
};

export type AdminOrderItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  lineTotal: string | number;
  commissionPerUnit: string | number;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string | number;
  discountAmount: string | number;
  shippingAmount: string | number;
  total: string | number;
  currency: string;
  placedAt: string;
  guestEmail: string | null;
  referredByStaff: { id: string; firstName: string; lastName: string } | null;
  staffCommissionPaidAt: string | null;
  shippingFullName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingCity: string;
  shippingState: string | null;
  shippingPostalCode: string;
  shippingCountry: string;
  customerNote: string | null;
  cancelReason: string | null;
  paymentMethod?: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
  items: AdminOrderItem[];
  payments?: {
    id: string;
    provider: string;
    status: string;
    method: string | null;
    amount: string | number;
    paidAt: string | null;
  }[];
};

export type Promotion = {
  id: string;
  name: string;
  description: string | null;
  type?: string;
  value?: string | number;
  scope?: string;
  isActive?: boolean;
};

export type Review = {
  id: string;
  rating: number;
  title: string | null;
  comment: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string };
};

export type SizeGuide = {
  id: string;
  title: string;
  columns: string[];
  rows: string[][];
  categoryId: string;
};

export type Outlet = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  hours: string | null;
  mapUrl: string | null;
};

export type CmsPage = {
  id?: string;
  slug: string;
  title: string;
  body?: string;
  isActive?: boolean;
};

export type Coupon = {
  id: string;
  code: string;
  type: string;
  value: string | number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

export type CouponQuote = {
  code: string;
  discount: string | number;
  total: string | number;
};

export type DeliveryZone = {
  id: string;
  name: string;
  city: string | null;
  fee: string | number;
  freeShippingOver: string | number | null;
  isActive: boolean;
  sortOrder: number;
};

export type Subscriber = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
};

export type StoreReturn = {
  id: string;
  status: string;
  type: string;
  reason: string;
  note?: string | null;
  adminNote?: string | null;
  returnNumber?: string;
  refundAmount?: string | number | null;
  orderId?: string;
  order?: { orderNumber: string; status?: string };
  user?: { firstName: string; lastName: string; email: string };
  items?: { id: string; quantity: number; orderItem?: { productName: string } }[];
};

export type ManualPayment = {
  id: string;
  status: string;
  provider: string;
  transactionId: string | null;
  amount: string | number;
  order?: { id: string; orderNumber: string };
};

export type VariantRow = {
  id: string;
  sku: string;
  stock: number;
  price: string | number | null;
  isActive: boolean;
  productId: string;
  sizeId: string | null;
  fabricId: string | null;
  colorId: string | null;
  optionLabel?: string | null;
};

export type OrderResult = {
  id: string;
  orderNumber: string;
  total: string | number;
  subtotal?: string | number;
  discountAmount?: string | number;
  shippingAmount?: string | number;
  currency?: string;
  status: string;
  paymentMethod: string;
  checkoutUrl: string | null;
  payTo: string | null;
  codAdvance?: {
    method: "STRIPE" | "BKASH" | "NAGAD" | "ROCKET";
    amount: string | number;
    remainingAmount: string | number;
    status: string;
    payTo: string | null;
    checkoutUrl?: string | null;
  } | null;
  emailed?: boolean;
  placedAt?: string;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingLine1?: string;
  shippingCity?: string;
  shippingDivision?: string;
  shippingDistrict?: string;
  shippingThana?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  items?: {
    id: string;
    productName: string;
    quantity: number;
    lineTotal: string | number;
    size?: string;
    color?: string;
  }[];
};

export type TrackedOrder = {
  orderNumber: string;
  status: string;
  currency: string;
  total: string | number;
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: {
    productName: string;
    sku: string;
    size: string;
    color: string;
    fabric: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: string | number;
    lineTotal: string | number;
  }[];
};
