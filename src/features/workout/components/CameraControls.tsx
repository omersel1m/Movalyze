import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

interface CameraControlsProps {
  isTracking: boolean;
  onToggle: () => void;
  onFlip: () => void;
}

export default function CameraControls({ isTracking, onToggle, onFlip }: CameraControlsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.flipButton}
        onPress={onFlip}
        activeOpacity={0.75}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <RefreshCw size={22} color="#FFFFFF" strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isTracking && styles.buttonActive]}
        onPress={onToggle}
        activeOpacity={0.85}>
        <Text style={[styles.label, isTracking && styles.labelActive]}>
          {isTracking ? 'Bitir' : 'Başlat'}
        </Text>
      </TouchableOpacity>

      {/* simetri için boşluk */}
      <View style={styles.flipButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 8,
  },
  button: {
    width: 144,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonActive: {
    backgroundColor: '#F97316',
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: '#263C84',
    letterSpacing: 0.4,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
