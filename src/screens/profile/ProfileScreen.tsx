import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { User, Pencil } from 'lucide-react-native';
import { supabase } from '../../config/supabaseClient';
import { authService } from '../../services/auth.service';
import { Profile } from '../../database/models/types';

// ── Skeleton ──────────────────────────────────────────────────────
function SkeletonBox({ width, height, borderRadius = 8, style }: {
  width: number | string; height: number; borderRadius?: number; style?: object;
}) {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, easing: Easing.ease, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#E0E0E0', opacity }, style]}
    />
  );
}

// ── Gender display ────────────────────────────────────────────────
const genderLabel: Record<string, string> = {
  male: 'Erkek',
  female: 'Kadın',
  other: 'Diğer',
  prefer_not_to_say: 'Belirtilmemiş',
};

// ── Component ─────────────────────────────────────────────────────
export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) setProfile(data as Profile);
      setLoadingProfile(false);
    }
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await authService.logout();
  };

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Text style={styles.pageTitle}>Profile</Text>

      {/* Avatar + User Info */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarPlaceholder}>
            <User size={44} color="#263C84" strokeWidth={1.5} />
          </View>
          <View style={styles.editBadge}>
            <Pencil size={13} color="#FFFFFF" strokeWidth={2} />
          </View>
        </View>

        {loadingProfile ? (
          <View style={styles.skeletonCenter}>
            <SkeletonBox width={160} height={22} borderRadius={6} style={{ marginBottom: 8 }} />
            <SkeletonBox width={120} height={16} borderRadius={6} />
          </View>
        ) : (
          <>
            <Text style={styles.userName}>{profile?.full_name ?? '—'}</Text>
            <Text style={styles.userMeta}>
              {[
                profile?.age ? `${profile.age}` : null,
                profile?.gender ? genderLabel[profile.gender] : null,
                profile?.height_cm ? `${profile.height_cm}cm` : null,
              ].filter(Boolean).join(', ') || 'Profil bilgisi yok'}
            </Text>
          </>
        )}
      </View>

      {/* Weekly Goal — MOCK */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Goal</Text>
        <View style={[styles.card, styles.disabled]}>
          <Text style={styles.cardLabel}>Exercise</Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: '60%' }]} />
          </View>
        </View>
      </View>

      {/* Most Frequent Mistake — MOCK */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Most Frequent Mistake</Text>
        <View style={[styles.card, styles.disabled]}>
          <Text style={styles.mistakeTitle}>Incorrect Form</Text>
          <Text style={styles.mistakeDesc}>
            Your posture is off during squats. Try to keep your back straight.
          </Text>
        </View>
      </View>

      {/* AI Assistant — MOCK */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Assistant</Text>
        <View style={[styles.card, styles.disabled]}>
          <Text style={styles.cardLabel}>Get Suggestions</Text>
          <Text style={styles.cardSubLabel}>Personalized tips for your fitness journey</Text>
        </View>
      </View>

      {/* Create Training Plan — MOCK */}
      <TouchableOpacity style={[styles.primaryBtn, styles.disabled]} disabled>
        <Text style={styles.primaryBtnText}>Create Training Plan</Text>
      </TouchableOpacity>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity style={styles.settingRow}>
          <Text style={styles.settingText}>Edit Profile Info</Text>
          <Text style={styles.settingChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.settingRow, styles.disabled]} disabled>
          <Text style={styles.settingText}>Voice Notifications</Text>
          <View style={styles.switchOff} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },

  // Avatar
  avatarSection: { alignItems: 'center', paddingBottom: 24 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DDE3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#263C84',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonCenter: { alignItems: 'center' },
  userName: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  userMeta: { fontSize: 13, color: '#8A8A8A' },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 10 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 8 },
  cardSubLabel: { fontSize: 12, color: '#8A8A8A' },

  // Progress bar
  progressBg: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: '#263C84', borderRadius: 4 },

  // Mistake card
  mistakeTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  mistakeDesc: { fontSize: 12, color: '#8A8A8A', lineHeight: 18 },

  // Primary button
  primaryBtn: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    height: 52,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Settings
  settingRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingText: { fontSize: 14, color: '#1A1A2E' },
  settingChevron: { fontSize: 20, color: '#ADADAD' },
  switchOff: { width: 36, height: 20, borderRadius: 10, backgroundColor: '#E0E0E0' },

  // Logout
  logoutRow: {
    backgroundColor: '#FFF0EC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: '#F97316' },

  disabled: { opacity: 0.5 },
});
