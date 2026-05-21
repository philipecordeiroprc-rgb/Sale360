const fs = require('fs');
const file = 'C:/Users/rafac/Documents/GitHub/Sale360/apps/web/src/app/orders/page.tsx';
const confirmModalContent = fs.readFileSync('C:/Users/rafac/Documents/GitHub/Sale360/confirm-modal.txt', 'utf8');
// Normalize line endings to LF
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Debug
function replace(oldStr, newStr, label) {
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    console.log('OK: ' + label);
  } else {
    console.log('FAIL: ' + label + ' — string not found');
    // Show first 80 chars of what we're looking for
    console.log('  Looking for: ' + JSON.stringify(oldStr.substring(0, 80)));
  }
}

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

replace(paymentMethodsEnd, paymentMethodsEnd + paymentLabelFn, '1. paymentLabel/isFiado/CONFIRM_PAYMENT_METHODS');

// ============================================================
// 2. Add confirm payment sub-modal state
// ============================================================
const detailStateEnd = `  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);`;

const confirmState = `
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [confirmingIsOnline, setConfirmingIsOnline] = useState(false);
  const [selectedConfirmPayment, setSelectedConfirmPayment] = useState(CONFIRM_PAYMENT_METHODS[0]);`;

replace(detailStateEnd, detailStateEnd + confirmState, '2. confirm payment state');

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

replace(oldHandleConfirmOnline, newHandleConfirmOnline, '3. handleConfirmOnline');

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

replace(oldHandlePay, newHandlePay, '4. handlePay');

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

replace(filterTabsOld, filterTabsNew, '5. Fiado filter tab');

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

replace(oldPaymentCol, newPaymentCol, '6. payment column');

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

replace(oldDetailPayment, newDetailPayment, '7. detail modal payment');

// ============================================================
// 8. Add confirm payment sub-modal before Toast
// ============================================================
// Normalize the confirm modal content too
const modalContent = confirmModalContent.replace(/\r\n/g, '\n');
const toastSection = `      {/* Toast */}
      {toast && (`;
const replacement = modalContent + '\n\n' + toastSection;
replace(toastSection, replacement, '8. confirm payment sub-modal');

fs.writeFileSync(file, content);
console.log('\nDone!');
