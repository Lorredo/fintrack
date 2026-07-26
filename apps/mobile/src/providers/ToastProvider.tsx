import { View, Text, Pressable } from 'react-native';
import { useToastStore } from '@/features/toast/store/toast.store';

const typeClasses: Record<string, string> = {
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-primary',
};

export function ToastProvider() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <View className="absolute top-[60px] left-md right-md z-[9999]">
      {toasts.map((toast) => (
        <View
          key={toast.id}
          className={`flex-row items-center px-md py-3 rounded-md mb-sm shadow-md ${typeClasses[toast.type]}`}
        >
          <Text
            className="text-white text-caption font-medium flex-1"
            numberOfLines={2}
          >
            {toast.message}
          </Text>

          <Pressable className="ml-sm p-1" onPress={() => removeToast(toast.id)}>
            <Text className="text-white text-body font-bold">✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}