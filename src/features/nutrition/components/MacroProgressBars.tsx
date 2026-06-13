import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getProgressRatio } from '../logic/calculations';
import { NutritionGoals } from '../types/nutrition.types';

interface MacroEntry {
  label: string;
  consumed: number;
  goal: number;
  color: string;
}

interface Props {
  carbsG: number;
  proteinG: number;
  fatG: number;
  goals: NutritionGoals;
}

function MacroBar({ label, consumed, goal, color }: MacroEntry) {
  const ratio = getProgressRatio(consumed, goal);
  const pct = Math.round(ratio * 100);

  return (
    <View style={styles.macroRow}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.values}>
          <Text style={{ color }}>{Math.round(consumed)}g</Text>
          <Text style={styles.separator}> / </Text>
          <Text style={styles.goal}>{goal}g</Text>
        </Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.pct, { color }]}>{pct}%</Text>
    </View>
  );
}

export default function MacroProgressBars({ carbsG, proteinG, fatG, goals }: Props) {
  const macros: MacroEntry[] = [
    { label: 'Karbonhidrat', consumed: carbsG,   goal: goals.carbsG,   color: '#F97316' },
    { label: 'Protein',      consumed: proteinG, goal: goals.proteinG, color: '#268479' },
    { label: 'Yağ',          consumed: fatG,     goal: goals.fatG,     color: '#AEBC2E' },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Makro Besinler</Text>
      {macros.map(m => (
        <MacroBar key={m.label} {...m} />
      ))}
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
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 14,
  },
  macroRow: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  values: {
    fontSize: 13,
  },
  separator: {
    color: '#ADADAD',
  },
  goal: {
    color: '#8A8A8A',
  },
  barBg: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginBottom: 2,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  pct: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
});
