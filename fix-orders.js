const fs = require('fs');
const file = 'C:/Users/rafac/Documents/GitHub/Sale360/apps/web/src/app/orders/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// ============================================================
// 1. Add paymentLabel() function after PAYMENT_METHODS array
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

// ============================================================
// 3. Replace handleConfirmOnline to show sub-modal
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

// ============================================================
// 4. Replace handlePay to show sub-modal
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

// ============================================================
// 6. Update payment column — use paymentLabel() and add Fiado badge
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

// ============================================================
// 7. Update detail modal payment display — use paymentLabel() and add Fiado badge
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

// ============================================================
// 8. Add confirm payment sub-modal JSX before the Toast
// ============================================================
const toastSection = `      {/* Toast */}
      {toast && (`;

const confirmModalJsx = `      {/* Confirm Payment Sub-Modal (choose final payment method for Fiado) */}
      <Modal open={confirmPaymentOpen} onClose={() => { setConfirmPaymentOpen(false); setConfirmingOrderId(null); }} title={confirmingIsOnline ? 'Confirmar Pedido Online' : 'Receber Pagamento'} size="sm">
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            {confirmingIsOnline
              ? 'Escolha a forma de pagamento para confirmar este pedido:'
              : 'Escolha a forma de pagamento recebida:'}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {CONFIRM_PAYMENT_METHODS.map((pm) => {
              const Icon = pm.icon;
              const isSelected = selectedConfirmPayment.id === pm.id;
              return (
                <button key={pm.id} onClick={() => setSelectedConfirmPayment(pm)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all ${
                    isSelected
                      ? 'bg-indigo-500 text-white ring-2 ring-indigo-400'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}>
                  <Icon size={20} />
                  <span className="text-xs font-medium">{pm.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button onClick={() => { setConfirmPaymentOpen(false); setConfirmingOrderId(null); }} className="px-4 py-2 text-slate-400 text-sm hover:text-white">Cancelar</button>
            <button
              onClick={() => { if (confirmingIsOnline) handleConfirmOnlineExecute(); else handlePayExecute(); }}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {confirmingIsOnline ? 'Confirmar Pedido' : 'Receber Pagamento'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (`;

content = content.replace(toastSection, confirmModalJsx);

fs.writeFileSync(file, content);
console.log('All frontend changes applied successfully');
