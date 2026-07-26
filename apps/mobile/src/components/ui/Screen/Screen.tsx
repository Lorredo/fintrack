import {
  SafeAreaView,
  ViewStyle,
} from "react-native";

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}

export default function Screen({
  children,
  style,
  padded = true,
}: ScreenProps) {
  return (
    <SafeAreaView
      className={`flex-1 bg-background ${padded ? "px-md" : ""}`}
      style={style}
    >
      {children}
    </SafeAreaView>
  );
}
