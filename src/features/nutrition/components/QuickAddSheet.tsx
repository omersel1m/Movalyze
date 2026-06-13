import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Zap } from 'lucide-react-native';
import { MealType } from '../types/nutrition.types';
import { MEAL_LABELS, MEAL_ORDER } from '../logic/meal-types';

interface Props {
  visible: boolean;
  defaultMeal?: MealType;
  onClose: () => void;
  onSubmit: (meal: MealType, kcal: number, label: string) => void;
}

export default function QuickAddSheet({ visible, defaultMeal, onClose, onSubmit }: Props) {
  const [selectedMeal, setSelectedMeal] = useState<MealType>(defaultMeal ?? 'breakfast');
  const [calories, setCalories] = useState('');
  const [label, setLabel] = useState('');

  const handleSubmit = () => {
    const kcal = parseFloat(calories);
    if (!kcal || kcal <= 0) return;
    onSubmit(selectedMeal, kcal, label);
    setCalories('');
    setLabel('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Zap size={18} color="#F97316" strokeWidth={1.75} />
                <Text style={styles.title}>Hızlı Kalori Ekle</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={20} color="#8A8A8A" strokeWidth={1.75} />
              </TouchableOpacity>
            </View>

            {/* Meal selector */}
            <Text style={styles.label}>Öğün</Text>
            <View style={styles.mealPills}>
              {MEAL_ORDER.map(meal => (
                <TouchableOpacity
                  key={meal}
                  style={[styles.pill, selectedMeal === meal && styles.pillActive]}
                  onPress={() => setSelectedMeal(meal)}
                >
                  <Text style={[styles.pillText, selectedMeal === meal && styles.pillTextActive]}>
                    {MEAL_LABELS[meal]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Calorie input */}
            <Text style={styles.label}>Kalori (kcal)</Text>
            <TextInput
              style={styles.input}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="örn. 350"
              placeholderTextColor="#ADADAD"
              returnKeyType="done"
            />

            {/* Label input */}
            <Text style={styles.label}>Etiket (opsiyonel)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="örn. Ev yemeği, Restoran"
              placeholderTextColor="#ADADAD"
              returnKeyType="done"
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, !calories && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!calories}
            >
              <Text style={styles.submitText}>Ekle</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8A',
    marginBottom: 8,
  },
  mealPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  pillActive: {
    backgroundColor: '#263C84',
    borderColor: '#263C84',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#F97316',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#E0E0E0',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
