import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { getLocalISODate } from '@/shared/utils/categories';

/** A local date picked in the native picker, without time zone shifts. */
function toPickerDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

interface DateFieldProps {
  label: string;
  /** YYYY-MM-DD, or null for an optional field left empty. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Shows a Clear link so an optional date can be removed. */
  optional?: boolean;
  maximumDate?: Date;
}

export function DateField({ label, value, onChange, placeholder = 'Choose a date', optional, maximumDate }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text className="text-sm font-medium text-text mb-xs">{label}</Text>
        {optional && value && (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontSize: 13, color: '#2563EB', marginBottom: 4 }}>Clear</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={{ borderWidth: 2, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' }}
      >
        <Text style={{ fontSize: 15, color: value ? '#111827' : '#9CA3AF' }}>{value ?? placeholder}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={toPickerDate(value ?? getLocalISODate())}
          mode="date"
          display="default"
          maximumDate={maximumDate}
          onChange={(_event, selected) => {
            setOpen(Platform.OS === 'ios');
            if (selected) onChange(getLocalISODate(selected));
          }}
        />
      )}
    </View>
  );
}
