import { View } from "react-native";
import { CardProps } from "./Card.types";

export default function Card({
  children,
  style,
  variant = "default",
}: CardProps & { variant?: "default" | "flat" | "elevated" }) {

  const shadowStyles = {
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    elevated: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
    flat: {},
  };

  return (
    <View
      className={`bg-surface rounded-xl p-md ${variant === "flat" ? "border border-border" : ""}`}
      style={[shadowStyles[variant], style]}
    >
      {children}
    </View>
  );
}