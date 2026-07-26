import { View, Text, Pressable } from 'react-native';

import { CheckboxProps } from './Checkbox.types';

export default function Checkbox({
  checked,
  onToggle,
  label,
  disabled = false,
  style,
}: CheckboxProps) {
  return (
    <Pressable
      className="flex-row items-center gap-sm"
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      style={style}
    >
      <View
        className={`w-[22px] h-[22px] rounded-sm border-2 items-center justify-center bg-surface ${
          checked ? 'bg-primary border-primary' : 'border-border'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        {checked && (
          <Text className="text-white text-caption font-bold">✓</Text>
        )}
      </View>

      {label && (
        <Text
          className={`text-body text-text flex-shrink ${disabled ? 'text-disabled' : ''}`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}