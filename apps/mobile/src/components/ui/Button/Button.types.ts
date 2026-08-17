import {
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import type { ComponentProps } from "react";
import type { MaterialCommunityIcons } from "@expo/vector-icons";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface ButtonProps
  extends Omit<PressableProps, "style"> {

  title?: string;

  loading?: boolean;

  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "danger";

  icon?: IconName;

  iconSize?: number;

  style?: StyleProp<ViewStyle>;
}