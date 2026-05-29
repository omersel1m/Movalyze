import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Camera as CameraIcon } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkoutStackParamList } from '../../../navigation/WorkoutNavigator';
import CameraControls from '../components/CameraControls';
import { usePoseDetection } from '../hooks/usePoseDetection';

type Props = {
  navigation: NativeStackNavigationProp<WorkoutStackParamList, 'ExerciseCamera'>;
  route: RouteProp<WorkoutStackParamList, 'ExerciseCamera'>;
};

export default function ExerciseCameraScreen({ navigation, route }: Props) {
  const { exerciseName, categoryColor } = route.params;
  const [isTracking, setIsTracking] = useState(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const insets = useSafeAreaInsets();
  const { frameProcessor } = usePoseDetection();

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
        {isTracking ? (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        ) : (
          <View style={styles.badgeSpacer} />
        )}
      </View>

      {/* Bottom overlay */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 20 }]}>
        <CameraControls
          isTracking={isTracking}
          onToggle={() => setIsTracking(prev => !prev)}
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

  // Top overlay
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
  recBadge: {
    width: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 1,
  },
  badgeSpacer: {
    width: 56,
  },

  // Bottom overlay
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },

  // No device error
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
