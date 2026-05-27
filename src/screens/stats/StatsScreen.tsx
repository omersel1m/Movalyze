import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Pencil } from 'lucide-react-native';
import { supabase } from '../../config/supabaseClient';
import { statsService, AccuracyEntry } from '../../services/stats.service';
import { statsRepository } from '../../repositories/stats.repository';
import { DailyStats } from '../../database/models/types';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Therapy', slug: 'therapy' },
  { label: 'Fitness', slug: 'fitness' },
  { label: 'Pilates', slug: 'pilates' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHART_DATA = [38, 55, 42, 68, 50, 74, 60, 78, 58, 82];
const MOCK_COMMON = [
  { name: 'Squat', reps: 340 },
  { name: 'Biceps Curl', reps: 265 },
  { name: 'I. Dumbell P.', reps: 345 },
];

// ─────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────

function Skeleton({ width, height, style }: { width: number | string; height: number; style?: object }) {
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
    <Animated.View style={[{ width, height, borderRadius: 8, backgroundColor: '#E0E0E0', opacity }, style]} />
  );
}

// ─────────────────────────────────────────────────────────────────
// Passive: Mini Bar Chart
// ─────────────────────────────────────────────────────────────────

function MiniBarChart() {
  return (
    <View style={chartStyles.root}>
      {CHART_DATA.map((val, i) => (
        <View key={i} style={chartStyles.barWrapper}>
          <View style={[chartStyles.bar, { height: (val / 100) * 64, opacity: 0.5 + i * 0.04 }]} />
        </View>
      ))}
    </View>
  );
}
const chartStyles = StyleSheet.create({
  root: { flexDirection: 'row', height: 72, alignItems: 'flex-end', gap: 4 },
  barWrapper: { flex: 1 },
  bar: { backgroundColor: '#268479', borderRadius: 3 },
});

// ─────────────────────────────────────────────────────────────────
// Passive: Donut Placeholder
// ─────────────────────────────────────────────────────────────────

