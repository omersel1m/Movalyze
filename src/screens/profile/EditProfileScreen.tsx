import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, User, Camera } from 'lucide-react-native';

import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { profileService } from '../../services/profile.service';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen() {
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const profile = await profileService.getMyProfile();
        setFullName(profile?.full_name ?? '');
        setAvatarUrl(profile?.avatar_url ?? null);
      } catch (e: unknown) {
        Alert.alert('Hata', e instanceof Error ? e.message : 'Profil yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePickAvatar = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const newUrl = await profileService.pickAndUploadAvatar();
      if (newUrl) setAvatarUrl(newUrl);
    } catch (e: unknown) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Resim yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Hata', 'İsim boş olamaz.');
      return;
    }
    setSaving(true);
    try {
      await profileService.updateProfile({ full_name: fullName.trim() });
      navigation.goBack();
    } catch (e: unknown) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Profil kaydedilemedi.');
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
        <Text style={styles.title}>Profili Düzenle</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#263C84" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handlePickAvatar}
              activeOpacity={0.8}
              disabled={uploading}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={44} color="#263C84" strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.editBadge}>
                {uploading
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Camera size={15} color="#FFFFFF" strokeWidth={2} />
                }
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Profil resmini değiştirmek için dokun</Text>
          </View>

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>İsim <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Adınız"
                placeholderTextColor="#ADADAD"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, (saving || loading) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || loading}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.saveBtnText}>Kaydet</Text>
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
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1A1A2E' },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },

  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#DDE3F5' },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#DDE3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#263C84',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F5F5F5',
  },
  avatarHint: { fontSize: 13, color: '#8A8A8A' },

  // Section
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 4,
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

  fieldWrapper: { marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#8A8A8A', marginBottom: 6 },
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
