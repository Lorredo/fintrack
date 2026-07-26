import { View } from 'react-native';
import Button from '@/components/ui/Button/Button';

import { SubmitButtonProps } from './SubmitButton.types';

export default function SubmitButton({
  title,
  loading = false,
  disabled = false,
  variant = 'primary',
  onPress,
  style,
}: SubmitButtonProps) {
  return (
    <View className="mt-2" style={style}>
      <Button
        title={title}
        loading={loading}
        disabled={disabled || loading}
        variant={variant as any}
        onPress={onPress}
      />
    </View>
  );
}