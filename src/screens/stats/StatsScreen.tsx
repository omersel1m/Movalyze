import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { Calendar } from 'lucide-react-native';
import { supabase } from '../../config/supabaseClient';
import { statsService, AccuracyEntry, PeriodStats } from '../../services/stats.service';
import { statsRepository } from '../../repositories/stats.repository';
import { DailyStats } from '../../database/models/types';
import {
  getRecentDays, getRecentWeeks, getWeekStart,
  formatDayChip, formatDayFull, formatWeekChip, formatWeekFull,
  dayRangeISO, weekRangeISO, isSameDay, isSameWeek,
} from '../../utils/dateUtils';
import { ERROR_CODE_LABELS as BICEPS_LABELS } from '../../features/workout/logic/constants/bicepsErrorCodes';
import { ERROR_CODE_LABELS as KNEE_LABELS } from '../../features/workout/logic/constants/kneeRaiseErrorCodes';
import { ERROR_CODE_LABELS as SHOULDER_LABELS } from '../../features/workout/logic/constants/shoulderAbductionErrorCodes';

// All error-code → Turkish label maps merged, so the breakdown reads correctly
// for every category's errors.
const ERROR_CODE_LABELS: Record<string, string> = {
  ...BICEPS_LABELS,
  ...KNEE_LABELS,
  ...SHOULDER_LABELS,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Fitness',  slug: 'fitness'  },
  { label: 'Therapy',  slug: 'therapy'  },
  { label: 'Pilates',  slug: 'pilates'  },
];

const RECENT_DAYS  = getRecentDays(30);   // last 30 days
const RECENT_WEEKS = getRecentWeeks(12);  // last 12 calendar weeks

const ACCENT = '#268479';

// Per-category theme color. When no category is selected, the page falls back
// to the fitness accent.
const CATEGORY_COLORS: Record<string, string> = {
  fitness: '#268479',
  therapy: '#AEBC2E',
  pilates: '#CB8510',
};

// Donut / legend palette harmonious with each category color — distinct shades
// of the same hue so every error type is its own colour but stays on-theme.
const CATEGORY_PALETTES: Record<string, string[]> = {
  fitness: ['#268479', '#3FA796', '#5DB8AE', '#86CEC6', '#B6E2DC'],
  therapy: ['#9AAA1E', '#AEBC2E', '#BFCB4F', '#CFD877', '#DEE59E'],
  pilates: ['#CB8510', '#D99B33', '#E5B25C', '#EFC987', '#F6DDB4'],
};

