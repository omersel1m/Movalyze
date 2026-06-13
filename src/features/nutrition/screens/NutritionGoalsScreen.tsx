import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Target } from 'lucide-react-native';

import { useNutritionGoals } from '../hooks/useNutritionGoals';

export default function NutritionGoalsScreen() {
  const navigation = useNavigation();
  const { goals, loading, saving, saveGoals } = useNutritionGoals();

  const [calories, setCalories] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [fatG, setFatG] = useState('');
  const [waterMl, setWaterMl] = useState('');
  const [inputMode, setInputMode] = useState<'percent' | 'gram'>('gram');

  useEffect(() => {
    if (!loading) {
      setCalories(String(goals.dailyCalories));
      setCarbsG(String(goals.carbsG));
      setProteinG(String(goals.proteinG));
      setFatG(String(goals.fatG));
      setWaterMl(String(goals.waterMl));
    }
  }, [loading, goals]);

  const validate = (): string | null => {
    const cal = parseFloat(calories);
    if (!cal || cal < 500 || cal > 10000) return 'Kalori 500–10000 arasında olmalıdır.';
    const c = parseFloat(carbsG), p = parseFloat(proteinG), f = parseFloat(fatG);
    if (isNaN(c) || c < 0) return 'Karbonhidrat 0 veya üzeri olmalıdır.';
    if (isNaN(p) || p < 0) return 'Protein 0 veya üzeri olmalıdır.';
    if (isNaN(f) || f < 0) return 'Yağ 0 veya üzeri olmalıdır.';
    const w = parseFloat(waterMl);
    if (!w || w < 500 || w > 10000) return 'Su hedefi 500–10000 ml arasında olmalıdır.';

    if (inputMode === 'percent') {
      const carbCal = c * 4, protCal = p * 4, fatCal = f * 9;
      const total = carbCal + protCal + fatCal;
      const pct = total > 0 ? Math.round(((carbCal + protCal + fatCal) / total) * 100) : 0;
      if (Math.abs(pct - 100) > 2) return 'Makro yüzdelerin toplamı %100 olmalıdır.';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Hata', err); return; }
    try {
      await saveGoals({
        dailyCalories: parseFloat(calories),
        carbsG: parseFloat(carbsG),
        proteinG: parseFloat(proteinG),
        fatG: parseFloat(fatG),
        waterMl: parseFloat(waterMl),
      });
      navigation.goBack();
    } catch {
      Alert.alert('Hata', 'Hedefler kaydedilemedi.');
    }
  };

  // Live macro calorie preview
  const computedCarbCal = (parseFloat(carbsG) || 0) * 4;
  const computedProtCal = (parseFloat(proteinG) || 0) * 4;
  const computedFatCal  = (parseFloat(fatG) || 0) * 9;
  const totalMacroCal   = computedCarbCal + computedProtCal + computedFatCal;

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color="#263C84" /></View>;
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={22} color="#1A1A2E" strokeWidth={1.75} />
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <Target size={18} color="#263C84" strokeWidth={1.75} />
          <Text style={styles.title}>Günlük Hedefler</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Calorie goal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kalori Hedefi</Text>
          <View style={styles.calorieRow}>
            <TextInput
              style={styles.calorieInput}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="2000"
              placeholderTextColor="#ADADAD"
            />
            <Text style={styles.calorieUnit}>kcal / gün</Text>
          </View>
        </View>

        {/* Macro goals */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Makro Hedefleri</Text>
            <View style={styles.modeToggle}>
              {(['gram', 'percent'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeBtn, inputMode === mode && styles.modeBtnActive]}
                  onPress={() => setInputMode(mode)}
                >
                  <Text style={[styles.modeBtnText, inputMode === mode && styles.modeBtnTextActive]}>
                    {mode === 'gram' ? 'Gram' : '%'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <MacroField
            label="Karbonhidrat"
            value={carbsG}
            onChange={setCarbsG}
            color="#F97316"
            unit="g"
          />
          <MacroField
            label="Protein"
            value={proteinG}
            onChange={setProteinG}
            color="#268479"
            unit="g"
          />
          <MacroField
            label="Yağ"
            value={fatG}
            onChange={setFatG}
            color="#AEBC2E"
            unit="g"
          />

          {totalMacroCal > 0 && (
            <View style={styles.macroPctRow}>
              <PctBar
                label="Karb"
                ratio={computedCarbCal / totalMacroCal}
                color="#F97316"
              />
              <PctBar
                label="Prot"
                ratio={computedProtCal / totalMacroCal}
                color="#268479"
              />
              <PctBar
                label="Yağ"
                ratio={computedFatCal / totalMacroCal}
                color="#AEBC2E"
              />
            </View>
          )}
        </View>

        {/* Water goal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Su Hedefi</Text>
          <View style={styles.calorieRow}>
            <TextInput
              style={styles.calorieInput}
              value={waterMl}
              onChangeText={setWaterMl}
              keyboardType="numeric"
              placeholder="2500"
              placeholderTextColor="#ADADAD"
            />
            <Text style={styles.calorieUnit}>ml / gün</Text>
          </View>
          <Text style={styles.hint}>
            {parseFloat(waterMl) > 0
              ? `≈ ${Math.ceil(parseFloat(waterMl) / 250)} bardak`
              : ''}
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.saveBtnText}>Hedefleri Kaydet</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MacroField({
  label, value, onChange, color, unit,
}: { label: string; value: string; onChange: (v: string) => void; color: string; unit: string }) {
  return (
    <View style={macroStyles.row}>
      <View style={[macroStyles.dot, { backgroundColor: color }]} />
      <Text style={macroStyles.label}>{label}</Text>
      <TextInput
        style={macroStyles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor="#ADADAD"
      />
      <Text style={macroStyles.unit}>{unit}</Text>
    </View>
  );
}

function PctBar({ label, ratio, color }: { label: string; ratio: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <View style={pctStyles.barBg}>
        <View style={[pctStyles.barFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[pctStyles.pctLabel, { color }]}>
        {Math.round(ratio * 100)}%
      </Text>
      <Text style={pctStyles.nameLabel}>{label}</Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { width: 100, fontSize: 14, color: '#1A1A2E', fontWeight: '600' },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#1A1A2E',
    textAlign: 'right',
  },
  unit: { width: 16, fontSize: 13, color: '#8A8A8A' },
});

const pctStyles = StyleSheet.create({
  barBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
  pctLabel: { fontSize: 13, fontWeight: '800' },
  nameLabel: { fontSize: 10, color: '#8A8A8A' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
  },

  scroll: { flex: 1 },

  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 14,
  },

  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calorieInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  calorieUnit: {
    fontSize: 13,
    color: '#8A8A8A',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#8A8A8A',
    marginTop: 8,
    textAlign: 'center',
  },

  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeBtnActive: { backgroundColor: '#263C84' },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: '#8A8A8A' },
  modeBtnTextActive: { color: '#FFFFFF' },

  macroPctRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  saveBtn: {
    backgroundColor: '#263C84',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#E0E0E0' },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
