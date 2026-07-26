import { View, Text } from 'react-native';

import { BadgeProps } from './Badge.types';

const variantClasses: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  outline: 'bg-transparent border border-primary',
};

export default function Badge({
  label,
  variant = 'primary',
  size = 'md',
  style,
}: BadgeProps) {
  const isOutline = variant === 'outline';

  return (
    <View
      className={`self-start rounded-full ${variantClasses[variant]} ${size === 'sm' ? 'px-2 py-[2px]' : 'px-[10px] py-1'}`}
      style={style}
    >
      <Text
        className={`font-semibold ${isOutline ? 'text-primary' : 'text-white'} ${size === 'sm' ? 'text-small' : 'text-small'}`}
      >
        {label}
      </Text>
    </View>
  );
}