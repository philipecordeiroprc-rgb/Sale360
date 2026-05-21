import { Metadata } from 'next';
import CatalogPageClient from './CatalogPageClient';

// Server-side fetch uses internal API directly (Node fetch requires absolute URL)
const INTERNAL_API = process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001';

interface CatalogData {
  store: {
    name: string;
    phone: string | null;
    document: string | null;
    companyName: string | null;
    primaryColor: string;
    displayMode: string;
    outOfStockBehavior: string;
    logoPath: string | null;
    acceptOrders: boolean;
    postOrderMessage: string | null;
    whatsAppNumber: string | null;
    receiveWhatsApp: boolean;
  };
  banners: Array<{ id: string; imagePath: string; linkUrl: string | null }>;
  paymentMethods: Array<{
    id: string;
    paymentMethod: string;
    enabled: boolean;
    dueDays: number | null;
    instructions: string | null;
  }>;
  categories: Array<{ id: string; name: string; color: string | null }>;
  products: any[];
}

async function getCatalog(slug: string): Promise<CatalogData | null> {
  try {
    const res = await fetch(`${INTERNAL_API}/api/public/catalog/${slug}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    pix: 'Pix',
    cash: 'Dinheiro',
    credit: 'Crédito',
    debit: 'Débito',
    credit_store: 'Fiado',
  };
  return labels[method] || method;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCatalog(slug);
  if (!data) return { title: 'Catálogo não encontrado' };

  const storeName = data.store.name || 'Catálogo';
  const logoUrl = data.store.logoPath
    ? `${API_URL}/api/public/uploads/${data.store.logoPath}`
    : undefined;

  return {
    title: storeName,
    description: `Catálogo de produtos - ${storeName}`,
    openGraph: {
      title: storeName,
      description: `Confira os produtos de ${storeName}`,
      ...(logoUrl ? { images: [logoUrl] } : {}),
    },
    robots: 'noindex',
  };
}

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCatalog(slug);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-slate-700 mb-4">404</h1>
          <p className="text-slate-400 text-lg">Catálogo não encontrado</p>
          <p className="text-slate-500 text-sm mt-2">
            Esta loja pode estar indisponível ou o endereço está incorreto.
          </p>
        </div>
      </div>
    );
  }

  const paymentMethods = data.paymentMethods
    .filter((pm) => pm.enabled)
    .map((pm) => ({
      value: pm.paymentMethod,
      label: paymentLabel(pm.paymentMethod),
      dueDays: pm.dueDays,
      instructions: pm.instructions,
    }));

  return (
    <CatalogPageClient
      slug={slug}
      store={data.store}
      banners={data.banners}
      paymentMethods={paymentMethods}
      categories={data.categories}
      products={data.products}
    />
  );
}
