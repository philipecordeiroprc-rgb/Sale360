const fs = require('fs');
const file = 'C:/Users/rafac/Documents/GitHub/Sale360/apps/web/src/app/orders/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// ============================================================
// 1. Add paymentLabel(), isFiado(), and CONFIRM_PAYMENT_METHODS after PAYMENT_METHODS array
// ============================================================
const paymentMethodsEnd = `  { id: 'Fiado', label: 'Fiado', icon: User, color: 'bg-amber-500', paymentStatus: 'PENDING' },
];`;

const paymentLabelFn = `
function paymentLabel(method) {
  const map = {
    credit_store: 'Fiado',
    cash: 'Dinheiro',
    pix: 'Pix',
    credit: 'Crédito',
    debit: 'Débito',
    Dinheiro: 'Dinheiro',
    Pix: 'Pix',
    Debito: 'Débito',
    Credito: 'Crédito',
    Fiado: 'Fiado',
  };
  return map[method] || method || '—';
}

function isFiado(method) {
  return method === 'credit_store' || method === 'Fiado';
}

const CONFIRM_PAYMENT_METHODS = [
  { id: 'Dinheiro', label: 'Dinheiro', icon: Banknote, color: 'bg-emerald-500' },
  { id: 'Pix', label: 'Pix', icon: CreditCard, color: 'bg-cyan-500' },
  { id: 'Debito', label: 'Débito', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'Credito', label: 'Crédito', icon: CreditCard, color: 'bg-purple-500' },
];`;

content = content.replace(paymentMethodsEnd, paymentMethodsEnd + paymentLabelFn);
console.log('1. Added paymentLabel/isFiado/CONFIRM_PAYMENT_METHODS');

// ============================================================
// 2. Add confirm payment sub-modal state after detail modal state
// ============================================================
const detailStateEnd = `  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);`;

const confirmState = `
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [confirmingIsOnline, setConfirmingIsOnline] = useState(false);
  const [selectedConfirmPayment, setSelectedConfirmPayment] = useState(CONFIRM_PAYMENT_METHODS[0]);`;

content = content.replace(detailStateEnd, detailStateEnd + confirmState);
console.log('2. Added confirm payment state');

// ============================================================
// 3. Replace handleConfirmOnline
// ============================================================
const oldHandleConfirmOnline = `  const handleConfirmOnline = async (id: string) => {
    if (!confirm('Confirmar pedido online? O estoque será baixado e o pedido marcado como pago.')) return;
    try {
      const result = await api.orders.confirm(id);
      show(result.message || 'Pedido confirmado!');
      loadOrders();
      loadTodayRevenue();
    } catch (err: any) {
      show(err.message || 'Erro ao confirmar pedido', 'error');
    }
  };`;

const newHandleConfirmOnline = `  const handleConfirmOnline = (id: string) => {
    setConfirmingOrderId(id);
    setConfirmingIsOnline(true);
    setSelectedConfirmPayment(CONFIRM_PAYMENT_METHODS[0]);
    setConfirmPaymentOpen(true);
  };

  const handleConfirmOnlineExecute = async () => {
    const id = confirmingOrderId;
    if (!id) return;
    try {
      const result = await api.orders.confirm(id, { paymentMethod: selectedConfirmPayment.id });
      show(result.message || 'Pedido confirmado!');
      setConfirmPaymentOpen(false);
      setConfirmingOrderId(null);
      loadOrders();
      loadTodayRevenue();
      if (detailOpen && detailOrder?.id === id) setDetailOpen(false);
    } catch (err: any) {
      show(err.message || 'Erro ao confirmar pedido', 'error');
    }
  };`;

content = content.replace(oldHandleConfirmOnline, newHandleConfirmOnline);
console.log('3. Replaced handleConfirmOnline');

