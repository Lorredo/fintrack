import "../src/global.css";
import { Stack } from "expo-router";
import { AppProvider } from "@/providers/AppProvider";
import AuthInitializer from "@/providers/AuthInitializer";
import ApiInitializer from "@/providers/ApiInitializer";

export default function RootLayout() {
  return (
    <AppProvider>
      <AuthInitializer />

      <ApiInitializer />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProvider>
  );
}