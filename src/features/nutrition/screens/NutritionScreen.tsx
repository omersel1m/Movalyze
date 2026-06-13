import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Target, Zap, ScanBarcode } from 'lucide-react-native';

import { NutritionStackParamList } from '../../../navigation/NutritionNavigator';
import { useNutritionDay } from '../hooks/useNutritionDay';
import { MealType } from '../types/nutrition.types';
import { MEAL_ORDER } from '../logic/meal-types';

import DateSelector from '../components/DateSelector';
import DailySummaryCard from '../components/DailySummaryCard';
import MacroProgressBars from '../components/MacroProgressBars';
import WaterTracker from '../components/WaterTracker';
import MealSection, { SkeletonRow } from '../components/MealSection';
import QuickAddSheet from '../components/QuickAddSheet';

type Nav = NativeStackNavigationProp<NutritionStackParamList, 'NutritionHome'>;

function Skeleton({ height }: { height: number }) {
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
    <Animated.View
      style={[{ height, borderRadius: 16, backgroundColor: '#E0E0E0', opacity }, styles.skeleton]}
    />
  );
}

export default function NutritionScreen() {
  const navigation = useNavigation<Nav>();
  const {
    date, data, loading, error,
    goToPrevDay, goToNextDay, goToToday, isToday, refresh,
    deleteFoodEntry, addWater, removeWater, addQuickCalories,
    getEntriesForMeal,
  } = useNutritionDay();

  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [quickAddMeal, setQuickAddMeal] = useState<MealType>('breakfast');
  const hasMountedRef = useRef(false);

  // Refresh when returning from FoodSearch / FoodDetail (skip initial mount)
  useFocusEffect(
    useCallback(() => {
      if (hasMountedRef.current) {
        refresh();
      }
      hasMountedRef.current = true;
    }, [refresh]),
  );

  const handleAddFood = (meal: MealType) => {
    navigation.navigate('FoodSearch', { mealType: meal, date });
  };

  const handleQuickAdd = (meal: MealType, kcal: number, label: string) => {
    addQuickCalories(meal, kcal, label || undefined);
  };

  const goals = data?.goals ?? { dailyCalories: 2000, carbsG: 250, proteinG: 100, fatG: 65, waterMl: 2500 };
  const totals = data?.totals ?? { calories: 0, carbsG: 0, proteinG: 0, fatG: 0 };

  return (
    <View style={styles.root}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Beslenme</Text>
        <TouchableOpacity
          style={styles.goalsBtn}
          onPress={() => navigation.navigate('NutritionGoals')}
        >
          <Target size={18} color="#263C84" strokeWidth={1.75} />
        </TouchableOpacity>
      </View>

      {/* Date selector */}
      <DateSelector
        date={date}
        isToday={isToday}
        onPrev={goToPrevDay}
        onNext={goToNextDay}
        onToday={goToToday}
      />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {loading ? (
          <>
            <Skeleton height={180} />
            <Skeleton height={130} />
            <Skeleton height={100} />
            {MEAL_ORDER.map(meal => (
              <View key={meal} style={styles.skeletonCard}>
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ))}
          </>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
              <Text style={styles.retryText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <DailySummaryCard consumed={totals.calories} goals={goals} />

            <MacroProgressBars
              carbsG={totals.carbsG}
              proteinG={totals.proteinG}
              fatG={totals.fatG}
              goals={goals}
            />

            <WaterTracker
              totalMl={data?.waterMl ?? 0}
              goalMl={goals.waterMl}
              onAdd={ml => addWater(ml)}
              onRemove={ml => removeWater(ml)}
            />

            {MEAL_ORDER.map(meal => (
              <MealSection
                key={meal}
                mealType={meal}
                entries={getEntriesForMeal(meal)}
                onAddFood={handleAddFood}
                onDeleteEntry={deleteFoodEntry}
              />
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => { setQuickAddMeal('breakfast'); setQuickAddVisible(true); }}
        >
          <Zap size={18} color="#F97316" strokeWidth={1.75} />
          <Text style={styles.actionBtnText}>Hızlı Ekle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} disabled>
          <ScanBarcode size={18} color="#ADADAD" strokeWidth={1.75} />
          <Text style={[styles.actionBtnText, { color: '#ADADAD' }]}>Barkod</Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonText}>Yakında</Text>
          </View>
        </TouchableOpacity>
      </View>

      <QuickAddSheet
        visible={quickAddVisible}
        defaultMeal={quickAddMeal}
        onClose={() => setQuickAddVisible(false)}
        onSubmit={handleQuickAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  goalsBtn: { padding: 4 },
  scroll: { flex: 1 },
  skeleton: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  skeletonCard: {
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
  errorBox: {
    margin: 16,
    alignItems: 'center',
    gap: 12,
  },
  errorText: { fontSize: 14, color: '#E53E3E', textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#263C84',
  },
  retryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFF5ED',
    borderWidth: 1.5,
    borderColor: '#F97316',
  },
  actionBtnSecondary: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F97316',
  },
  comingSoon: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8A8A8A',
  },
});
