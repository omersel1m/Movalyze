import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, ChevronRight } from 'lucide-react-native';
import { Food } from '../types/nutrition.types';

interface Props {
  food: Food;
  isFavorite?: boolean;
  onPress: (food: Food) => void;
  onToggleFavorite?: (food: Food) => void;
}

export default function FoodCard({ food, isFavorite, onPress, onToggleFavorite }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(food)} activeOpacity={0.7}>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>{food.name}</Text>
        {food.brand && <Text style={styles.brand}>{food.brand}</Text>}
        <Text style={styles.macro}>
          {food.calories} kcal · K:{food.carbsG}g  P:{food.proteinG}g  Y:{food.fatG}g
          <Text style={styles.perServing}>  / {food.servingSize}{food.servingUnit}</Text>
        </Text>
      </View>

      <View style={styles.actions}>
        {onToggleFavorite && (
          <TouchableOpacity
            onPress={() => onToggleFavorite(food)}
            hitSlop={8}
            style={styles.favBtn}
          >
            <Heart
              size={18}
              color={isFavorite ? '#E53E3E' : '#D0D0D0'}
              fill={isFavorite ? '#E53E3E' : 'transparent'}
              strokeWidth={1.75}
            />
          </TouchableOpacity>
        )}
        <ChevronRight size={18} color="#ADADAD" strokeWidth={1.75} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  main: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  brand: {
    fontSize: 12,
    color: '#8A8A8A',
  },
  macro: {
    fontSize: 12,
    color: '#F97316',
    fontWeight: '600',
  },
  perServing: {
    fontWeight: '400',
    color: '#8A8A8A',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favBtn: {
    padding: 4,
  },
});
