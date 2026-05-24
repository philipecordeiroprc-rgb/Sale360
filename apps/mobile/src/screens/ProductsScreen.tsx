// ============================================================
// Sale360 Mobile — Products Management Screen
// ============================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useStore, type Product } from '../stores/useStore';
import { BarcodeScanner } from '../components/pdv/BarcodeScanner';
import { fetchProducts, fetchProductByBarcode } from '../services/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export function ProductsScreen() {
  const {
    token, products, categories, setView, setProducts, setCategories,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState<'search' | 'form'>('search');

  // Product form
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    categoryId: '',
    price: '',
  });
  const [saving, setSaving] = useState(false);

  // Load products on mount
  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProducts();
      setProducts(data.products || []);
      if (data.categories) setCategories(data.categories);
    } catch {
      // Products already in Zustand cache from PDV sync
    } finally {
      setLoading(false);
    }
  }, [setProducts, setCategories]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/categories`, {
        headers: { Authorization: `Bearer ${useStore.getState().token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch { /* offline */ }
  }, [setCategories]);

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
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.includes(q),
      );
    }
    return list;
  }, [products, selectedCategory, searchQuery]);

  // Barcode scanned
  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    setShowScanner(false);

    if (scannerMode === 'search') {
      // Search mode: filter products by scanned barcode
      setSearchQuery(barcode);
    } else {
      // Form mode: fill barcode field
      setFormData((prev) => ({ ...prev, barcode }));
    }
  }, [scannerMode]);

  // Create/Edit product
  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do produto.');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        categoryId: formData.categoryId || undefined,
      };
      if (formData.price) payload.price = parseFloat(formData.price);

      const url = editingProduct
        ? `${API_URL}/api/products/${editingProduct.id}`
        : `${API_URL}/api/products`;

      const res = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert('Sucesso', editingProduct ? 'Produto atualizado!' : 'Produto criado!');
        setFormOpen(false);
        loadProducts();
      } else {
        const err = await res.json();
        Alert.alert('Erro', err.error || 'Falha ao salvar produto');
      }
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  // Toggle active
  const handleToggle = async (product: Product) => {
    try {
      await fetch(`${API_URL}/api/products/${product.id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadProducts();
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    }
  };

  // Open form for create/edit
  const openCreateForm = () => {
    setEditingProduct(null);
    setFormData({ name: '', description: '', sku: '', barcode: '', categoryId: '', price: '' });
    setFormOpen(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      categoryId: product.category?.id || '',
      price: product.price ? String(product.price) : '',
    });
    setFormOpen(true);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Produtos</Text>
        <Text style={styles.subtitle}>
          {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} no catálogo
        </Text>
      </View>

      {/* Search + Scan */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, SKU ou código de barras..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => { setScannerMode('search'); setShowScanner(true); }}
        >
          <Text style={styles.scanIcon}>📷</Text>
        </TouchableOpacity>
      </View>

      {/* Category chips */}
      <View style={styles.categoryRow}>
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
            Todas
          </Text>
        </TouchableOpacity>
        {categories.slice(0, 6).map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Carregando produtos...</Text>
        </View>
      )}

      {/* Product Grid */}
      {!loading && (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productGrid}
          renderItem={({ item }) => {
            const price = Number(item.price);
            const inactive = !item.active;
            return (
              <TouchableOpacity
                style={[styles.productCard, inactive && styles.productCardInactive]}
                onPress={() => openEditForm(item)}
                onLongPress={() => {
                  Alert.alert(
                    item.name,
                    `SKU: ${item.sku || '—'}\nCód. Barras: ${item.barcode || '—'}\nEstoque: ${item.stockQty}\nPreço: R$ ${price.toFixed(2)}`,
                    [
                      { text: 'Editar', onPress: () => openEditForm(item) },
                      {
                        text: item.active ? 'Desativar' : 'Ativar',
                        onPress: () => handleToggle(item),
                      },
                      { text: 'Fechar', style: 'cancel' },
                    ],
                  );
                }}
              >
                <View style={[styles.productImg, { backgroundColor: '#334155' }]}>
                  <Text style={styles.productEmoji}>
                    {item.unit === 'KG' ? '⚖️' : item.unit === 'L' ? '🫗' : '📦'}
                  </Text>
                </View>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.barcode ? (
                  <Text style={styles.productBarcode} numberOfLines={1}>
                    {item.barcode}
                  </Text>
                ) : null}
                <Text style={styles.productPrice}>
                  {price > 0 ? `R$ ${price.toFixed(2)}` : '—'}
                </Text>
                <Text style={[styles.productStock, item.stockQty <= 0 && styles.stockZero]}>
                  Estoque: {item.stockQty}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>
                {searchQuery || selectedCategory
                  ? 'Nenhum produto encontrado. Ajuste os filtros.'
                  : 'Nenhum produto cadastrado.'}
              </Text>
            </View>
          }
        />
      )}

      {/* New Product FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateForm}>
        <Text style={styles.fabText}>＋ Novo Produto</Text>
      </TouchableOpacity>

      {/* Barcode Scanner Modal */}
      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner
          onScan={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      </Modal>

      {/* Product Form Modal */}
      <Modal visible={formOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </Text>
              <TouchableOpacity onPress={() => setFormOpen(false)}>
                <Text style={styles.formClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Form fields */}
            <View style={styles.formBody}>
              {/* Name */}
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData((p) => ({ ...p, name: text }))}
                placeholder="Nome do produto"
                placeholderTextColor="#64748B"
              />

              {/* Description */}
              <Text style={styles.label}>Descrição</Text>
              <TextInput
                style={styles.input}
                value={formData.description}
                onChangeText={(text) => setFormData((p) => ({ ...p, description: text }))}
                placeholder="Descrição curta"
                placeholderTextColor="#64748B"
              />

              {/* SKU */}
              <Text style={styles.label}>SKU</Text>
              <TextInput
                style={styles.input}
                value={formData.sku}
                onChangeText={(text) => setFormData((p) => ({ ...p, sku: text }))}
                placeholder="Código interno"
                placeholderTextColor="#64748B"
              />

              {/* Barcode + Scan */}
              <Text style={styles.label}>Código de Barras</Text>
              <View style={styles.barcodeRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={formData.barcode}
                  onChangeText={(text) => setFormData((p) => ({ ...p, barcode: text }))}
                  placeholder="789..."
                  placeholderTextColor="#64748B"
                />
                <TouchableOpacity
                  style={styles.barcodeScanBtn}
                  onPress={() => { setScannerMode('form'); setShowScanner(true); }}
                >
                  <Text style={styles.barcodeScanIcon}>📷</Text>
                </TouchableOpacity>
              </View>

              {/* Category */}
              <Text style={styles.label}>Categoria</Text>
              <View style={styles.categorySelect}>
                {categories.slice(0, 8).map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      formData.categoryId === cat.id && styles.catChipActive,
                    ]}
                    onPress={() =>
                      setFormData((p) => ({
                        ...p,
                        categoryId: p.categoryId === cat.id ? '' : cat.id,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        formData.categoryId === cat.id && styles.catChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Price */}
              <Text style={styles.label}>Preço de Venda (R$)</Text>
              <TextInput
                style={styles.input}
                value={formData.price}
                onChangeText={(text) => setFormData((p) => ({ ...p, price: text }))}
                placeholder="0,00"
                placeholderTextColor="#64748B"
                keyboardType="decimal-pad"
              />
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Salvando...' : editingProduct ? 'Atualizar Produto' : 'Criar Produto'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F1F5F9',
  },
  clearIcon: {
    fontSize: 16,
    color: '#64748B',
    padding: 4,
  },
  scanButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanIcon: {
    fontSize: 20,
  },

  // Categories
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 4,
  },
  categoryChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  categoryText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },

  // Product Grid
  productGrid: {
    padding: 8,
    paddingBottom: 80,
  },
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    maxWidth: '47%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  productCardInactive: {
    opacity: 0.5,
  },
  productImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  productEmoji: {
    fontSize: 32,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 4,
  },
  productBarcode: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#34D399',
    marginBottom: 4,
  },
  productStock: {
    fontSize: 11,
    color: '#94A3B8',
  },
  stockZero: {
    color: '#F87171',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#6366F1',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Form Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  formContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 34,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  formClose: {
    fontSize: 20,
    color: '#94A3B8',
    padding: 4,
  },
  formBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: 450,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F1F5F9',
  },
  barcodeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  barcodeScanBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeScanIcon: {
    fontSize: 20,
  },

  // Category select
  categorySelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  catChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  catChipText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },

  // Save button
  saveBtn: {
    backgroundColor: '#6366F1',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
