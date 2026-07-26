import { View, ActivityIndicator } from 'react-native';

import { LoaderProps } from './Loader.types';

export default function Loader({
  size = 'large',
  color,
  fullScreen = false,
  style,
}: LoaderProps) {
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={style}>
        <ActivityIndicator size={size} color={color} />
      </View>
    );
  }

  return (
    <View className="items-center justify-center" style={style}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}