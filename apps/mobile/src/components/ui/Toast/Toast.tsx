import { View, Text, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ToastProps } from './Toast.types';
import { ToastType } from './Toast.types';

const typeConfig: Record<ToastType, { borderColor: string; iconName: 'check-circle' | 'alert-circle' | 'alert' | 'information'; iconColor: string }> = {
  success: { borderColor: '#22C55E', iconName: 'check-circle', iconColor: '#22C55E' },
  error: { borderColor: '#EF4444', iconName: 'alert-circle', iconColor: '#EF4444' },
  warning: { borderColor: '#F59E0B', iconName: 'alert', iconColor: '#F59E0B' },
  info: { borderColor: '#2563EB', iconName: 'information', iconColor: '#2563EB' },
};

export default function Toast({
  message,
  type,
  onDismiss,
  style,
}: ToastProps) {
  const config = typeConfig[type];

  return (
    <View
      className="flex-row items-center bg-surface rounded-xl px-md py-sm mb-sm"
      style={[
        {
          borderLeftWidth: 4,
          borderLeftColor: config.borderColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 4,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={config.iconName}
        size={20}
        color={config.iconColor}
      />
      <Text className="text-text text-caption font-medium flex-1 ml-sm" numberOfLines={2}>
        {message}
      </Text>
      <Pressable className="ml-sm p-1" onPress={onDismiss}>
        <MaterialCommunityIcons name="close" size={16} color="#6B7280" />
      </Pressable>
    </View>
  );
}