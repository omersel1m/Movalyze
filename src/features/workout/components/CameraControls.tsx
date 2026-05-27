import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface CameraControlsProps {
  isTracking: boolean;
  onToggle: () => void;
}

export default function CameraControls({ isTracking, onToggle }: CameraControlsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isTracking && styles.buttonActive]}
        onPress={onToggle}
        activeOpacity={0.85}>
        <Text style={[styles.label, isTracking && styles.labelActive]}>
          {isTracking ? 'Bitir' : 'Başlat'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
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
});
