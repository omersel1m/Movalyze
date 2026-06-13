import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Plus, UtensilsCrossed } from 'lucide-react-native';
import { NutritionEntry, MealType } from '../types/nutrition.types';
import { MEAL_LABELS } from '../logic/meal-types';
import FoodEntryRow from './FoodEntryRow';

interface Props {
  mealType: MealType;
  entries: NutritionEntry[];
  onAddFood: (meal: MealType) => void;
  onDeleteEntry: (id: string) => void;
  onEditEntry?: (entry: NutritionEntry) => void;
}

function EmptyState({ onAdd, mealType }: { onAdd: () => void; mealType: MealType }) {
  return (
    <View style={styles.emptyState}>
      <UtensilsCrossed size={28} color="#D0D0D0" strokeWidth={1.5} />
      <Text style={styles.emptyText}>Henüz besin eklenmedi</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd}>
        <Plus size={14} color="#263C84" strokeWidth={2} />
        <Text style={styles.emptyBtnText}>Besin Ekle</Text>
      </TouchableOpacity>
    </View>
  );
}

function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, easing: Easing.ease, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);
  return (
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={styles.skeletonMain} />
      <View style={styles.skeletonSide} />
    </Animated.View>
  );
}

export default function MealSection({
  mealType, entries, onAddFood, onDeleteEntry, onEditEntry,
}: Props) {
  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.mealTitle}>{MEAL_LABELS[mealType]}</Text>
        <Text style={styles.mealCalories}>
          {entries.length > 0 ? `${Math.round(totalCalories)} kcal` : ''}
        </Text>
      </View>

      {entries.length === 0 ? (
        <EmptyState onAdd={() => onAddFood(mealType)} mealType={mealType} />
      ) : (
        <>
          {entries.map(entry => (
            <FoodEntryRow
              key={entry.id}
              entry={entry}
              onDelete={onDeleteEntry}
              onEdit={onEditEntry}
            />
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => onAddFood(mealType)}>
            <Plus size={14} color="#263C84" strokeWidth={2} />
            <Text style={styles.addBtnText}>Besin Ekle</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export { SkeletonRow };

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
    marginBottom: 10,
  },
  mealTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  mealCalories: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F97316',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#263C84',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#8A8A8A',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#263C84',
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#263C84',
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  skeletonMain: {
    width: 160,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  skeletonSide: {
    width: 60,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
});
