import { View, ActivityIndicator, Text } from 'react-native';

interface FullScreenLoaderProps {
  message?: string;
  color?: string;
  size?: 'small' | 'large';
}

export function FullScreenLoader({
  message = 'Loading...',
  color = '#0891b2', // primary
  size = 'large',
}: FullScreenLoaderProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text className="text-textSecondary text-body mt-md text-center">
          {message}
        </Text>
      )}
    </View>
  );
}