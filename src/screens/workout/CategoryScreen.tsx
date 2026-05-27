import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WorkoutStackParamList } from '../../navigation/WorkoutNavigator';
import { workoutService, CATEGORY_COLORS } from '../../services/workout.service';
import { ExerciseCategory } from '../../database/models/types';

type Props = {
  navigation: NativeStackNavigationProp<WorkoutStackParamList, 'CategoryList'>;
};

// ── Skeleton ─────────────────────────────────────────────────────
function SkeletonCard() {
  const opacity = React.useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, easing: Easing.ease, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);
  return <Animated.View style={[styles.skeletonCard, { opacity }]} />;
}

// ── Component ─────────────────────────────────────────────────────
export default function CategoryScreen({ navigation }: Props) {
  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await workoutService.getCategories();
      setCategories(data);
    } catch (e: any) {
      Alert.alert('Hata', e.message ?? 'Kategoriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleCategoryPress = (cat: ExerciseCategory) => {
    navigation.navigate('ExerciseList', {
      categoryId: cat.id,
      categoryName: cat.name.toUpperCase(),
      categoryColor: CATEGORY_COLORS[cat.slug] ?? '#263C84',
    });
  };

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLine}>SMARTER</Text>
        <Text style={styles.headerLine}>WAY TO TRACK</Text>
        <Text style={styles.headerLine}>YOUR EGZERSIZE</Text>
      </View>

      {/* Category Cards */}
      <View style={styles.list}>
        {loading ? (
          [1, 2, 3].map(i => <SkeletonCard key={i} />)
        ) : categories.length === 0 ? (
          <Text style={styles.emptyText}>Kategori bulunamadı.</Text>
        ) : (
          categories.map(cat => {
            const color = CATEGORY_COLORS[cat.slug] ?? '#263C84';
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.card, { backgroundColor: color }]}
                onPress={() => handleCategoryPress(cat)}
                activeOpacity={0.85}>
                <Text style={styles.cardText}>{cat.name.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 28,
  },
  headerLine: {
    fontSize: 32,
    fontWeight: '900',
    color: '#263C84',
    lineHeight: 38,
  },

  list: { paddingHorizontal: 16, gap: 14 },

  card: {
    height: 100,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  skeletonCard: {
    height: 100,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },

  emptyText: {
    textAlign: 'center',
    color: '#8A8A8A',
    fontSize: 15,
    marginTop: 40,
  },
});
