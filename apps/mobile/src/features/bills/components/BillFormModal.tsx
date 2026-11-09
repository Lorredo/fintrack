import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Button, Input, Modal } from '@/components/ui';
import { useAccounts } from '@/features/accounts/hooks/useAccounts';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import { getLocalISODate } from '@/shared/utils/categories';
import { useCreateBill, useDeleteBill, useUpdateBill } from '../hooks/useBills';
import { requestReminderPermission } from '../services/reminders';
import type { Bill, BillFrequency } from '../types';
import { ChoicePills } from './ChoicePills';

// All of these already have icons and colors in the app.
const BILL_CATEGORIES = [
  'Bills & Utilities',
  'Electric & Water',
  'Mobile & Internet',
  'Rent & Mortgage',
  'Streaming Services',
  'Tuition & Books',
  'Gym & Fitness',
];

const QUICK_BILLS: { name: string; category: string }[] = [
  { name: 'Electricity', category: 'Electric & Water' },
  { name: 'Water', category: 'Electric & Water' },
  { name: 'Internet', category: 'Mobile & Internet' },
  { name: 'Phone', category: 'Mobile & Internet' },
  { name: 'Rent', category: 'Rent & Mortgage' },
  { name: 'Streaming', category: 'Streaming Services' },
];

const FREQUENCIES: { value: BillFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

const REMINDERS = [
  { value: 0, label: 'On the day' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
];

/** A local date picked in the native picker, shown and sent as YYYY-MM-DD. */
function toPickerDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface BillFormProps {
  bill: Bill | null;
  onClose: () => void;
  onSaved?: (bill: Bill) => void;
}

function BillForm({ bill, onClose, onSaved }: BillFormProps) {
  const toast = useToast();
  const { data: accounts } = useAccounts();
  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();

  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '');
  const [category, setCategory] = useState(bill?.category ?? 'Bills & Utilities');
  const [accountId, setAccountId] = useState<string | null>(bill?.accountId ?? accounts?.[0]?.id ?? null);
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(bill?.startDate ?? getLocalISODate());
  const [remindDaysBefore, setRemindDaysBefore] = useState(bill?.remindDaysBefore ?? 1);
  const [notes, setNotes] = useState(bill?.notes ?? '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});

  const parsedAmount = Number(amount);
  const isSaving = createBill.isPending || updateBill.isPending;

  const handleSave = () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Give the bill a name';
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) nextErrors.amount = 'Enter an amount above 0';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      name: name.trim(),
      amount: Math.round(parsedAmount * 100) / 100,
      category,
      accountId: accountId ?? '',
      frequency,
      startDate,
      remindDaysBefore,
      notes: notes.trim() || null,
    };
    const callbacks = {
      onSuccess: (saved: Bill) => {
        onSaved?.(saved);
        onClose();
        toast.success(bill ? 'Bill updated' : 'Bill added');
        // Asked here, when a reminder is about to be useful, not at startup.
        if (!bill) void requestReminderPermission();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't save the bill"),
    };
    if (bill) {
      updateBill.mutate({ id: bill.id, ...input }, callbacks);
    } else {
      createBill.mutate({ ...input, accountId: accountId ?? undefined }, callbacks);
    }
  };

  const handleTogglePause = () => {
    if (!bill) return;
    updateBill.mutate(
      { id: bill.id, active: !bill.active },
      {
        onSuccess: () => {
          onClose();
          toast.success(bill.active ? 'Bill paused' : 'Bill resumed');
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't update the bill"),
      },
    );
  };

  const handleDelete = () => {
    if (!bill) return;
    Alert.alert('Delete Bill', `Delete ${bill.name}? Expenses you already recorded for it stay.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteBill.mutate(bill.id, {
            onSuccess: () => {
              onClose();
              toast.success('Bill deleted');
            },
            onError: (err: unknown) => toast.error(getErrorMessage(err) || "Couldn't delete the bill"),
          }),
      },
    ]);
  };

  return (
    <View style={{ gap: 16 }}>
      {!bill && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_BILLS.map((quick) => (
            <Pressable
              key={quick.name}
              onPress={() => {
                setName(quick.name);
                setCategory(quick.category);
              }}
              className="active:opacity-70"
              style={{ backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 13, color: '#374151' }}>{quick.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Input label="Name" placeholder="e.g. Meralco, PLDT, Rent" value={name} onChangeText={setName} error={errors.name} />
      <Input
        label="Amount"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        error={errors.amount}
      />

      <View>
        <Text className="text-sm font-medium text-text mb-xs">{bill ? 'First due date' : 'Next due date'}</Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{ borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' }}
        >
          <Text style={{ fontSize: 15, color: '#111827' }}>{startDate}</Text>
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={toPickerDate(startDate)}
            mode="date"
            display="default"
            onChange={(_event, selected) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selected) setStartDate(getLocalISODate(selected));
            }}
          />
        )}
      </View>

      <ChoicePills label="Repeats" choices={FREQUENCIES} value={frequency} onChange={setFrequency} />
      <ChoicePills
        label="Category"
        choices={BILL_CATEGORIES.map((value) => ({ value, label: value }))}
        value={category}
        onChange={setCategory}
      />
      <ChoicePills
        label="Pay from"
        choices={[
          ...(accounts ?? []).map((account) => ({ value: account.id as string | null, label: account.name })),
          { value: null, label: 'Choose when paying' },
        ]}
        value={accountId}
        onChange={setAccountId}
      />
      <ChoicePills label="Remind me" choices={REMINDERS} value={remindDaysBefore} onChange={setRemindDaysBefore} />
      <Input label="Notes (optional)" placeholder="Account number, due time…" value={notes} onChangeText={setNotes} />

      <Button title={bill ? 'Save Changes' : 'Add Bill'} onPress={handleSave} loading={isSaving} />
      {bill && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title={bill.active ? 'Pause' : 'Resume'} variant="outline" onPress={handleTogglePause} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Delete" variant="danger" onPress={handleDelete} loading={deleteBill.isPending} />
          </View>
        </View>
      )}
    </View>
  );
}

interface BillFormModalProps {
  visible: boolean;
  /** The bill being edited, or null to add one. */
  bill: Bill | null;
  onClose: () => void;
  onSaved?: (bill: Bill) => void;
}

export default function BillFormModal({ visible, bill, onClose, onSaved }: BillFormModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title={bill ? 'Edit Bill' : 'New Bill'}>
      {visible && <BillForm key={bill?.id ?? 'new'} bill={bill} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}
