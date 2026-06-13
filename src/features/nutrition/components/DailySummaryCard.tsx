import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getProgressRatio, getRemainingCalories } from '../logic/calculations';
import { NutritionGoals } from '../types/nutrition.types';

interface Props {
  consumed: number;
  goals: NutritionGoals;
}

function RingProgress({ ratio, color }: { ratio: number; color: string }) {
  const SIZE = 120;
  const STROKE = 10;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(ratio, 1));

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View
        style={{
          position: 'absolute',
          width: SIZE - STROKE,
          height: SIZE - STROKE,
          borderRadius: (SIZE - STROKE) / 2,
          borderWidth: STROKE,
          borderColor: '#F0F0F0',
        }}
      />
      {/* We approximate the fill arc using a View trick since SVG requires react-native-svg */}
      <View
        style={{
          position: 'absolute',
          width: SIZE - STROKE,
          height: SIZE - STROKE,
          borderRadius: (SIZE - STROKE) / 2,
          borderWidth: STROKE,
          borderColor: color,
          borderRightColor: ratio > 0.25 ? color : 'transparent',
          borderBottomColor: ratio > 0.5 ? color : 'transparent',
          borderLeftColor: ratio > 0.75 ? color : 'transparent',
          borderTopColor: ratio > 0 ? color : 'transparent',
          opacity: Math.min(ratio * 1.2, 1),
        }}
      />
      {/* SVG-less workaround: use a clip overlay */}
      <View
        style={{
          width: SIZE - STROKE * 2 - 4,
          height: SIZE - STROKE * 2 - 4,
          borderRadius: (SIZE - STROKE * 2 - 4) / 2,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 11, color: '#8A8A8A' }}>tüketilen</Text>
      </View>
    </View>
  );
}

export default function DailySummaryCard({ consumed, goals }: Props) {
  const ratio = getProgressRatio(consumed, goals.dailyCalories);
  const remaining = getRemainingCalories(consumed, goals.dailyCalories);
  const isOver = remaining < 0;
  const ringColor = isOver ? '#E53E3E' : '#263C84';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Günlük Kalori</Text>

      <View style={styles.content}>
        {/* Circular progress */}
        <View style={styles.ringWrapper}>
          <View style={styles.ringOuter}>
            <View
              style={[
                styles.ringTrack,
                { borderColor: '#F0F0F0' },
              ]}
            />
            <View
              style={[
                styles.ringFill,
                {
                  borderColor: ringColor,
                  opacity: 0.15 + ratio * 0.85,
                },
              ]}
            />
            <View style={styles.ringInner}>
              <Text style={[styles.consumedValue, { color: ringColor }]}>
                {Math.round(consumed)}
              </Text>
              <Text style={styles.consumedUnit}>kcal</Text>
            </View>
          </View>
        </View>

        {/* Stats column */}
        <View style={styles.statsCol}>
          <View style={styles.statRow}>
            <View style={[styles.dot, { backgroundColor: '#263C84' }]} />
            <View>
              <Text style={styles.statValue}>{goals.dailyCalories}</Text>
              <Text style={styles.statLabel}>Hedef</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={[styles.dot, { backgroundColor: '#F97316' }]} />
            <View>
              <Text style={styles.statValue}>{Math.round(consumed)}</Text>
              <Text style={styles.statLabel}>Tüketilen</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={[styles.dot, { backgroundColor: isOver ? '#E53E3E' : '#268479' }]} />
            <View>
              <Text style={[styles.statValue, { color: isOver ? '#E53E3E' : '#1A1A2E' }]}>
                {isOver ? `+${Math.abs(Math.round(remaining))}` : Math.round(remaining)}
              </Text>
              <Text style={styles.statLabel}>{isOver ? 'Aşıldı' : 'Kalan'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: ringColor },
          ]}
        />
      </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 16,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 10,
  },
  ringFill: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 10,
  },
  ringInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consumedValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  consumedUnit: {
    fontSize: 10,
    color: '#8A8A8A',
  },
  statsCol: {
    flex: 1,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  statLabel: {
    fontSize: 11,
    color: '#8A8A8A',
  },
  barBg: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
});
