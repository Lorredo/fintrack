import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useBills, usePaySettings } from '../hooks/useBills';
import { syncBillReminders } from '../services/reminders';

if (Platform.OS !== 'web') {
  // Show reminders even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Taps already acted on, so returning to the app doesn't reopen Bills.
const handledResponses = new Set<string>();

/**
 * Keeps bill reminders in step with the bills and opens Bills when one is
 * tapped. Mounted inside the signed-in, unlocked part of the app, so a tap
 * never skips the PIN.
 */
export function BillReminders() {
  const router = useRouter();
  const { data: bills } = useBills();
  const { data: settings } = usePaySettings();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!bills || !settings) return;
    syncBillReminders(bills, settings.billReminders);
  }, [bills, settings]);

  useEffect(() => {
    if (!response) return;
    const key = `${response.notification.request.identifier}-${response.notification.date}`;
    const url = response.notification.request.content.data?.url;
    if (handledResponses.has(key) || url !== '/bills') return;
    handledResponses.add(key);
    router.push('/bills');
  }, [response, router]);

  return null;
}
