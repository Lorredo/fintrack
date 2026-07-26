import { View, Text, TextInput } from 'react-native';

import { TextFieldProps } from './TextField.types';

export default function TextField({
  label,
  error,
  containerStyle,
  ...props
}: TextFieldProps) {
  return (
    <View className="mb-md" style={containerStyle}>
      {label && <Text className="mb-xs text-caption font-semibold text-text">{label}</Text>}

      <TextInput
        {...props}
        className={`border rounded-xl px-md py-[14px] text-body text-text bg-surface ${error ? 'border-danger' : 'border-border'}`}
        placeholderTextColor="#94A3B8"
      />

      {error && <Text className="text-danger mt-xs text-small">{error}</Text>}
    </View>
  );
}