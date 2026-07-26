import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

import { PasswordFieldProps } from './PasswordField.types';

export default function PasswordField({
  label,
  error,
  containerStyle,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View className="mb-md" style={containerStyle}>
      {label && <Text className="mb-xs text-caption font-semibold text-text">{label}</Text>}

      <View className={`flex-row items-center border rounded-xl bg-surface ${error ? 'border-danger' : 'border-border'}`}>
        <TextInput
          {...props}
          secureTextEntry={!visible}
          className="flex-1 px-md py-[14px] text-body text-text"
          placeholderTextColor="#94A3B8"
        />

        <Pressable
          className="px-md py-[14px]"
          onPress={() => setVisible(!visible)}
        >
          <Text className="text-caption font-semibold text-primary">
            {visible ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      </View>

      {error && <Text className="text-danger mt-xs text-small">{error}</Text>}
    </View>
  );
}