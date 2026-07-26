import { View } from "react-native";
import { CardProps } from "./Card.types";

export default function Card({
  children,
  style,
}: CardProps) {
  return (
    <View
      className="bg-surface rounded-lg p-md shadow-md"
      style={[
        {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}