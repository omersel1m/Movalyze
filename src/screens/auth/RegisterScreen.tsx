import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { authService } from '../../services/auth.service';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Ad Soyad boş bırakılamaz.';
    if (!email.trim()) return 'E-posta boş bırakılamaz.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Geçerli bir e-posta girin.';
    if (!password) return 'Şifre boş bırakılamaz.';
    if (password.length < 6) return 'Şifre en az 6 karakter olmalıdır.';
    return null;
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) { Alert.alert('Hata', error); return; }

    setLoading(true);
    const result = await authService.register(email.trim(), password, fullName.trim());
    setLoading(false);

    if (result.error) {
      Alert.alert('Kayıt Başarısız', result.error);
    }
    // Başarılıysa RootNavigator otomatik olarak TabNavigator'a geçer
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>Movalyze</Text>
        <Text style={styles.tagline}>SMARTER WAY TO TRACK YOUR FITNESS</Text>
      </View>

      {/* Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.cardWrapper}>
        <ScrollView
          contentContainerStyle={styles.card}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <Text style={styles.cardTitle}>Create Account</Text>
          <Text style={styles.cardSubtitle}>Join the pulse of better health today.</Text>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FULL NAME</Text>
            <View style={styles.inputBox}>
              <View style={styles.inputIconWrap}>
                <User size={18} color="#ADADAD" strokeWidth={1.75} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#ADADAD"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAİL</Text>
            <View style={styles.inputBox}>
              <View style={styles.inputIconWrap}>
                <Mail size={18} color="#ADADAD" strokeWidth={1.75} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                placeholderTextColor="#ADADAD"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ŞİFRE</Text>
            <View style={styles.inputBox}>
              <View style={styles.inputIconWrap}>
                <Lock size={18} color="#ADADAD" strokeWidth={1.75} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#ADADAD"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
                {showPassword
                  ? <EyeOff size={18} color="#ADADAD" strokeWidth={1.75} />
                  : <Eye size={18} color="#ADADAD" strokeWidth={1.75} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.disabledBtn]}
            onPress={handleRegister}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.primaryBtnText}>Sign Up</Text>}
          </TouchableOpacity>

          {/* OR */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          {/* Google */}
          <TouchableOpacity style={[styles.socialBtn, styles.disabled]} disabled>
            <Text style={styles.socialIcon}>G</Text>
            <Text style={styles.socialBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity style={[styles.socialBtn, styles.disabled]} disabled>
            <Text style={styles.socialIcon}></Text>
            <Text style={styles.socialBtnText}>Continue with Apple</Text>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#263C84' },

  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 52,
    paddingBottom: 24,
  },
  brand: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  tagline: { fontSize: 11, color: '#FFFFFFAA', letterSpacing: 2, marginTop: 6 },

  cardWrapper: { flex: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
    flexGrow: 1,
  },

  cardTitle: { fontSize: 24, fontWeight: '800', color: '#263C84', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: '#8A8A8A', marginBottom: 24 },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#8A8A8A', letterSpacing: 1, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: '#FAFAFA',
  },
  inputIconWrap: { marginRight: 10 },
  eyeBtn: { padding: 4 },
  input: { flex: 1, fontSize: 15, color: '#1A1A2E' },

  primaryBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  orRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  orText: { marginHorizontal: 12, color: '#ADADAD', fontSize: 13, fontWeight: '600' },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    height: 52,
    marginBottom: 12,
  },
  disabled: { opacity: 0.5 },
  socialIcon: { fontSize: 18, marginRight: 10, fontWeight: '700' },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#8A8A8A', fontSize: 13 },
  footerLink: { color: '#F97316', fontSize: 13, fontWeight: '700' },
});
