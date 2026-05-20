import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator,
} from 'react-native';

const METHODS = [
  { id: 'pix', label: 'Pix', icon: '⚡', color: '#10B981' },
  { id: 'credit', label: 'Crédito', icon: '💳', color: '#6366F1' },
  { id: 'debit', label: 'Débito', icon: '🏧', color: '#F59E0B' },
  { id: 'cash', label: 'Dinheiro', icon: '💵', color: '#34D399' },
  { id: 'credit_store', label: 'Fiado', icon: '📒', color: '#EC4899' },
];

interface Props {
  total: number;
  onSubmit: (method: string, amount?: number) => void;
  onClose: () => void;
  loading: boolean;
}

export function PaymentModal({ total, onSubmit, onClose, loading }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showCashInput, setShowCashInput] = useState(false);
  const [cashAmount, setCashAmount] = useState('');

  const handleMethodSelect = (method: string) => {
    setSelected(method);
    if (method === 'cash') {
      setShowCashInput(true);
    } else {
      onSubmit(method);
    }
  };

  const handleCashConfirm = () => {
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      onSubmit('cash');
    } else {
      onSubmit('cash', amount);
    }
  };

  if (loading) {
    return (
      <View style={styles.overlay}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Processando pagamento...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        {/* Handle */}
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Pagamento</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Valor total</Text>
          <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
        </View>

        {showCashInput ? (
          <View style={styles.cashSection}>
            <Text style={styles.cashLabel}>Valor recebido</Text>
            <View style={styles.cashInputRow}>
              <Text style={styles.cashPrefix}>R$</Text>
              <Text style={styles.cashValue}>{cashAmount || '0,00'}</Text>
            </View>
            {/* Number pad */}
            <View style={styles.numPad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, ',', 0, '⌫'].map((key) => (
                <TouchableOpacity
                  key={key}
                  style={styles.numKey}
                  onPress={() => {
                    if (key === '⌫') {
                      setCashAmount((prev) => prev.slice(0, -1));
                    } else if (key === ',') {
                      if (!cashAmount.includes('.')) {
                        setCashAmount((prev) => prev + '.');
                      }
                    } else {
                      setCashAmount((prev) => prev + String(key));
                    }
                  }}
                >
                  <Text style={styles.numKeyText}>{key}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleCashConfirm}>
              <Text style={styles.confirmText}>Confirmar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                setShowCashInput(false);
                setCashAmount('');
                setSelected(null);
              }}
            >
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.methodsGrid}>
            {METHODS.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  selected === method.id && {
                    borderColor: method.color,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => handleMethodSelect(method.id)}
              >
                <View style={[styles.methodIcon, { backgroundColor: method.color + '20' }]}>
                  <Text style={styles.methodEmoji}>{method.icon}</Text>
                </View>
                <Text style={styles.methodLabel}>{method.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  closeBtn: {
    fontSize: 22,
    color: '#94A3B8',
    padding: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#0F172A',
    borderRadius: 12,
  },
  totalLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  totalValue: {
    color: '#34D399',
    fontSize: 28,
    fontWeight: '800',
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  methodCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  methodEmoji: {
    fontSize: 24,
  },
  methodLabel: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  cashSection: {
    padding: 8,
  },
  cashLabel: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  cashInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cashPrefix: {
    color: '#94A3B8',
    fontSize: 32,
    fontWeight: '600',
    marginRight: 8,
  },
  cashValue: {
    color: '#F1F5F9',
    fontSize: 40,
    fontWeight: '800',
  },
  numPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  numKey: {
    width: '30%',
    aspectRatio: 1.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  numKeyText: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#34D399',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  backBtn: {
    marginTop: 12,
    alignItems: 'center',
    padding: 8,
  },
  backText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  loadingCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 40,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#F1F5F9',
    fontSize: 16,
    marginTop: 16,
  },
});
