import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Input, Loader, Screen } from '@/components/ui';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { ChoicePills } from '../components/ChoicePills';
import { usePaySettings, useUpdatePaySettings } from '../hooks/useBills';
import { requestReminderPermission } from '../services/reminders';
import type { PaySchedule, PaySettings } from '../types';

const SCHEDULES: { value: PaySchedule | null; label: string }[] = [
  { value: 'semi_monthly', label: '15th and 30th' },
  { value: 'irregular', label: 'Irregular / freelance' },
];

function PaySettingsForm({ settings }: { settings: PaySettings }) {
  const router = useRouter();
  const toast = useToast();
  const updateSettings = useUpdatePaySettings();

  const [paySchedule, setPaySchedule] = useState<PaySchedule | null>(settings.paySchedule ?? 'semi_monthly');
  const [savings, setSavings] = useState(settings.savingsPerPayday > 0 ? String(settings.savingsPerPayday) : '');
  const [billReminders, setBillReminders] = useState(settings.billReminders);

  const parsedSavings = savings.trim() === '' ? 0 : Number(savings);
  const isValid = Number.isFinite(parsedSavings) && parsedSavings >= 0;

  const handleSave = () => {
    if (!isValid || !paySchedule) return;
    updateSettings.mutate(
      { paySchedule, savingsPerPayday: Math.round(parsedSavings * 100) / 100, billReminders },
      {
        onSuccess: () => {
          toast.success('Payday settings saved');
          router.back();
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't save your settings"),
      },
    );
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 6 }}>
        <ChoicePills label="When do you get paid?" choices={SCHEDULES} value={paySchedule} onChange={setPaySchedule} />
        <Text className="text-sm text-text-secondary">
          {paySchedule === 'irregular'
            ? 'Safe to Spend counts down to the end of each month.'
            : 'Safe to Spend counts down to your next payday. In February, the 30th is the last day of the month.'}
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        <Input
          label="Set aside for savings each payday"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={savings}
          onChangeText={setSavings}
          error={isValid ? undefined : 'Enter 0 or more'}
        />
        <Text className="text-sm text-text-secondary">
          Kept out of Safe to Spend. Moving money into a wallet that isn’t counted, like a savings wallet, counts toward it.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text className="text-sm font-medium text-text">Bill reminders</Text>
          <Text className="text-sm text-text-secondary mt-1">A notification before each bill is due.</Text>
        </View>
        <Switch
          value={billReminders}
          onValueChange={(value) => {
            setBillReminders(value);
            if (value) void requestReminderPermission();
          }}
          trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
          thumbColor={billReminders ? '#2563EB' : '#F9FAFB'}
          accessibilityLabel="Bill reminders"
        />
      </View>

      <Button title="Save" onPress={handleSave} disabled={!isValid || !paySchedule} loading={updateSettings.isPending} />
    </View>
  );
}

export default function PaySettingsScreen() {
  const router = useRouter();
  const { data: settings, isError, refetch } = usePaySettings();

  return (
    <Screen scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 16 }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' }}>Payday & Savings</Text>
      </View>

      {settings ? (
        <PaySettingsForm settings={settings} />
      ) : isError ? (
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Text style={{ fontSize: 15, color: '#6B7280', marginBottom: 12 }}>Failed to load your settings</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      ) : (
        <Loader />
      )}
    </Screen>
  );
}
