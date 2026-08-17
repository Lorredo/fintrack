import "../src/global.css";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "@/providers/AppProvider";
import AuthInitializer from "@/providers/AuthInitializer";
import ApiInitializer from "@/providers/ApiInitializer";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider>
        <AuthInitializer />
        <ApiInitializer />
        <Stack screenOptions={{ headerShown: false }} />
      </AppProvider>
    </SafeAreaProvider>
  );
}