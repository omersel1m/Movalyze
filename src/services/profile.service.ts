import { decode } from 'base64-arraybuffer';
import { launchImageLibrary } from 'react-native-image-picker';
import { supabase } from '../config/supabaseClient';
import { Profile } from '../database/models/types';

const AVATAR_BUCKET = 'avatars';

export interface ProfileUpdateInput {
  full_name?: string | null;
  avatar_url?: string | null;
  age?: number | null;
  gender?: Profile['gender'];
  height_cm?: number | null;
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum bulunamadı.');
  return user.id;
}

export const profileService = {
  /** Giriş yapmış kullanıcının profilini getirir. Satır yoksa null döner. */
  async getMyProfile(): Promise<Profile | null> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as Profile | null;
  },

  /**
   * Profil alanlarını günceller (isim, avatar_url, yaş, cinsiyet, boy vb.).
   * Kullanıcının profil satırı henüz yoksa (ör. kayıt sırasında oluşmamışsa)
   * yeni bir satır oluşturur; varsa yalnızca verilen alanları günceller.
   */
  async updateProfile(input: ProfileUpdateInput): Promise<Profile> {
    const userId = await getCurrentUserId();

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('profiles')
        .update(input)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Profile;
    }

    // Satır yok → varsayılanlarla yeni profil oluştur.
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: userId, fitness_level: 'beginner', ...input })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Profile;
  },

  /**
   * Galeriden resim seçtirir, Supabase Storage'a yükler ve profiles.avatar_url
   * alanını günceller. Kullanıcı seçimi iptal ederse null döner.
   */
  async pickAndUploadAvatar(): Promise<string | null> {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 512,
      maxHeight: 512,
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.didCancel) return null;
    if (result.errorCode) {
      throw new Error(result.errorMessage || 'Resim seçilemedi.');
    }

    const asset = result.assets?.[0];
    if (!asset?.base64) throw new Error('Resim verisi okunamadı.');

    const userId = await getCurrentUserId();
    const contentType = asset.type || 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, decode(asset.base64), { contentType, upsert: true });

    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);

    // Aynı yola upsert edildiği için URL sabit kalır; önbelleği kırmak için
    // sürüm parametresi ekliyoruz, böylece güncel resim gösterilir.
    const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

    await this.updateProfile({ avatar_url: cacheBustedUrl });
    return cacheBustedUrl;
  },
};
