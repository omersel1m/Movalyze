import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, CameraPosition } from 'react-native-vision-camera';
import { Camera as CameraIcon } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutStackParamList } from '../../../navigation/WorkoutNavigator';
import CameraControls from '../components/CameraControls';
import { useBicepsCurlAnalyzer } from '../hooks/useBicepsCurlAnalyzer';

type Props = {
  navigation: NativeStackNavigationProp<WorkoutStackParamList, 'ExerciseCamera'>;
  route: RouteProp<WorkoutStackParamList, 'ExerciseCamera'>;
};

const SESSION_PHASE_LABELS: Record<string, string> = {
  idle:      'HAZIR',
  countdown: 'KALIBRE',
  tracking:  'TAKİP',
  stopped:   'DURDU',
};

function scoreColor(score: number): string {
  if (score >= 70) return '#22C55E';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

export default function ExerciseCameraScreen({ navigation, route }: Props) {
  const { exerciseName, categoryColor } = route.params;
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('front');

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice(cameraPosition);
  const insets = useSafeAreaInsets();
  const {
    frameProcessor,
    result,
    sessionPhase,
    countdownValue,
    reference,
    startSession,
    stopSession,
  } = useBicepsCurlAnalyzer();

  const isTracking = sessionPhase === 'tracking';

  const leftAngle       = result?.angles.leftElbow    ?? null;
  const rightAngle      = result?.angles.rightElbow   ?? null;
  const leftCount       = result?.leftRepCount        ?? 0;
  const rightCount      = result?.rightRepCount       ?? 0;
  const displayMode     = result?.displayMode         ?? 'bilateral';
  const leftPhase       = result?.leftPhase           ?? 'down';
  const rightPhase      = result?.rightPhase          ?? 'down';
  const anyUp           = leftPhase === 'up' || rightPhase === 'up';
  const liveFormScore   = result?.liveFormScore       ?? null;
  const lastRepScore    = result?.lastRepScore        ?? null;
  const lastRepWarnings = result?.lastRepWarnings     ?? [];

  const showStats = sessionPhase === 'tracking' || sessionPhase === 'stopped';

  const handleToggle = () => {
    if (sessionPhase === 'idle' || sessionPhase === 'stopped') {
      startSession();
    } else if (sessionPhase === 'tracking') {
      stopSession();
    }
    // countdown → no-op
  };

  if (!hasPermission) {
    return (
      <PermissionView
        onRequest={requestPermission}
        onBack={() => navigation.goBack()}
        categoryColor={categoryColor}
      />
    );
  }

  if (!device) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Kamera bulunamadı.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBack}>
          <Text style={styles.errorBackText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
      />

      {/* Countdown overlay */}
      {sessionPhase === 'countdown' && (
        <View style={styles.countdownOverlay} pointerEvents="none">
          <Text style={styles.countdownNumber}>{countdownValue}</Text>
          <Text style={styles.countdownSub}>hazırlan</Text>
        </View>
      )}

      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.exerciseName} numberOfLines={1}>
          {exerciseName}
        </Text>
        <View style={[styles.stateBadge, isTracking && styles.stateBadgeActive]}>
          {isTracking && <View style={styles.recDot} />}
          <Text style={[styles.stateBadgeText, isTracking && styles.stateBadgeTextActive]}>
            {SESSION_PHASE_LABELS[sessionPhase] ?? sessionPhase.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Bottom overlay */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 20 }]}>

        {/* Reference status */}
        {showStats && (
          <View style={styles.refRow}>
            <View style={[styles.refBadge, reference ? styles.refBadgeOk : styles.refBadgeMissing]}>
              <Text style={styles.refBadgeText}>
                {reference
                  ? `REF${reference.hasHip ? ' + KALÇA' : ''}`
                  : 'REF YOK'}
              </Text>
            </View>
          </View>
        )}

        {/* Rep count + Phase + Live form */}
        {showStats && (
          <View style={styles.statsRow}>
            <View style={styles.repChip}>
              <Text style={styles.repChipLabel}>TEKRAR</Text>
              {displayMode === 'alternating' ? (
                <Text style={styles.repChipValue}>
                  {leftCount}
                  <Text style={styles.repChipDivider}> | </Text>
                  {rightCount}
                </Text>
              ) : (
                <Text style={styles.repChipValue}>
                  {Math.max(leftCount, rightCount)}
                </Text>
              )}
              {displayMode === 'alternating' && (
                <Text style={styles.repChipSub}>SOL | SAĞ</Text>
              )}
            </View>

            <View style={styles.centerCol}>
              <View style={[styles.phasePill, anyUp ? styles.phasePillUp : styles.phasePillDown]}>
                <Text style={styles.phasePillText}>
                  {anyUp ? '▲  YUKARI' : '▼  AŞAĞI'}
                </Text>
              </View>
              {liveFormScore !== null && (
                <View style={[styles.formPill, { borderColor: scoreColor(liveFormScore) }]}>
                  <Text style={[styles.formPillText, { color: scoreColor(liveFormScore) }]}>
                    FORM {liveFormScore.toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Elbow angle chips */}
        <View style={styles.angleRow}>
          <View style={styles.angleChip}>
            <Text style={styles.angleChipLabel}>Sol Dirsek</Text>
            <Text style={styles.angleChipValue}>
              {leftAngle !== null ? `${Math.round(leftAngle)}°` : '—'}
            </Text>
          </View>
          <View style={styles.angleChip}>
            <Text style={styles.angleChipLabel}>Sağ Dirsek</Text>
            <Text style={styles.angleChipValue}>
              {rightAngle !== null ? `${Math.round(rightAngle)}°` : '—'}
            </Text>
          </View>
        </View>

        {/* Last rep score + warnings */}
        {showStats && lastRepScore !== null && (
          <View style={styles.repReportCard}>
            <Text style={[styles.repReportScore, { color: scoreColor(lastRepScore) }]}>
              Son Tekrar: {lastRepScore.toFixed(0)}%
            </Text>
            {lastRepWarnings.slice(0, 2).map((w, i) => (
              <Text key={i} style={styles.repReportWarn}>
                {'• '}{w}
              </Text>
            ))}
          </View>
        )}

        <CameraControls
          isTracking={isTracking}
          onToggle={handleToggle}
          onFlip={() => setCameraPosition(p => p === 'front' ? 'back' : 'front')}
        />
      </View>
    </View>
  );
}

// ── Permission Screen ─────────────────────────────────────────────
interface PermissionViewProps {
  onRequest: () => void;
  onBack: () => void;
  categoryColor: string;
}

function PermissionView({ onRequest, onBack, categoryColor }: PermissionViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.permissionRoot}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <TouchableOpacity
        onPress={onBack}
        style={[styles.permissionBackBtn, { top: insets.top + 10 }]}>
        <Text style={[styles.backIcon, { color: '#263C84' }]}>‹</Text>
      </TouchableOpacity>

      <View style={styles.permissionContent}>
        <View style={[styles.permissionIconCircle, { borderColor: categoryColor }]}>
          <CameraIcon size={40} color={categoryColor} strokeWidth={1.5} />
        </View>
        <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
        <Text style={styles.permissionDesc}>
          Egzersiz form analizini yapabilmek için{'\n'}kamera erişimi gerekmektedir.
        </Text>
        <TouchableOpacity
          style={[styles.permissionBtn, { backgroundColor: categoryColor }]}
          onPress={onRequest}
          activeOpacity={0.85}>
          <Text style={styles.permissionBtnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Countdown
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 130,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  countdownSub: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 8,
  },

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  backIcon: {
    fontSize: 36,
    lineHeight: 36,
    color: '#FFFFFF',
  },
  exerciseName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  stateBadge: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  stateBadgeActive: {},
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
  },
  stateBadgeTextActive: {
    color: '#EF4444',
  },

  // Reference status
  refRow: {
    marginBottom: 8,
  },
  refBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
  },
  refBadgeOk: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  refBadgeMissing: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  refBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  repChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    minWidth: 100,
  },
  repChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  repChipValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 40,
  },
  repChipDivider: {
    fontSize: 24,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
  },
  repChipSub: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  centerCol: {
    alignItems: 'center',
    gap: 8,
  },
  phasePill: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  phasePillUp: {
    backgroundColor: 'rgba(34, 197, 94, 0.85)',
  },
  phasePillDown: {
    backgroundColor: 'rgba(249, 115, 22, 0.85)',
  },
  phasePillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  formPill: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  formPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Angle display
  angleRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 10,
  },
  angleChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    minWidth: 110,
  },
  angleChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  angleChipValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
    height: 32,
    lineHeight: 32,
    minWidth: 72,
  },

  // Last rep report
  repReportCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    alignSelf: 'stretch',
    marginHorizontal: 16,
  },
  repReportScore: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  repReportWarn: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },

  // Bottom overlay
  bottomOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingTop: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },

  // Error
  errorContainer: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#ADADAD',
    fontWeight: '500',
  },
  errorBack: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#263C84',
  },
  errorBackText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Permission screen
  permissionRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBackBtn: {
    position: 'absolute',
    left: 12,
    padding: 4,
  },
  permissionContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 15,
    color: '#8A8A8A',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    marginTop: 8,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 24,
  },
  permissionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
