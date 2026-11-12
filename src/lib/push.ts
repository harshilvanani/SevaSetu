import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Show notifications as banners while the app is open.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
  });
}

type NotificationData = { type?: string; task_id?: string; assignment_id?: string; org_id?: string; report_id?: string };

/** Where a notification should take the user. */
export function notificationHref(type: string, data: NotificationData) {
  switch (type) {
    case 'joined':
    case 'report_reviewed':
    case 'assignment_completed':
    case 'reminder':
      return data.assignment_id ? { pathname: '/my-seva' as const, params: { assignment: data.assignment_id } } : ('/my-seva' as const);
    case 'invited':
      return data.task_id ? { pathname: '/seva/[id]' as const, params: { id: data.task_id } } : ('/discover' as const);
    case 'report_submitted':
      return '/reviews' as const;
    case 'org_pending':
      return '/admin' as const;
    case 'org_reviewed':
    case 'account_unblocked':
      return '/profile' as const;
    case 'event_cancelled':
      return '/my-seva' as const;
    case 'admin_role':
      return '/admin' as const;
    default:
      return null;
  }
}

/**
 * Registers this device for Expo push notifications and stores the token.
 * Requires a physical device and an EAS project id (set by `eas init`); otherwise it's a no-op.
 */
export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (!userId || Platform.OS === 'web' || !Device.isDevice) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', { name: 'Seva updates', importance: AndroidImportance.DEFAULT });
      }
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
      if (status !== 'granted') return;
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      await supabase.from('push_tokens').upsert({ token, user_id: userId, platform: Platform.OS as 'ios' | 'android', updated_at: new Date().toISOString() });
    })().catch(() => {
      // Push is best-effort; the in-app inbox still works.
    });
  }, [userId]);

  // Open the right screen when a notification is tapped.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData;
      const href = notificationHref(data.type ?? '', data);
      if (href) router.push(href);
    });
    return () => sub.remove();
  }, []);
}
