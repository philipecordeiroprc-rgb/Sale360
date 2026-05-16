import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useStore, type Product } from '../stores/useStore';
import { BarcodeScanner } from '../components/pdv/BarcodeScanner';
import { CartDrawer } from '../components/pdv/CartDrawer';
import { PaymentModal } from '../components/pdv/PaymentModal';
import { SyncIndicator } from '../components/sync/SyncIndicator';

type ViewMode = 'sell' | 'catalog' | 'commands' | 'customers';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export function PDVScreen() {
  const {
    token, cart, addToCart, removeFromCart, clearCart,
    selectedCustomer, setCustomer, selectedCategory, setCategory,
    searchQuery, setSearch, products, categories,
    isOnline, isSyncing, pendingSyncCount, currentView, setView,
  } = useStore();

  // Modals
  const [showScanner, setShowScanner] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Computed
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.total, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  // Filter products
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => p.active);
    if (selectedCategory) {
      list = list.filter((p) => p.category?.id === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode?.includes(q),
      );
    }
    return list;
  }, [products, selectedCategory, searchQuery]);

  // Add product to cart
  const handleAddProduct = useCallback((product: Product) => {
    addToCart(product);
  }, [addToCart]);

  // Barcode scanned
  const handleBarcodeScanned = useCallback((barcode: string) => {
    setShowScanner(false);
    const product = products.find((p) => p.barcode === barcode);
    if (product) {
      addToCart(product);
    } else {
      Alert.alert('Produto não encontrado', `Código: ${barcode}`);
    }
  }, [products, addToCart]);

  // Submit order
  const handleCheckout = async (paymentMethod: string, paidAmount?: number) => {
    if (cart.length === 0) {
      Alert.alert('Carrinho vazio', 'Adicione produtos antes de finalizar.');
      return;
    }

    setSubmitting(true);

    const orderData = {
      items: cart.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      customerId: selectedCustomer?.id,
      subtotal: cartTotal,
      discount: 0,
      total: cartTotal,
      paidAmount: paidAmount || cartTotal,
      paymentMethod,
      paymentStatus: paymentMethod === 'credit_store'
        ? 'PENDING'
        : paidAmount && paidAmount < cartTotal ? 'PARTIAL' : 'PAID',
      source: 'PDV',
      deviceId: useStore.getState().deviceId,
      localId: `LOCAL-${Date.now()}`,
      createdAtDevice: new Date().toISOString(),
    };

    try {
      if (isOnline) {
        const res = await fetch(`${API_URL}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(orderData),
        });

        if (res.ok) {
          const order = await res.json();
          Alert.alert('Venda concluída!', `Pedido #${order.orderNumber}`);
          clearCart();
          setShowPayment(false);
        } else {
          const err = await res.json();
          Alert.alert('Erro', err.error || 'Falha ao registrar venda');
        }
      } else {
        // Save locally for later sync
        const { getDatabase, saveLocalOrder } = require('../db/localDatabase');
        const db = await getDatabase();
        await saveLocalOrder(db, orderData.localId, orderData);

        // Subtract stock locally
        for (const item of cart) {
          if (item.productId) {
            const product = products.find((p) => p.id === item.productId);
            if (product) {
              useStore.getState().updateProductStock(
                item.productId,
                product.stockQty - item.quantity,
              );
            }
          }
        }

        Alert.alert('Venda salva', 'Será sincronizada quando houver internet.');
        clearCart();
        setShowPayment(false);
      }
    } catch (err) {
      Alert.alert('Erro', 'Falha ao registrar venda. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Text style={styles.topTitle}>PDV</Text>
          <SyncIndicator
            isOnline={isOnline}
            isSyncing={isSyncing}
            pendingCount={pendingSyncCount}
          />
        </View>

        {/* Search + Scan */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar produto ou escanear..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearch}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanner(true)}
          >
            <Text style={styles.scanIcon}>📷</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CATEGORY TABS */}
      <View style={styles.categoryRow}>
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setCategory(null)}
        >
          <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        {categories.slice(0, 6).map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
            onPress={() => setCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* PRODUCT GRID */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.productGrid}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => handleAddProduct(item)}
          >
            <View style={[styles.productImg, { backgroundColor: item.category?.color || '#334155' }]}>
              <Text style={styles.productEmoji}>
                {item.unit === 'KG' ? '⚖️' : item.unit === 'L' ? '🫗' : '📦'}
              </Text>
            </View>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.productPrice}>
              R$ {Number(item.price).toFixed(2)}
            </Text>
            {item.stockQty <= 5 && (
              <Text style={styles.lowStock}>Qtd: {item.stockQty}</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Nenhum produto encontrado</Text>
          </View>
        }
      />

      {/* BOTTOM NAV */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, currentView === 'sell' && styles.navItemActive]}
          onPress={() => setView('sell')}
        >
          <Text style={styles.navIcon}>💰</Text>
          <Text style={styles.navLabel}>Vender</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentView === 'catalog' && styles.navItemActive]}
          onPress={() => setView('catalog')}
        >
          <Text style={styles.navIcon}>📦</Text>
          <Text style={styles.navLabel}>Produtos</Text>
        </TouchableOpacity>

        {/* CART BUTTON (center, prominent) */}
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => setShowCart(true)}
        >
          <Text style={styles.cartEmoji}>🛒</Text>
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentView === 'commands' && styles.navItemActive]}
          onPress={() => setView('commands')}
        >
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navLabel}>Comandas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentView === 'customers' && styles.navItemActive]}
          onPress={() => setView('customers')}
        >
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>Clientes</Text>
        </TouchableOpacity>
      </View>

      {/* CHECKOUT FAB */}
      {cart.length > 0 && currentView === 'sell' && (
        <TouchableOpacity
          style={styles.checkoutFab}
          onPress={() => setShowPayment(true)}
        >
          <Text style={styles.checkoutText}>
            Finalizar R$ {cartTotal.toFixed(2)}
          </Text>
        </TouchableOpacity>
      )}

      {/* MODALS */}
      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      </Modal>

      <Modal visible={showCart} animationType="slide">
        <CartDrawer
          onClose={() => setShowCart(false)}
          onCheckout={() => {
            setShowCart(false);
            setShowPayment(true);
          }}
        />
      </Modal>

      <Modal visible={showPayment} animationType="slide" transparent>
        <PaymentModal
          total={cartTotal}
          onSubmit={handleCheckout}
          onClose={() => setShowPayment(false)}
          loading={submitting}
        />
      </Modal>
    </View>
  );
}
