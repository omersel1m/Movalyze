import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Trash2, Pencil } from 'lucide-react-native';
import { NutritionEntry } from '../types/nutrition.types';

interface Props {
  entry: NutritionEntry;
  onDelete: (id: string) => void;
  onEdit?: (entry: NutritionEntry) => void;
}

export default function FoodEntryRow({ entry, onDelete, onEdit }: Props) {
  const label = entry.isQuickAdd
    ? (entry.quickAddLabel ?? 'Hızlı Ekle')
    : (entry.foodName ?? 'Bilinmeyen Besin');

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.sub}>
          {entry.amount} {entry.unit}
          {entry.carbsG > 0 || entry.proteinG > 0 || entry.fatG > 0
            ? `  ·  K:${Math.round(entry.carbsG)}g  P:${Math.round(entry.proteinG)}g  Y:${Math.round(entry.fatG)}g`
            : ''}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.calories}>{Math.round(entry.calories)} kcal</Text>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onEdit(entry)}
              hitSlop={8}
            >
              <Pencil size={14} color="#8A8A8A" strokeWidth={1.75} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onDelete(entry.id)}
            hitSlop={8}
          >
            <Trash2 size={14} color="#E53E3E" strokeWidth={1.75} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  sub: {
    fontSize: 12,
    color: '#8A8A8A',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  calories: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
});
