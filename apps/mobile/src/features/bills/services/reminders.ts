import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { formatCurrency } from '@/shared/utils/categories';
import type { Bill } from '../types';
import type { Debt, Paluwagan } from '@/features/utang/types';

// Reminders are local notifications scheduled on the phone, so they need no
// push service. Without Android's exact alarm permission they may arrive a
// few minutes late, which is fine for a bill.

const CHANNEL_ID = 'bills';
const ID_PREFIX = 'bill-';
// Every reminder FinTrack schedules starts with one of these, so a sync can
// replace them all without touching anything else.
const OWNED_PREFIXES = [ID_PREFIX, 'debt-', 'paluwagan-'];
const REMINDER_HOUR = 9;

const isSupported = Platform.OS === 'android' || Platform.OS === 'ios';

let channelReady: Promise<unknown> | null = null;

// Android needs a channel before it will ask for permission or show anything.
function ensureChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Bill reminders',
    importance: Notifications.AndroidImportance.HIGH,
  }).catch(() => {
    channelReady = null;
  });
  return channelReady;
}

/** Asks for permission, once there is a reason to (a bill was added). */
export async function requestReminderPermission(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** A local time on a YYYY-MM-DD date. */
function atReminderHour(isoDate: string, daysBefore = 0): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day - daysBefore, REMINDER_HOUR, 0, 0);
}

function nextReminderHour(now: Date): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), REMINDER_HOUR, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

interface PlannedReminder {
  identifier: string;
  date: Date;
  title: string;
  body: string;
  /** The screen a tap opens. */
  url?: string;
}

export function planReminders(bills: Bill[], now = new Date()): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const bill of bills) {
    if (!bill.active) continue;
    const amount = formatCurrency(bill.amount);
    const base = `${ID_PREFIX}${bill.id}-${bill.nextDue}`;

    if (bill.daysUntil < 0) {
      // One nudge for an overdue bill; it moves on once paid or skipped.
      planned.push({
        identifier: `${base}-overdue`,
        date: nextReminderHour(now),
        title: `${bill.name} is overdue`,
        body: `${amount} · Tap to mark it as paid`,
      });
      continue;
    }

    if (bill.remindDaysBefore > 0) {
      const days = bill.remindDaysBefore;
      planned.push({
        identifier: `${base}-before`,
        date: atReminderHour(bill.nextDue, days),
        title: days === 1 ? `${bill.name} is due tomorrow` : `${bill.name} is due in ${days} days`,
        body: `${amount} · Tap to see your bills`,
      });
    }
    planned.push({
      identifier: `${base}-due`,
      date: atReminderHour(bill.nextDue),
      title: `${bill.name} is due today`,
      body: `${amount} · Tap to mark it as paid`,
    });
  }
  return planned.filter((reminder) => reminder.date > now);
}

/** Utang due dates and paluwagan rounds, alongside bills. */
export function planOtherReminders(debts: Debt[], paluwagans: Paluwagan[], now = new Date()): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (const debt of debts) {
    if (debt.settled || !debt.dueDate) continue;
    const amount = formatCurrency(debt.remaining);
    const base = `debt-${debt.id}-${debt.dueDate}`;
    if (debt.direction === 'borrowed') {
      planned.push({
        identifier: `${base}-before`,
        date: atReminderHour(debt.dueDate, 1),
        title: `Utang to ${debt.personName} is due tomorrow`,
        body: `${amount} left to pay`,
        url: '/utang',
      });
      planned.push({
        identifier: `${base}-due`,
        date: atReminderHour(debt.dueDate),
        title: `Utang to ${debt.personName} is due today`,
        body: `${amount} left to pay`,
        url: '/utang',
      });
    } else {
      planned.push({
        identifier: `${base}-due`,
        date: atReminderHour(debt.dueDate),
        title: `${debt.personName}'s utang is due today`,
        body: `${amount} still owed to you · Tap to send a reminder`,
        url: '/utang',
      });
    }
  }
  for (const paluwagan of paluwagans) {
    if (!paluwagan.active) continue;
    const next = paluwagan.nextContribution;
    if (next) {
      planned.push({
        identifier: `paluwagan-${paluwagan.id}-${next.round}-pay`,
        date: next.isPast ? nextReminderHour(now) : atReminderHour(next.date),
        title: `${paluwagan.name}: round ${next.round} contribution`,
        body: `${formatCurrency(paluwagan.contribution)} ${next.isPast ? 'is overdue' : 'is due today'}`,
        url: '/paluwagan',
      });
    }
    const myRound = paluwagan.rounds.find((round) => round.isMyTurn);
    if (myRound && !myRound.payoutReceived) {
      planned.push({
        identifier: `paluwagan-${paluwagan.id}-${myRound.round}-payout`,
        date: atReminderHour(myRound.date),
        title: `${paluwagan.name}: it's your turn`,
        body: `Your ${formatCurrency(paluwagan.payoutAmount)} payout is today`,
        url: '/paluwagan',
      });
    }
  }
  return planned.filter((reminder) => reminder.date > now);
}

async function cancelBillReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => OWNED_PREFIXES.some((prefix) => request.identifier.startsWith(prefix)))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

/**
 * Replaces all bill reminders with ones for the bills' next due dates. Never
 * asks for permission itself, so opening the app doesn't prompt.
 */
export async function syncBillReminders(
  bills: Bill[],
  enabled: boolean,
  debts: Debt[] = [],
  paluwagans: Paluwagan[] = [],
): Promise<void> {
  if (!isSupported) return;
  try {
    await cancelBillReminders();
    if (!enabled) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    await ensureChannel();

    for (const reminder of [...planReminders(bills), ...planOtherReminders(debts, paluwagans)]) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { title: reminder.title, body: reminder.body, data: { url: reminder.url ?? '/bills' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId: CHANNEL_ID },
      });
    }
  } catch {
    // Reminders are a convenience; failing to schedule must not break the app.
  }
}

/** Removes every reminder, for when the user signs out. */
export async function clearBillReminders(): Promise<void> {
  if (!isSupported) return;
  try {
    await cancelBillReminders();
  } catch {
    // Nothing to clean up.
  }
}
