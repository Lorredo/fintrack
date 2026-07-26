import {
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";

export interface ButtonProps
  extends Omit<PressableProps, "style"> {

  title: string;

  loading?: boolean;

  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "danger";

  style?: StyleProp<ViewStyle>;
}