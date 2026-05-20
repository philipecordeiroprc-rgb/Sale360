import { View, Text, StyleSheet } from 'react-native';

interface Props {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

export function SyncIndicator({ isOnline, isSyncing, pendingCount }: Props) {
  let color: string;
  let label: string;

  if (!isOnline) {
    color = '#F87171';
    label = 'Offline';
  } else if (isSyncing) {
    color = '#FBBF24';
    label = 'Sincronizando...';
  } else if (pendingCount > 0) {
    color = '#FBBF24';
    label = `${pendingCount} pendente(s)`;
  } else {
    color = '#34D399';
    label = 'Online';
  }

  return (
    <View style={[styles.container, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
