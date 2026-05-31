export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  total: number;
  percentage: number;
  fiadoCount: number;
  fiadoTotal: number;
}

export interface FiadoSettled {
  count: number;
  total: number;
}

export interface FinancialIndicators {
  faturamentoBruto: number;
  faturamentoLiquido: number;
  cmv: number;
  lucroBruto: number;
  margemBruta: number;
  custoOperacional: number;
  perdaTaxaCartao: number;
  lucroLiquidoEstimado: number;
  ticketMedio: number;
  faturamentoPorFormaPagamento: PaymentMethodBreakdown[];
  fiadoSettled: FiadoSettled;
}

export interface TopProduct {
  id: string | null;
  name: string;
  quantity: number;
  revenue: number;
}

export interface Encalhados {
  dias30: number;
  dias60: number;
  dias90: number;
  lista: { id: string; name: string; lastSaleAt: string }[];
}

export interface LowStockProduct {
  id: string;
  name: string;
  stockQty: number;
  lowStockAt: number;
}

export interface InventoryIndicators {
  valorTotalEstoqueCusto: number;
  valorPotencialEstoqueVenda: number;
  margemPotencial: number;
  margemPotencialPercent: number;
  diasCobertura: number;
  top10Produtos: TopProduct[];
  produtosEncalhados: Encalhados;
  estoqueBaixo: LowStockProduct[];
  giroEstoque: number;
}

export interface PurchaseBySupplier {
  id: string;
  name: string;
  total: number;
  count: number;
}

export interface PurchasesIndicators {
  totalGasto: number;
  porFornecedor: PurchaseBySupplier[];
  prazoMedioEntrega: number;
  numeroCompras: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  total: number;
  orders: number;
}

export interface CreditCustomer {
  id: string;
  name: string;
  creditBalance: number;
}

export interface CustomerIndicators {
  totalAtivos: number;
  top10Clientes: TopCustomer[];
  percentualRecorrentes: number;
  fiadoEmAberto: number;
  fiadoClientes: CreditCustomer[];
  ticketMedioPorCliente: number;
}

export interface SellerPerformance {
  id: string;
  name: string;
  orders: number;
  total: number;
}

export interface HourlyBreakdown {
  hour: number;
  count: number;
  total: number;
}

export interface OperationalIndicators {
  vendasPorVendedor: SellerPerformance[];
  horariosPico: HourlyBreakdown[];
  percentualOffline: number;
}

export interface IndicatorsResponse {
  financial: FinancialIndicators;
  inventory: InventoryIndicators;
  purchases: PurchasesIndicators;
  customers: CustomerIndicators;
  operational: OperationalIndicators;
}