// ============================================================
// 4. Replace handlePay
// ============================================================
const oldHandlePay = `  const handlePay = async (id: string) => {
    if (!confirm('Confirmar recebimento do pagamento?')) return;
    try {
      const result = await api.orders.pay(id);
      show(result.message || 'Pagamento recebido!');
      loadOrders();
      loadTodayRevenue();
      if (detailOpen && detailOrder?.id === id) setDetailOpen(false);
    } catch (err: any) {
      show(err.message || 'Erro ao receber pagamento', 'error');
    }
  };`;

const newHandlePay = `  const handlePay = (id: string) => {
    setConfirmingOrderId(id);
    setConfirmingIsOnline(false);
    setSelectedConfirmPayment(CONFIRM_PAYMENT_METHODS[0]);
    setConfirmPaymentOpen(true);
  };

  const handlePayExecute = async () => {
    const id = confirmingOrderId;
    if (!id) return;
    try {
      const result = await api.orders.pay(id, { paymentMethod: selectedConfirmPayment.id });
      show(result.message || 'Pagamento recebido!');
      setConfirmPaymentOpen(false);
      setConfirmingOrderId(null);
      loadOrders();
      loadTodayRevenue();
      if (detailOpen && detailOrder?.id === id) setDetailOpen(false);
    } catch (err: any) {
      show(err.message || 'Erro ao receber pagamento', 'error');
    }
  };`;

content = content.replace(oldHandlePay, newHandlePay);
console.log('4. Replaced handlePay');

// ============================================================
// 5. Add Fiado filter tab
// ============================================================
const filterTabsOld = `          {[
            { id: '', label: 'Todos' },
            { id: 'PAID', label: 'Pagos' },
            { id: 'PENDING', label: 'Pendentes' },
            { id: 'CANCELLED', label: 'Cancelados' },
          ].map(s => (`;

const filterTabsNew = `          {[
            { id: '', label: 'Todos' },
            { id: 'PAID', label: 'Pagos' },
            { id: 'PENDING', label: 'Pendentes' },
            { id: 'CREDIT_STORE', label: 'Fiado' },
            { id: 'CANCELLED', label: 'Cancelados' },
          ].map(s => (`;

content = content.replace(filterTabsOld, filterTabsNew);
console.log('5. Added Fiado filter tab');

// ============================================================
// 6. Update payment column
// ============================================================
const oldPaymentCol = `                    <td className="px-3 py-2 text-center hidden md:table-cell">
                      <span className="text-xs bg-slate-800 rounded-md px-2 py-1 text-white">{o.paymentMethod}</span>
                    </td>`;

const newPaymentCol = `                    <td className="px-3 py-2 text-center hidden md:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs bg-slate-800 rounded-md px-2 py-1 text-white">{paymentLabel(o.paymentMethod)}</span>
                        {isFiado(o.paymentMethod) && (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Fiado</span>
                        )}
                      </div>
                    </td>`;

content = content.replace(oldPaymentCol, newPaymentCol);
console.log('6. Updated payment column');

// ============================================================
// 7. Update detail modal payment display
// ============================================================
const oldDetailPayment = `                <p className="text-white text-sm flex items-center gap-1.5">
                  {detailOrder.paymentMethod}
                  {detailOrder.source === 'ONLINE' && (`;

const newDetailPayment = `                <p className="text-white text-sm flex items-center gap-1.5">
                  {paymentLabel(detailOrder.paymentMethod)}
                  {isFiado(detailOrder.paymentMethod) && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-medium">Fiado</span>
                  )}
                  {detailOrder.source === 'ONLINE' && (`;

content = content.replace(oldDetailPayment, newDetailPayment);
console.log('7. Updated detail modal payment display');

// ============================================================
// 8. Add confirm payment sub-modal before Toast
// ============================================================
const toastSection = '      {/* Toast */}\n      {toast && (';

const confirmModalJsx = readFile('C:/Users/rafac/Documents/GitHub/Sale360/confirm-modal.txt');

content = content.replace(toastSection, confirmModalJsx + '\n\n      {/* Toast */}\n      {toast && (');
console.log('8. Added confirm payment sub-modal');

fs.writeFileSync(file, content);
console.log('All frontend changes applied successfully');

function readFile(path) {
  return fs.readFileSync(path, 'utf8');
}
