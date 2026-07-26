import { View, Text } from 'react-native';

import { FormErrorProps } from './FormError.types';

export default function FormError({
  message,
  style,
}: FormErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <View className="flex-row items-center gap-xs mt-xs" style={style}>
      <Text className="text-danger text-small flex-shrink">{message}</Text>
    </View>
  );
}