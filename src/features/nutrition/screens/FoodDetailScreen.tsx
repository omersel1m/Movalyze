import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Heart } from 'lucide-react-native';

import { NutritionStackParamList } from '../../../navigation/NutritionNavigator';
import { nutritionService } from '../../../services/nutrition.service';
import { Food, MealType } from '../types/nutrition.types';
import { MEAL_LABELS, MEAL_ORDER } from '../logic/meal-types';
import { calculateEntryNutrition } from '../logic/calculations';

type Nav = NativeStackNavigationProp<NutritionStackParamList, 'FoodDetail'>;
type Route = RouteProp<NutritionStackParamList, 'FoodDetail'>;

function NutrientRow({ label, value, unit }: { label: string; value?: number; unit?: string }) {
  if (value === undefined || value === null) return null;
  return (
    <View style={styles.nutrientRow}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={styles.nutrientValue}>{value}{unit ?? 'g'}</Text>
    </View>
  );
}

export default function FoodDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { foodId, mealType: initialMeal, date } = route.params;

  const [food, setFood] = useState<Food | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [adding, setAdding] = useState(false);

  const [selectedMeal, setSelectedMeal] = useState<MealType>(initialMeal);
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<'serving' | 'g' | 'ml'>('serving');

  useEffect(() => {
    let cancelled = false;
    nutritionService.getFoodById(foodId)
      .then(result => {
        if (cancelled) return;
        if (result) {
          setFood(result);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    nutritionService.isFavorite(foodId).then(setIsFavorite).catch(() => {});
    return () => { cancelled = true; };
  }, [foodId]);

  const parsedAmount = parseFloat(amount) || 0;
  const computed = food ? calculateEntryNutrition(food, parsedAmount, unit) : null;

  const handleToggleFavorite = async () => {
    if (!food) return;
    await nutritionService.toggleFavorite(food.id);
    setIsFavorite(f => !f);
  };

  const handleAdd = async () => {
    if (!food || parsedAmount <= 0) return;
    setAdding(true);
    try {
      await nutritionService.addFoodEntry({ food, entryDate: date, mealType: selectedMeal, amount: parsedAmount, unit });
      navigation.navigate('NutritionHome');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Besin eklenemedi.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color="#263C84" /></View>;
  }

  if (notFound || !food) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#8A8A8A', fontSize: 15, textAlign: 'center', paddingHorizontal: 32 }}>
          Besin bulunamadı.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#263C84', fontWeight: '700' }}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={22} color="#1A1A2E" strokeWidth={1.75} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{food.name}</Text>
        <TouchableOpacity onPress={handleToggleFavorite} hitSlop={8}>
          <Heart
            size={22}
            color={isFavorite ? '#E53E3E' : '#D0D0D0'}
            fill={isFavorite ? '#E53E3E' : 'transparent'}
            strokeWidth={1.75}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {food.brand && <Text style={styles.brand}>{food.brand}</Text>}

        {/* Nutrient table */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Besin Değerleri ({food.servingSize}{food.servingUnit} başına)</Text>
          <NutrientRow label="Kalori" value={food.calories} unit=" kcal" />
          <NutrientRow label="Karbonhidrat" value={food.carbsG} />
          <NutrientRow label="Protein" value={food.proteinG} />
          <NutrientRow label="Yağ" value={food.fatG} />
          <NutrientRow label="Lif" value={food.fiberG} />
          <NutrientRow label="Şeker" value={food.sugarG} />
          <NutrientRow label="Sodyum" value={food.sodiumMg} unit="mg" />
        </View>

        {/* Portion selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Porsiyon</Text>

          <View style={styles.unitRow}>
            {(['serving', 'g', 'ml'] as const).map(u => (
              <TouchableOpacity
                key={u}
                style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                onPress={() => setUnit(u)}
              >
                <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>
                  {u === 'serving' ? 'Porsiyon' : u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor="#ADADAD"
          />
        </View>

        {/* Computed totals */}
        {computed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hesaplanan Değerler</Text>
            <View style={styles.computedRow}>
              <View style={styles.computedItem}>
                <Text style={[styles.computedValue, { color: '#263C84' }]}>{Math.round(computed.calories)}</Text>
                <Text style={styles.computedLabel}>kcal</Text>
              </View>
              <View style={styles.computedItem}>
                <Text style={[styles.computedValue, { color: '#F97316' }]}>{Math.round(computed.carbsG)}g</Text>
                <Text style={styles.computedLabel}>Karb</Text>
              </View>
              <View style={styles.computedItem}>
                <Text style={[styles.computedValue, { color: '#268479' }]}>{Math.round(computed.proteinG)}g</Text>
                <Text style={styles.computedLabel}>Protein</Text>
              </View>
              <View style={styles.computedItem}>
                <Text style={[styles.computedValue, { color: '#AEBC2E' }]}>{Math.round(computed.fatG)}g</Text>
                <Text style={styles.computedLabel}>Yağ</Text>
              </View>
            </View>
          </View>
        )}

        {/* Meal selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hangi Öğüne Eklensin?</Text>
          <View style={styles.mealGrid}>
            {MEAL_ORDER.map(meal => (
              <TouchableOpacity
                key={meal}
                style={[styles.mealBtn, selectedMeal === meal && styles.mealBtnActive]}
                onPress={() => setSelectedMeal(meal)}
              >
                <Text style={[styles.mealBtnText, selectedMeal === meal && styles.mealBtnTextActive]}>
                  {MEAL_LABELS[meal]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addBtn, (parsedAmount <= 0 || adding) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={parsedAmount <= 0 || adding}
        >
          {adding
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.addBtnText}>
                {MEAL_LABELS[selectedMeal]}'e Ekle  ·  {computed ? Math.round(computed.calories) : 0} kcal
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 28,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
  },

  scroll: { flex: 1 },
  brand: {
    fontSize: 13,
    color: '#8A8A8A',
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
  },

  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  nutrientLabel: { fontSize: 14, color: '#1A1A2E' },
  nutrientValue: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },

  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  unitBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  unitBtnActive: { borderColor: '#263C84', backgroundColor: '#EEF1FA' },
  unitText: { fontSize: 13, fontWeight: '600', color: '#8A8A8A' },
  unitTextActive: { color: '#263C84' },

  amountInput: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },

  computedRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  computedItem: { alignItems: 'center', gap: 4 },
  computedValue: { fontSize: 22, fontWeight: '900' },
  computedLabel: { fontSize: 11, color: '#8A8A8A' },

  mealGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  mealBtnActive: { borderColor: '#263C84', backgroundColor: '#263C84' },
  mealBtnText: { fontSize: 13, fontWeight: '600', color: '#8A8A8A' },
  mealBtnTextActive: { color: '#FFFFFF' },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  addBtn: {
    backgroundColor: '#F97316',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  addBtnDisabled: { backgroundColor: '#E0E0E0' },
  addBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