function DonutPlaceholder() {
  return (
    <View style={donutStyles.root}>
      <View style={donutStyles.outerRing}>
        <View style={donutStyles.innerHole} />
      </View>
    </View>
  );
}
const donutStyles = StyleSheet.create({
  root: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  outerRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 24,
    borderColor: '#268479',
    borderTopColor: '#5DB8AE',
    borderRightColor: '#AEBC2E',
    borderBottomColor: '#C5E8E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerHole: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFFFFF' },
});

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const [activeTab, setActiveTab] = useState<'Daily' | 'Weekly'>('Daily');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [exerciseCategoryMap, setExerciseCategoryMap] = useState<
    Array<{ exerciseSlug: string; categorySlug: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Kullanıcı bulunamadı.'); return; }

      const [stats, catMap] = await Promise.all([
        statsService.getDailyStats(user.id),
        statsRepository.getExercisesWithCategory(),
      ]);

      setDailyStats(stats);
      setExerciseCategoryMap(catMap);
    } catch (e: any) {
      setError(e.message ?? 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const accuracyList: AccuracyEntry[] = dailyStats
    ? statsService.filterAccuracyByCategory(
        dailyStats.accuracy_by_exercise,
        exerciseCategoryMap,
        selectedCategory,
      )
    : [];

  const overallAccuracy = dailyStats?.avg_accuracy_pct ?? null;

  // ── Render ────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Stats</Text>
      </View>

      {/* Daily / Weekly Tabs */}
      <View style={styles.tabs}>
        {(['Daily', 'Weekly'] as const).map(tab => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Correct Repetition Rate ── [ACTIVE] */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Correct Repetition Rate</Text>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {CATEGORIES.map(cat => {
            const active = selectedCategory === cat.slug;
            return (
              <TouchableOpacity
                key={cat.slug}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setSelectedCategory(active ? null : cat.slug)}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Overall Accuracy */}
        {loading ? (
          <View style={{ gap: 8, marginTop: 12 }}>
            <Skeleton width={120} height={40} />
            <Skeleton width={180} height={16} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : dailyStats === null ? (
          <Text style={styles.emptyText}>Henüz istatistik yok.</Text>
        ) : (
          <>
            <View style={styles.overallRow}>
              <Text style={styles.overallPct}>
                {overallAccuracy !== null ? `${Math.round(overallAccuracy)}%` : '—'}
              </Text>
              <Text style={styles.overallLabel}>Overall Form Accuracy</Text>
            </View>
            <Text style={styles.weekChange}>This week +10%</Text>

            {/* Exercise Accuracy List */}
            <View style={styles.accuracyList}>
              {accuracyList.length === 0 ? (
                <Text style={styles.emptyText}>Bu kategoride veri yok.</Text>
              ) : (
                accuracyList.map(entry => (
                  <View key={entry.slug} style={styles.accuracyRow}>
                    <Text style={styles.accuracyName}>{entry.slug.replace(/_/g, ' ')}</Text>
                    <View style={styles.accuracyBarBg}>
                      <View
                        style={[
                          styles.accuracyBarFill,
                          {
                            width: `${entry.avg_accuracy}%`,
                            backgroundColor: statsService.accuracyColor(entry.avg_accuracy),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.accuracyPct, { color: statsService.accuracyColor(entry.avg_accuracy) }]}>
                      {Math.round(entry.avg_accuracy)}%
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </View>

      {/* ── Most Common Exercises ── [PASSIVE] */}
      <View style={[styles.card, styles.passive]}>
        <Text style={styles.cardTitle}>Most Common Exercises</Text>
        <View style={styles.commonRow}>
          {MOCK_COMMON.map(item => (
            <View key={item.name} style={styles.commonBox}>
              <Text style={styles.commonReps}>{item.reps}</Text>
              <Text style={styles.commonRepsLabel}>Reps</Text>
              <Text style={styles.commonName}>{item.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Weekly Form Improvement ── [PASSIVE] */}
      <View style={[styles.card, styles.passive]}>
        <Text style={styles.cardTitle}>Weekly Form Improvement</Text>
        <Text style={styles.improvementPct}>+5% <Text style={styles.improvementSub}>Last week</Text></Text>
        <MiniBarChart />
        <View style={styles.weekLabels}>
          {['Week 15', 'Week 16', 'Week 17', 'Week 18', 'Week 19'].map(w => (
            <Text key={w} style={styles.weekLabel}>{w}</Text>
          ))}
        </View>
      </View>

      {/* ── Form Error Breakdown ── [PASSIVE] */}
      <View style={[styles.card, styles.passive]}>
        <Text style={styles.cardTitle}>Form Error Breakdown</Text>
        <TouchableOpacity style={styles.filterDropdown} disabled>
          <Text style={styles.filterDropdownText}>General ▾</Text>
        </TouchableOpacity>
        <View style={styles.donutRow}>
          <DonutPlaceholder />
          <View style={styles.legendCol}>
            {['#268479', '#5DB8AE', '#AEBC2E', '#C5E8E5'].map((color, i) => (
              <View key={i} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>General</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── AI Suggestion ── [PASSIVE] */}
      <View style={[styles.card, styles.passive]}>
        <View style={styles.aiRow}>
          <Pencil size={16} color="#268479" strokeWidth={1.75} />
          <Text style={styles.aiText}>
            Squat performansın %10 arttı, ancak shoulder press formun zayıftır. Omuz hizasına dikkat et.
          </Text>
        </View>
      </View>

      {/* ── Activity Bar Mon–Sun ── [PASSIVE] */}
      <View style={[styles.card, styles.passive]}>
        <View style={styles.activityRow}>
          {DAYS.map((day, i) => (
            <View key={day} style={styles.dayCol}>
              <View style={[styles.dayDot, i < 3 && styles.dayDotActive]} />
              <Text style={styles.dayLabel}>{day}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  // Page header
  pageHeader: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },

  // Tabs
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 12 },
  tabBtn: { marginRight: 20, paddingBottom: 4 },
  tabText: { fontSize: 15, fontWeight: '600', color: '#ADADAD' },
  tabTextActive: { color: '#268479' },
  tabUnderline: { height: 2, backgroundColor: '#268479', borderRadius: 2, marginTop: 2 },

  // Cards
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
  passive: { opacity: 0.5 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },

  // Category filter pills
  filterRow: { marginBottom: 14 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#268479',
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#268479' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#268479' },
  pillTextActive: { color: '#FFFFFF' },

  // Overall accuracy
  overallRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  overallPct: { fontSize: 40, fontWeight: '900', color: '#1A1A2E', marginRight: 8 },
  overallLabel: { fontSize: 13, color: '#8A8A8A', marginBottom: 6 },
  weekChange: { fontSize: 12, color: '#268479', fontWeight: '600', marginBottom: 14 },

  // Accuracy list
  accuracyList: { gap: 10 },
  accuracyRow: { flexDirection: 'row', alignItems: 'center' },
  accuracyName: { width: 110, fontSize: 13, color: '#1A1A2E', textTransform: 'capitalize' },
  accuracyBarBg: { flex: 1, height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginHorizontal: 8 },
  accuracyBarFill: { height: 6, borderRadius: 3 },
  accuracyPct: { width: 38, fontSize: 13, fontWeight: '700', textAlign: 'right' },

  // Most Common
  commonRow: { flexDirection: 'row', justifyContent: 'space-around' },
  commonBox: { alignItems: 'center' },
  commonReps: { fontSize: 28, fontWeight: '900', color: '#268479' },
  commonRepsLabel: { fontSize: 11, color: '#8A8A8A' },
  commonName: { fontSize: 11, fontWeight: '600', color: '#1A1A2E', textAlign: 'center', marginTop: 2 },

  // Weekly improvement
  improvementPct: { fontSize: 26, fontWeight: '900', color: '#268479', marginBottom: 12 },
  improvementSub: { fontSize: 13, fontWeight: '400', color: '#8A8A8A' },
  weekLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  weekLabel: { fontSize: 10, color: '#8A8A8A' },

  // Error Breakdown
  filterDropdown: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  filterDropdownText: { fontSize: 13, color: '#1A1A2E' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  legendCol: { gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#1A1A2E' },

  // AI Suggestion
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  aiText: { flex: 1, fontSize: 12, color: '#1A1A2E', lineHeight: 18, fontStyle: 'italic' },

  // Activity bar
  activityRow: { flexDirection: 'row', justifyContent: 'space-around' },
  dayCol: { alignItems: 'center', gap: 4 },
  dayDot: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#E0E0E0' },
  dayDotActive: { backgroundColor: '#268479' },
  dayLabel: { fontSize: 10, color: '#8A8A8A' },

  // States
  errorText: { color: '#E53E3E', fontSize: 13, marginTop: 8 },
  emptyText: { color: '#8A8A8A', fontSize: 13, marginTop: 8 },
});
