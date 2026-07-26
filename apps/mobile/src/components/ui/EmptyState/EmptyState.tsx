import { View, Text } from 'react-native';

import { EmptyStateProps } from './EmptyState.types';

export default function EmptyState({
  icon,
  title,
  description,
  action,
  style,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-xl" style={style}>
      {icon && <View className="mb-md">{icon}</View>}

      <Text className="text-title font-semibold text-text text-center mb-sm">{title}</Text>

      {description && (
        <Text className="text-body text-text-secondary text-center leading-[22px] mb-lg">
          {description}
        </Text>
      )}

      {action && <View className="mt-sm">{action}</View>}
    </View>
  );
}