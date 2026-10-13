import { useEffect, useState } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export function ProfileAvatar({ size = 40 }: { size?: number }) {
  const { session, profile } = useAuth();
  const [uri, setUri] = useState<string | null>(null);
  const path = session?.user?.user_metadata?.avatar_path;
  useEffect(() => {
    let live = true;
    setUri(null);
    if (typeof path !== 'string' || !session) return;
    void supabase.storage.from('profile-avatars').createSignedUrl(path, 3600).then(({ data }) => {
      if (live) setUri(data?.signedUrl ?? null);
    });
    return () => { live = false; };
  }, [path, session?.user?.id]);
  const initials = (profile?.fullName || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  return <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
    {uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} /> :
      <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: size * .30 }}>{initials}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  circle: { backgroundColor: '#16477D', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D9E9FF', overflow: 'hidden' },
});
