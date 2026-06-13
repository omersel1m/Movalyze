import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Droplets, Plus, Minus } from 'lucide-react-native';

const GLASS_ML = 250;
const MAX_GLASSES = 12;

interface Props {
  totalMl: number;
  goalMl: number;
  onAdd: (ml: number) => void;
  onRemove: (ml: number) => void;
}

export default function WaterTracker({ totalMl, goalMl, onAdd, onRemove }: Props) {
  const glasses = Math.round(totalMl / GLASS_ML);
  const goalGlasses = Math.ceil(goalMl / GLASS_ML);
  const displayCount = Math.min(goalGlasses, MAX_GLASSES);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Droplets size={16} color="#263C84" strokeWidth={1.75} />
          <Text style={styles.title}>Su Takibi</Text>
        </View>
        <Text style={styles.amount}>
          <Text style={styles.amountValue}>{totalMl}</Text>
          <Text style={styles.amountGoal}> / {goalMl} ml</Text>
        </Text>
      </View>

      <View style={styles.glassRow}>
        {Array.from({ length: displayCount }).map((_, i) => (
          <View
            key={i}
            style={[styles.glass, i < glasses && styles.glassFilled]}
          >
            <Droplets
              size={18}
              color={i < glasses ? '#263C84' : '#D0D0D0'}
              strokeWidth={1.75}
            />
          </View>
        ))}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => onRemove(GLASS_ML)}
          disabled={totalMl <= 0}
        >
          <Minus size={16} color="#263C84" strokeWidth={1.75} />
          <Text style={styles.btnSecondaryText}>Çıkar</Text>
        </TouchableOpacity>

        <Text style={styles.glassLabel}>{glasses} bardak</Text>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => onAdd(GLASS_ML)}
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={1.75} />
          <Text style={styles.btnPrimaryText}>Ekle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  amount: {},
  amountValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#263C84',
  },
  amountGoal: {
    fontSize: 13,
    color: '#8A8A8A',
  },
  glassRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  glass: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassFilled: {
    backgroundColor: '#EEF1FA',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: '#263C84',
  },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: '#263C84',
  },
  btnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#263C84',
  },
  glassLabel: {
    fontSize: 13,
    color: '#8A8A8A',
    fontWeight: '600',
  },
});
