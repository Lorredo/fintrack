import { useState } from 'react';
import { View, Image, Text } from 'react-native';

import { AvatarProps } from './Avatar.types';

export default function Avatar({
  name,
  source,
  size = 40,
  style,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  const initials =
    name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';

  const imageSource = typeof source === 'string' ? { uri: source } : source;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
      className={`rounded-full items-center justify-center overflow-hidden ${name ? 'bg-primary' : 'bg-disabled'}`}
    >
      {imageSource && !hasError ? (
        <Image
          source={imageSource}
          className="w-full h-full"
          resizeMode="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <Text
          className="text-white font-semibold"
          style={{ fontSize: size * 0.4 }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}