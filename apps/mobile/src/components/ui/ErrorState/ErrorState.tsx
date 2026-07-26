import { View, Text, Pressable } from 'react-native';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-lg">
      <View className="w-16 h-16 rounded-full bg-danger/10 items-center justify-center mb-md">
        <Text className="text-danger text-h2">!</Text>
      </View>

      <Text className="text-textPrimary text-h3 font-bold text-center mb-sm">
        {title}
      </Text>

      <Text className="text-textSecondary text-body text-center mb-lg max-w-[300px]">
        {message}
      </Text>

      {onRetry && (
        <Pressable
          className="bg-primary px-lg py-3 rounded-md"
          onPress={onRetry}
        >
          <Text className="text-white text-body font-medium">{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}