import { View, Text, Pressable } from 'react-native';

export interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View className="flex-row bg-border/30 rounded-xl p-xs">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            className={`flex-1 py-sm rounded-lg items-center ${
              isActive ? 'bg-primary' : ''
            }`}
            onPress={() => onChange(option.value)}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}