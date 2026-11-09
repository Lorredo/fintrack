import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Input, Modal } from '@/components/ui';
import type { RegularIncome } from '../types';
import { describeRegularIncome } from '../utils/billLabels';
import { ChoicePills } from './ChoicePills';

const QUICK_PICKS: RegularIncome[] = [
  { name: 'Rice allowance', amount: 0, kind: 'day', day: 15 },
  { name: 'Augmentation', amount: 0, kind: 'weekday', nth: 1, weekday: 5 },
];

const KINDS: { value: RegularIncome['kind']; label: string }[] = [
  { value: 'day', label: 'A day of the month' },
  { value: 'weekday', label: 'A weekday' },
];

const NTHS = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: 5, label: 'Last' },
];

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

interface FormProps {
  income: RegularIncome | null;
  onSave: (income: RegularIncome) => void;
  onRemove?: () => void;
}

function RegularIncomeForm({ income, onSave, onRemove }: FormProps) {
  const [name, setName] = useState(income?.name ?? '');
  const [amount, setAmount] = useState(income ? String(income.amount) : '');
  const [kind, setKind] = useState<RegularIncome['kind']>(income?.kind ?? 'day');
  const [day, setDay] = useState(String(income?.day ?? 15));
  const [nth, setNth] = useState(income?.nth ?? 1);
  const [weekday, setWeekday] = useState(income?.weekday ?? 5);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; day?: string }>({});

  const parsedAmount = Number(amount);
  const parsedDay = Number(day);
  const preview: RegularIncome = kind === 'day' ? { name, amount: parsedAmount, kind, day: parsedDay } : { name, amount: parsedAmount, kind, nth, weekday };

  const handleSave = () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Give it a name';
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) nextErrors.amount = 'Enter an amount above 0';
    if (kind === 'day' && !(Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31)) nextErrors.day = 'Enter a day from 1 to 31';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({ ...preview, name: name.trim(), amount: Math.round(parsedAmount * 100) / 100 });
  };

  return (
    <View style={{ gap: 16 }}>
      {!income && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_PICKS.map((pick) => (
            <Pressable
              key={pick.name}
              onPress={() => {
                setName(pick.name);
                setKind(pick.kind);
                if (pick.day) setDay(String(pick.day));
                if (pick.nth) setNth(pick.nth);
                if (pick.weekday !== undefined) setWeekday(pick.weekday);
              }}
              className="active:opacity-70"
              style={{ backgroundColor: '#F3F4F6', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 13, color: '#374151' }}>{pick.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Input label="Name" placeholder="e.g. Rice allowance" value={name} onChangeText={setName} error={errors.name} />
      <Input
        label="Amount each month"
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        error={errors.amount}
      />

      <ChoicePills label="Arrives on" choices={KINDS} value={kind} onChange={setKind} />
      {kind === 'day' ? (
        <Input label="Day of the month" keyboardType="number-pad" value={day} onChangeText={setDay} error={errors.day} />
      ) : (
        <View style={{ gap: 12 }}>
          <ChoicePills choices={NTHS} value={nth} onChange={setNth} />
          <ChoicePills choices={WEEKDAYS} value={weekday} onChange={setWeekday} />
        </View>
      )}
      {(kind === 'weekday' || (parsedDay >= 1 && parsedDay <= 31)) && (
        <Text className="text-sm text-text-secondary">
          {describeRegularIncome(preview)}. It counts as part of your expected pay for that pay period, like your salary.
        </Text>
      )}

      <Button title={income ? 'Save' : 'Add Income'} onPress={handleSave} />
      {onRemove && <Button title="Remove" variant="danger" onPress={onRemove} />}
    </View>
  );
}

interface RegularIncomeModalProps {
  visible: boolean;
  /** The item being edited, or null to add one. */
  income: RegularIncome | null;
  onClose: () => void;
  onSave: (income: RegularIncome) => void;
  onRemove?: () => void;
}

export default function RegularIncomeModal({ visible, income, onClose, onSave, onRemove }: RegularIncomeModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title={income ? 'Edit Regular Income' : 'Add Regular Income'}>
      {visible && (
        <RegularIncomeForm
          key={income ? `${income.name}-${income.kind}` : 'new'}
          income={income}
          onSave={onSave}
          onRemove={onRemove}
        />
      )}
    </Modal>
  );
}
