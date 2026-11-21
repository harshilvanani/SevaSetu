import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import type { Period, Slot } from '@/domain/seva';
import { supabase, type Tables } from '@/lib/supabase';

export const INTERESTS = [
  'event_setup',
  'outreach',
  'teaching',
  'food',
  'technology',
  'administration',
  'design_media',
  'elder_care',
  'kids_youth',
  'environment',
  'translation',
  'fundraising',
  'meditation',
  'data',
  'logistics',
  'professional',
] as const;
export type Interest = (typeof INTERESTS)[number];

/** Art of Living courses a volunteer can say they have completed (self-declared). */
export const COURSES = ['part1', 'part2', 'vtp', 'teachers', 'sri_sri_yoga', 'sky_teens', 'sanyam'] as const;
export type Course = (typeof COURSES)[number];

export const PERIODS: Period[] = ['morning', 'afternoon', 'evening'];
export const RADII = [5, 10, 25, 50] as const;

export type ProfileUpdate = Partial<
  Pick<
    Tables<'profiles'>,
    | 'full_name' | 'city' | 'latitude' | 'longitude' | 'radius_km' | 'interests' | 'skills' | 'serve_mode' | 'hours_per_week' | 'onboarded_at' | 'locale' | 'courses'
    | 'person_type' | 'country' | 'province' | 'languages' | 'skill_levels' | 'profession' | 'linkedin_url' | 'linkedin_consent' | 'directory_opt_in'
  >
>;

export function useSaveProfile() {
  const { session, refreshProfile } = useAuth();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', session!.user.id);
      if (error) throw error;
    },
    onSuccess: () => refreshProfile(),
  });
}

export function useAvailability() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['availability', session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<Slot[]> => {
      const { data, error } = await supabase.from('availability_slots').select('weekday, period').eq('user_id', session!.user.id);
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
  });
}

export function useSaveAvailability() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slots: Slot[]) => {
      const uid = session!.user.id;
      const { error: delErr } = await supabase.from('availability_slots').delete().eq('user_id', uid);
      if (delErr) throw delErr;
      if (slots.length) {
        const { error } = await supabase.from('availability_slots').insert(slots.map((s) => ({ ...s, user_id: uid })));
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}

/** Ask for foreground location and resolve a readable city name (native) plus coordinates. */
export async function detectLocation(): Promise<{ city: string | null; latitude: number; longitude: number } | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  let city: string | null = null;
  if (Platform.OS !== 'web') {
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) city = [place.city ?? place.subregion, place.region].filter(Boolean).join(', ') || null;
    } catch {
      // Reverse geocoding is best-effort.
    }
  }
  return { city, latitude, longitude };
}

/** Best-effort forward geocode of a typed city (native only). */
export async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number } | null> {
  if (Platform.OS === 'web' || !city.trim()) return null;
  try {
    const [hit] = await Location.geocodeAsync(city);
    return hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
  } catch {
    return null;
  }
}
