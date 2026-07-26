import { View } from 'react-native';

import { SkeletonProps } from './Skeleton.types';

export default function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 6,
  style,
}: SkeletonProps) {
  return (
    <View
      className="bg-border overflow-hidden"
      style={[
        { width: width as any, height, borderRadius },
        style,
      ]}
    />
  );
}