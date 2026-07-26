import { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

export interface AvatarProps {
  name?: string;
  source?: ImageSourcePropType;
  size?: number;
  style?: StyleProp<ViewStyle>;
}