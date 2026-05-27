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
import { RouteProp } from '@react-navigation/native';
import { WorkoutStackParamList } from '../../navigation/WorkoutNavigator';
import { workoutService } from '../../services/workout.service';
import { Exercise } from '../../database/models/types';

type Props = {
  navigation: NativeStackNavigationProp<WorkoutStackParamList, 'ExerciseList'>;
  route: RouteProp<WorkoutStackParamList, 'ExerciseList'>;
};

// ── Skeleton ─────────────────────────────────────────────────────
function SkeletonBox({ width, height }: { width: number; height: number }) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;
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
      style={{ width, height, borderRadius: 12, backgroundColor: '#E0E0E0', opacity }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────
export default function ExerciseListScreen({ navigation, route }: Props) {
  const { categoryId, categoryName, categoryColor } = route.params;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExercises = useCallback(async () => {
    try {
      const data = await workoutService.getExercisesByCategory(categoryId);
      setExercises(data);
    } catch (e: any) {
      Alert.alert('Hata', e.message ?? 'Egzersizler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => { fetchExercises(); }, [fetchExercises]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: categoryColor }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: categoryColor }]}>{categoryName}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Egzersizler — dikey liste */}
        <View style={styles.listSection}>
          {loading ? (
            [1, 2, 3, 4, 5].map(i => (
              <View key={i} style={styles.exerciseCard}>
                <SkeletonBox width={60} height={60} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <SkeletonBox width={160} height={16} />
                  <View style={{ marginTop: 8 }}>
                    <SkeletonBox width={100} height={12} />
                  </View>
                </View>
              </View>
            ))
          ) : exercises.length === 0 ? (
            <Text style={styles.emptyText}>Bu kategoride egzersiz bulunamadı.</Text>
          ) : (
            exercises.map(ex => (
              <TouchableOpacity
                key={ex.id}
                style={styles.exerciseCard}
                onPress={() => console.log('Exercise selected:', ex.name, ex.id)}
                activeOpacity={0.8}>
                <View style={[styles.exerciseImgPlaceholder, { borderColor: categoryColor }]} />
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={[styles.exerciseDifficulty, { color: categoryColor }]}>
                    {ex.difficulty_level}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: categoryColor }]}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { padding: 4, marginRight: 8 },
  backIcon: { fontSize: 36, lineHeight: 36 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: 1 },

  // Exercise List
  listSection: { paddingHorizontal: 16, gap: 10 },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  exerciseImgPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#F0F0F0',
  },
  exerciseInfo: { flex: 1, marginLeft: 14 },
  exerciseName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  exerciseDifficulty: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
  chevron: { fontSize: 24 },

  emptyText: {
    textAlign: 'center',
    color: '#8A8A8A',
    fontSize: 15,
    marginTop: 40,
  },
});