// 10% opacity tint of a hex color for soft backgrounds.
function tint(hex: string): string {
  return hex + '1A';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

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

// ── Donut Placeholder ─────────────────────────────────────────────────────────

function DonutPlaceholder({ colors }: { colors: string[] }) {
  return (
    <View style={donutStyles.root}>
      <View
        style={[
          donutStyles.outerRing,
          {
            borderColor:       colors[0],
            borderTopColor:    colors[1] ?? colors[0],
            borderRightColor:  colors[2] ?? colors[0],
            borderBottomColor: colors[3] ?? colors[0],
          },
        ]}>
        <View style={donutStyles.innerHole} />
      </View>
    </View>
  );
}
const donutStyles = StyleSheet.create({
  root: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  outerRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  innerHole: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF' },
});

// ── Main Component ────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const today      = RECENT_DAYS[0];
  const thisWeek   = RECENT_WEEKS[0];

  const [activeTab,        setActiveTab]        = useState<'Daily' | 'Weekly'>('Daily');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDate,     setSelectedDate]     = useState<Date>(today);
  const [selectedWeek,     setSelectedWeek]     = useState<Date>(thisWeek);
  const [showDateModal,    setShowDateModal]     = useState(false);
  const [showWeekModal,    setShowWeekModal]     = useState(false);

  // Legacy accuracy card data
  const [dailyStats,          setDailyStats]          = useState<DailyStats | null>(null);
  const [exerciseCategoryMap, setExerciseCategoryMap] = useState<Array<{ exerciseSlug: string; categorySlug: string }>>([]);

  // New dynamic period stats
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Kullanıcı bulunamadı.'); return; }

      if (activeTab === 'Daily') {
        const [stats, catMap, period] = await Promise.all([
          statsService.getDailyStats(user.id),
          statsRepository.getExercisesWithCategory(),
          statsService.getDayStats(user.id, selectedDate, selectedCategory),
        ]);
        setDailyStats(stats);
        setExerciseCategoryMap(catMap);
        setPeriodStats(period);
      } else {
        const [catMap, period] = await Promise.all([
          statsRepository.getExercisesWithCategory(),
          statsService.getWeekStats(user.id, selectedWeek, selectedCategory),
        ]);
        setExerciseCategoryMap(catMap);
        setPeriodStats(period);
      }
    } catch (e: any) {
      setError(e.message ?? 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDate, selectedWeek, selectedCategory]);

  useEffect(() => { loadData(); }, [loadData]);

  const accuracyList: AccuracyEntry[] = dailyStats
    ? statsService.filterAccuracyByCategory(
        dailyStats.accuracy_by_exercise,
        exerciseCategoryMap,
        selectedCategory,
      )
    : [];

  const overallAccuracy = dailyStats?.avg_accuracy_pct ?? null;
  const { formImprovement, mostCommon, errorBreakdown } = periodStats ?? {
    formImprovement: { currentAvg: null, previousAvg: null, changePct: null },
    mostCommon: [],
    errorBreakdown: [],
  };

  const periodLabel = activeTab === 'Daily'
    ? formatDayFull(selectedDate)
    : formatWeekFull(selectedWeek);

  // Page theme follows the selected category (defaults to fitness accent).
  const theme   = selectedCategory ? (CATEGORY_COLORS[selectedCategory] ?? ACCENT) : ACCENT;
  const palette = CATEGORY_PALETTES[selectedCategory ?? 'fitness'] ?? CATEGORY_PALETTES.fitness;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>İstatistik</Text>
          {/* Period label + picker button */}
          <TouchableOpacity
            style={[styles.periodBtn, { backgroundColor: tint(theme) }]}
            onPress={() => activeTab === 'Daily' ? setShowDateModal(true) : setShowWeekModal(true)}>
            <Calendar size={14} color={theme} strokeWidth={2} />
            <Text style={[styles.periodBtnText, { color: theme }]} numberOfLines={1}>
              {activeTab === 'Daily'
                ? formatDayChip(selectedDate) + ' ' + selectedDate.getFullYear()
                : formatWeekChip(selectedWeek)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Daily / Weekly Tabs */}
        <View style={styles.tabs}>
          {(['Daily', 'Weekly'] as const).map(tab => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
              <Text style={[styles.tabText, activeTab === tab && { color: theme }]}>
                {tab === 'Daily' ? 'Günlük' : 'Haftalık'}
              </Text>
              {activeTab === tab && <View style={[styles.tabUnderline, { backgroundColor: theme }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Category Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {CATEGORIES.map(cat => {
            const active   = selectedCategory === cat.slug;
            const catColor = CATEGORY_COLORS[cat.slug] ?? ACCENT;
            return (
              <TouchableOpacity
                key={cat.slug}
                style={[styles.pill, { borderColor: catColor }, active && { backgroundColor: catColor }]}
                onPress={() => setSelectedCategory(active ? null : cat.slug)}>
                <Text style={[styles.pillText, { color: active ? '#FFFFFF' : catColor }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Most Common Exercises ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>En Sık Yapılan Egzersizler</Text>
          {loading ? (
            <View style={{ gap: 8 }}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="50%" height={16} />
              <Skeleton width="40%" height={16} />
            </View>
          ) : !periodStats?.hasData ? (
            <Text style={styles.emptyText}>Henüz istatistik yok.</Text>
          ) : mostCommon.length === 0 ? (
            <Text style={styles.emptyText}>Bu kategoride veri yok.</Text>
          ) : (
            <View style={styles.commonRow}>
              {mostCommon.slice(0, 3).map(item => (
                <View key={item.slug} style={styles.commonBox}>
                  <Text style={[styles.commonReps, { color: theme }]}>{item.totalReps}</Text>
                  <Text style={styles.commonRepsLabel}>tekrar</Text>
                  <Text style={styles.commonName}>{item.name}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Form Improvement ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {activeTab === 'Daily' ? 'Günlük Form Gelişimi' : 'Haftalık Form Gelişimi'}
          </Text>
          {loading ? (
            <View style={{ gap: 8 }}>
              <Skeleton width={100} height={40} />
              <Skeleton width={160} height={16} />
            </View>
          ) : !periodStats?.hasData || formImprovement.currentAvg === null ? (
            <Text style={styles.emptyText}>Henüz istatistik yok.</Text>
          ) : (
            <>
              <View style={styles.improvementRow}>
                <Text style={styles.improvementScore}>
                  {Math.round(formImprovement.currentAvg)}
                  <Text style={styles.improvementUnit}>%</Text>
                </Text>
                <View style={styles.improvementMeta}>
                  <Text style={[
                    styles.improvementChange,
                    { color: statsService.changeColor(formImprovement.changePct) },
                  ]}>
                    {statsService.formatChange(formImprovement.changePct)}
                  </Text>
                  <Text style={styles.improvementSub}>
                    {activeTab === 'Daily' ? 'önceki güne göre' : 'önceki haftaya göre'}
                  </Text>
                </View>
              </View>
              {formImprovement.previousAvg !== null && (
                <Text style={styles.improvementPrev}>
                  Önceki: {Math.round(formImprovement.previousAvg)}%
                </Text>
              )}
            </>
          )}
        </View>

        {/* ── Form Error Breakdown ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hata Dağılımı</Text>
          {loading ? (
            <Skeleton width="100%" height={80} />
          ) : !periodStats?.hasData || errorBreakdown.length === 0 ? (
            <View style={styles.donutRow}>
              <DonutPlaceholder colors={palette} />
              <Text style={[styles.emptyText, { marginLeft: 16 }]}>
                {periodStats?.hasData ? 'Hata kaydı yok.' : 'Henüz istatistik yok.'}
              </Text>
            </View>
          ) : (
            <View style={styles.donutRow}>
              <DonutPlaceholder colors={palette} />
              <View style={styles.legendCol}>
                {errorBreakdown.slice(0, 4).map((e, i) => {
                  const label = (ERROR_CODE_LABELS as Record<string, string>)[e.errorCode] ?? e.errorCode;
                  return (
                    <View key={e.errorCode} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: palette[i % palette.length] }]} />
                      <Text style={styles.legendText}>{label}</Text>
                      <Text style={styles.legendCount}>{e.totalCount}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* ── Correct Repetition Rate (legacy accuracy card) ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tekrar Doğruluk Oranı</Text>
          {loading ? (
            <View style={{ gap: 8, marginTop: 4 }}>
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
                <Text style={styles.overallLabel}>Genel Form Doğruluğu</Text>
              </View>
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
                            { width: `${entry.avg_accuracy}%`, backgroundColor: statsService.accuracyColor(entry.avg_accuracy) },
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

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── Day / Week Selector ─────────────────────────────────── */}
      <View style={styles.selectorBar}>
        {activeTab === 'Daily' ? (
          <DaySelector
            days={RECENT_DAYS}
            selected={selectedDate}
            onSelect={setSelectedDate}
            onOpenModal={() => setShowDateModal(true)}
            theme={theme}
          />
        ) : (
          <WeekSelector
            weeks={RECENT_WEEKS}
            selected={selectedWeek}
            onSelect={setSelectedWeek}
            onOpenModal={() => setShowWeekModal(true)}
            theme={theme}
          />
        )}
      </View>

      {/* ── Date Picker Modal ────────────────────────────────────── */}
      <Modal visible={showDateModal} transparent animationType="slide" onRequestClose={() => setShowDateModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDateModal(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Gün Seç</Text>
            <FlatList
              data={RECENT_DAYS}
              keyExtractor={d => d.toISOString()}
              renderItem={({ item }) => {
                const isSelected = isSameDay(item, selectedDate);
                const isToday    = isSameDay(item, today);
                return (
                  <TouchableOpacity
                    style={[styles.modalRow, isSelected && { backgroundColor: tint(theme) }]}
                    onPress={() => { setSelectedDate(item); setShowDateModal(false); }}>
                    <Text style={[styles.modalRowText, isSelected && { color: theme, fontWeight: '700' }]}>
                      {formatDayFull(item)}
                      {isToday ? ' (Bugün)' : ''}
                    </Text>
                    {isSelected && <Text style={[styles.modalCheck, { color: theme }]}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Week Picker Modal ────────────────────────────────────── */}
      <Modal visible={showWeekModal} transparent animationType="slide" onRequestClose={() => setShowWeekModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowWeekModal(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Hafta Seç</Text>
            <FlatList
              data={RECENT_WEEKS}
              keyExtractor={d => d.toISOString()}
              renderItem={({ item }) => {
                const isSelected = isSameWeek(item, selectedWeek);
                const isThis     = isSameWeek(item, thisWeek);
                return (
                  <TouchableOpacity
                    style={[styles.modalRow, isSelected && { backgroundColor: tint(theme) }]}
                    onPress={() => { setSelectedWeek(item); setShowWeekModal(false); }}>
                    <Text style={[styles.modalRowText, isSelected && { color: theme, fontWeight: '700' }]}>
                      {formatWeekFull(item)}
                      {isThis ? ' (Bu Hafta)' : ''}
                    </Text>
                    {isSelected && <Text style={[styles.modalCheck, { color: theme }]}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Day Selector ──────────────────────────────────────────────────────────────

interface DaySelectorProps {
  days: Date[];
  selected: Date;
  onSelect: (d: Date) => void;
  onOpenModal: () => void;
  theme: string;
}

function DaySelector({ days, selected, onSelect, onOpenModal, theme }: DaySelectorProps) {
  const scrollRef = useRef<ScrollView>(null);
  const today = days[0];

  return (
    <View style={styles.selectorInner}>
      <View style={styles.selectorHeader}>
        <Text style={styles.selectorHeaderLabel}>
          {isSameDay(selected, today) ? 'Bugün' : formatDayFull(selected)}
        </Text>
        <TouchableOpacity onPress={onOpenModal} style={[styles.selectorPickerBtn, { backgroundColor: tint(theme) }]}>
          <Calendar size={14} color={theme} strokeWidth={2} />
          <Text style={[styles.selectorPickerText, { color: theme }]}>Tarih Seç</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.selectorScroll}>
        {days.map((day, i) => {
          const isSelected = isSameDay(day, selected);
          const isToday    = i === 0;
          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={[styles.dayChip, isSelected && { backgroundColor: theme }]}
              onPress={() => onSelect(day)}>
              <Text style={[styles.dayChipNum, isSelected && styles.dayChipTextSelected]}>
                {day.getDate()}
              </Text>
              <Text style={[styles.dayChipMon, isSelected && styles.dayChipTextSelected]}>
                {isToday ? 'Bugün' : formatDayChip(day).split(' ')[1]}
              </Text>
              {isSelected && <View style={styles.dayChipDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Week Selector ─────────────────────────────────────────────────────────────

interface WeekSelectorProps {
  weeks: Date[];
  selected: Date;
  onSelect: (w: Date) => void;
  onOpenModal: () => void;
  theme: string;
}

function WeekSelector({ weeks, selected, onSelect, onOpenModal, theme }: WeekSelectorProps) {
  const thisWeek = weeks[0];
  return (
    <View style={styles.selectorInner}>
      <View style={styles.selectorHeader}>
        <Text style={styles.selectorHeaderLabel}>
          {isSameWeek(selected, thisWeek) ? 'Bu Hafta' : formatWeekChip(selected)}
        </Text>
        <TouchableOpacity onPress={onOpenModal} style={[styles.selectorPickerBtn, { backgroundColor: tint(theme) }]}>
          <Calendar size={14} color={theme} strokeWidth={2} />
          <Text style={[styles.selectorPickerText, { color: theme }]}>Hafta Seç</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.selectorScroll}>
        {weeks.map((week, i) => {
          const isSelected = isSameWeek(week, selected);
          return (
            <TouchableOpacity
              key={week.toISOString()}
              style={[styles.dayChip, styles.weekChip, isSelected && { backgroundColor: theme }]}
              onPress={() => onSelect(week)}>
              <Text style={[styles.dayChipNum, styles.weekChipText, isSelected && styles.dayChipTextSelected]}>
                {formatWeekChip(week)}
              </Text>
              {i === 0 && (
                <Text style={[styles.dayChipMon, isSelected && styles.dayChipTextSelected]}>
                  Bu Hafta
                </Text>
              )}
              {isSelected && <View style={styles.dayChipDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingBottom: 8 },

  // Page header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#EBF5F4',
  },
  periodBtnText: { fontSize: 13, fontWeight: '600', color: ACCENT },

  // Tabs
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
  tabBtn: { marginRight: 20, paddingBottom: 4 },
  tabText: { fontSize: 15, fontWeight: '600', color: '#ADADAD' },
  tabTextActive: { color: ACCENT },
  tabUnderline: { height: 2, backgroundColor: ACCENT, borderRadius: 2, marginTop: 2 },

  // Category filter
  filterRow: { paddingHorizontal: 20, marginBottom: 12 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: ACCENT,
    marginRight: 8,
  },
  pillActive: { backgroundColor: ACCENT },
  pillText: { fontSize: 13, fontWeight: '600', color: ACCENT },
  pillTextActive: { color: '#FFFFFF' },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },

  // Most Common
  commonRow: { flexDirection: 'row', justifyContent: 'space-around' },
  commonBox: { alignItems: 'center', flex: 1 },
  commonReps: { fontSize: 28, fontWeight: '900', color: ACCENT },
  commonRepsLabel: { fontSize: 10, color: '#8A8A8A', marginBottom: 2 },
  commonName: { fontSize: 11, fontWeight: '600', color: '#1A1A2E', textAlign: 'center' },

  // Form Improvement
  improvementRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  improvementScore: { fontSize: 44, fontWeight: '900', color: '#1A1A2E' },
  improvementUnit: { fontSize: 22, fontWeight: '600', color: '#8A8A8A' },
  improvementMeta: { gap: 2 },
  improvementChange: { fontSize: 18, fontWeight: '800' },
  improvementSub: { fontSize: 11, color: '#8A8A8A' },
  improvementPrev: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },

  // Accuracy
  overallRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  overallPct: { fontSize: 40, fontWeight: '900', color: '#1A1A2E', marginRight: 8 },
  overallLabel: { fontSize: 13, color: '#8A8A8A', marginBottom: 6 },
  accuracyList: { gap: 10, marginTop: 4 },
  accuracyRow: { flexDirection: 'row', alignItems: 'center' },
  accuracyName: { width: 110, fontSize: 13, color: '#1A1A2E', textTransform: 'capitalize' },
  accuracyBarBg: { flex: 1, height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginHorizontal: 8 },
  accuracyBarFill: { height: 6, borderRadius: 3 },
  accuracyPct: { width: 38, fontSize: 13, fontWeight: '700', textAlign: 'right' },

  // Error breakdown
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  legendCol: { flex: 1, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, fontSize: 12, color: '#1A1A2E' },
  legendCount: { fontSize: 12, fontWeight: '700', color: '#8A8A8A' },

  // States
  errorText: { color: '#E53E3E', fontSize: 13, marginTop: 8 },
  emptyText: { color: '#8A8A8A', fontSize: 13, marginTop: 4 },

  // ── Day/Week Selector Bar ────────────────────────────────────────────────
  selectorBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },
  selectorInner: { paddingTop: 10 },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  selectorHeaderLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  selectorPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#EBF5F4',
  },
  selectorPickerText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },
  selectorScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  dayChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    minWidth: 52,
    gap: 2,
  },
  dayChipSelected: {
    backgroundColor: ACCENT,
  },
  dayChipNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  dayChipMon: {
    fontSize: 9,
    fontWeight: '600',
    color: '#8A8A8A',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dayChipTextSelected: {
    color: '#FFFFFF',
  },
  dayChipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  weekChip: {
    minWidth: 80,
    paddingHorizontal: 12,
  },
  weekChipText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Modal ────────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 4,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  modalRowSelected: {
    backgroundColor: '#EBF5F4',
  },
  modalRowText: {
    fontSize: 15,
    color: '#1A1A2E',
    fontWeight: '500',
  },
  modalRowTextSelected: {
    color: ACCENT,
    fontWeight: '700',
  },
  modalCheck: {
    fontSize: 16,
    color: ACCENT,
    fontWeight: '800',
  },
});
