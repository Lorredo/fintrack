import { Pressable, Text, View } from 'react-native';

interface Choice<T> {
  value: T;
  label: string;
}

interface ChoicePillsProps<T> {
  label?: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChoicePills<T extends string | number | null>({ label, choices, value, onChange }: ChoicePillsProps<T>) {
  return (
    <View>
      {label && <Text className="text-sm font-medium text-text mb-xs">{label}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={String(choice.value)}
              onPress={() => onChange(choice.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className="active:opacity-70"
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? '#2563EB' : '#E5E7EB',
                backgroundColor: selected ? '#2563EB' : '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? '#FFFFFF' : '#374151' }}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
