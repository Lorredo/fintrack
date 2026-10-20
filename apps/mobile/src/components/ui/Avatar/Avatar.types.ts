import { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

export interface AvatarProps {
  name?: string;
  source?: ImageSourcePropType | string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}