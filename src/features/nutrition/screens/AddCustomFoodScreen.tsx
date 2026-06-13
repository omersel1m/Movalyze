import React, { useState } from 'react';
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { NutritionStackParamList } from '../../../navigation/NutritionNavigator';
import { nutritionService } from '../../../services/nutrition.service';
import { CustomFoodInput } from '../types/nutrition.types';

type Nav = NativeStackNavigationProp<NutritionStackParamList, 'AddCustomFood'>;

interface FormState {
  name: string;
  brand: string;
  servingSize: string;
  servingUnit: 'g' | 'ml' | 'piece';
  calories: string;
  carbsG: string;
  proteinG: string;
  fatG: string;
  fiberG: string;
  sugarG: string;
  sodiumMg: string;
}

function Field({
  label, value, onChange, keyboardType = 'default', placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}{required && <Text style={fieldStyles.req}> *</Text>}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder ?? ''}
        placeholderTextColor="#ADADAD"
        returnKeyType="next"
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#8A8A8A', marginBottom: 6 },
  req: { color: '#E53E3E' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
  },
});

export default function AddCustomFoodScreen() {
  const navigation = useNavigation<Nav>();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: '',
    brand: '',
    servingSize: '100',
    servingUnit: 'g',
    calories: '',
    carbsG: '',
    proteinG: '',
    fatG: '',
    fiberG: '',
    sugarG: '',
    sodiumMg: '',
  });

  const set = (key: keyof FormState) => (val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Besin adı zorunludur.';
    if (!form.calories || parseFloat(form.calories) < 0) return 'Kalori 0 veya üzeri olmalıdır.';
    if (form.carbsG && parseFloat(form.carbsG) < 0) return 'Karbonhidrat 0 veya üzeri olmalıdır.';
    if (form.proteinG && parseFloat(form.proteinG) < 0) return 'Protein 0 veya üzeri olmalıdır.';
    if (form.fatG && parseFloat(form.fatG) < 0) return 'Yağ 0 veya üzeri olmalıdır.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Hata', err); return; }

    setSaving(true);
    try {
      const input: CustomFoodInput = {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        servingSize: parseFloat(form.servingSize) || 100,
        servingUnit: form.servingUnit,
        calories: parseFloat(form.calories) || 0,
        carbsG: parseFloat(form.carbsG) || 0,
        proteinG: parseFloat(form.proteinG) || 0,
        fatG: parseFloat(form.fatG) || 0,
        fiberG: form.fiberG ? parseFloat(form.fiberG) : undefined,
        sugarG: form.sugarG ? parseFloat(form.sugarG) : undefined,
        sodiumMg: form.sodiumMg ? parseFloat(form.sodiumMg) : undefined,
      };
      await nutritionService.createCustomFood(input);
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Besin kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <ArrowLeft size={22} color="#1A1A2E" strokeWidth={1.75} />
        </TouchableOpacity>
        <Text style={styles.title}>Yeni Besin Ekle</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temel Bilgiler</Text>
          <Field label="Besin Adı" value={form.name} onChange={set('name')} required placeholder="örn. Yulaf ezmesi" />
          <Field label="Marka (opsiyonel)" value={form.brand} onChange={set('brand')} placeholder="örn. Ülker" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Porsiyon</Text>
          <Field label="Porsiyon Büyüklüğü" value={form.servingSize} onChange={set('servingSize')}
            keyboardType="numeric" placeholder="100" required />
          <View style={styles.unitRow}>
            {(['g', 'ml', 'piece'] as const).map(u => (
              <TouchableOpacity
                key={u}
                style={[styles.unitBtn, form.servingUnit === u && styles.unitBtnActive]}
                onPress={() => setForm(f => ({ ...f, servingUnit: u }))}
              >
                <Text style={[styles.unitText, form.servingUnit === u && styles.unitTextActive]}>
                  {u === 'piece' ? 'adet' : u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Besin Değerleri (porsiyon başına)</Text>
          <Field label="Kalori (kcal)" value={form.calories} onChange={set('calories')}
            keyboardType="numeric" placeholder="0" required />
          <Field label="Karbonhidrat (g)" value={form.carbsG} onChange={set('carbsG')}
            keyboardType="numeric" placeholder="0" />
          <Field label="Protein (g)" value={form.proteinG} onChange={set('proteinG')}
            keyboardType="numeric" placeholder="0" />
          <Field label="Yağ (g)" value={form.fatG} onChange={set('fatG')}
            keyboardType="numeric" placeholder="0" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ek Bilgiler (opsiyonel)</Text>
          <Field label="Lif (g)" value={form.fiberG} onChange={set('fiberG')} keyboardType="numeric" placeholder="0" />
          <Field label="Şeker (g)" value={form.sugarG} onChange={set('sugarG')} keyboardType="numeric" placeholder="0" />
          <Field label="Sodyum (mg)" value={form.sodiumMg} onChange={set('sodiumMg')} keyboardType="numeric" placeholder="0" />
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
            : <Text style={styles.saveBtnText}>Besini Kaydet</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
  },

  scroll: { flex: 1 },

  section: {
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A8A8A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },

  unitRow: { flexDirection: 'row', gap: 8 },
  unitBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  unitBtnActive: { borderColor: '#263C84', backgroundColor: '#EEF1FA' },
  unitText: { fontSize: 13, fontWeight: '600', color: '#8A8A8A' },
  unitTextActive: { color: '#263C84' },

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
