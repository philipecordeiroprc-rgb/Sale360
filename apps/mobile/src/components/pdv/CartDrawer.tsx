import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useStore } from '../../stores/useStore';

interface Props {
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ onClose, onCheckout }: Props) {
  const { cart, updateCartItem, removeFromCart, selectedCustomer, setCustomer }
    = useStore();

  const total = cart.reduce((sum, item) => sum + item.total, 0);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Carrinho ({count} itens)</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Customer selector */}
      <TouchableOpacity style={styles.customerRow}>
        <Text style={styles.customerIcon}>👤</Text>
        <Text style={styles.customerText}>
          {selectedCustomer ? selectedCustomer.name : 'Cliente (opcional)'}
        </Text>
        <Text style={styles.customerArrow}>›</Text>
      </TouchableOpacity>

      {/* Cart items */}
      {cart.length === 0 ? (
        <View style={styles.emptyCart}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyText}>Carrinho vazio</Text>
          <Text style={styles.emptySub}>Toque nos produtos para adicionar</Text>
        </View>
      ) : (
        <FlatList
          data={cart}
          keyExtractor={(item) => item.id}
          style={styles.itemList}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemPrice}>
                  R$ {item.unitPrice.toFixed(2)} x {item.quantity}
                </Text>
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateCartItem(item.id, item.quantity - 1)}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qty}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateCartItem(item.id, item.quantity + 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeFromCart(item.id)}
                >
                  <Text style={styles.removeIcon}>🗑</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Footer */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={onCheckout}>
            <Text style={styles.checkoutText}>Ir para Pagamento</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  closeBtn: {
    fontSize: 22,
    color: '#94A3B8',
    padding: 8,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customerIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  customerText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 14,
  },
  customerArrow: {
    color: '#64748B',
    fontSize: 20,
  },
  emptyCart: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySub: {
    color: '#475569',
    fontSize: 14,
    marginTop: 4,
  },
  itemList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  itemRow: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemInfo: {
    marginBottom: 8,
  },
  itemName: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
  },
  itemPrice: {
    color: '#34D399',
    fontSize: 13,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    backgroundColor: '#334155',
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    color: '#F1F5F9',
    fontSize: 18,
    fontWeight: '700',
  },
  qty: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
  },
  removeBtn: {
    marginLeft: 'auto',
    padding: 8,
  },
  removeIcon: {
    fontSize: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#1E293B',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    color: '#94A3B8',
    fontSize: 16,
  },
  totalValue: {
    color: '#34D399',
    fontSize: 24,
    fontWeight: '800',
  },
  checkoutBtn: {
    backgroundColor: '#34D399',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  checkoutText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
});
