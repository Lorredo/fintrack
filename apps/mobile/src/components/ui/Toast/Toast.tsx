import { View, Text, Pressable } from 'react-native';

import { ToastProps } from './Toast.types';
import { ToastType } from './Toast.types';

const typeClasses: Record<ToastType, string> = {
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-primary',
};

export default function Toast({
  message,
  type,
  onDismiss,
  style,
}: ToastProps) {
  return (
    <View
      className={`flex-row items-center px-md py-3 rounded-md mb-sm shadow-md ${typeClasses[type]}`}
      style={[
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 4,
        },
        style,
      ]}
    >
      <Text className="text-white text-caption font-medium flex-1" numberOfLines={2}>
        {message}
      </Text>

      <Pressable className="ml-sm p-1" onPress={onDismiss}>
        <Text className="text-white text-body font-bold">✕</Text>
      </Pressable>
    </View>
  );
}