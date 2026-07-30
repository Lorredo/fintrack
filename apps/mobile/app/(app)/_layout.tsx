import AuthGuard from "@/shared/navigation/AuthGuard";
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <AuthGuard>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Define all your screens here */}
        <Stack.Screen name="index" />           {/* This is app/(app)/index.tsx */}
        <Stack.Screen name="dashboard" />       {/* This is app/(app)/dashboard/index.tsx */}
        <Stack.Screen name="transactions" />    {/* This is app/(app)/transactions/index.tsx */}
        <Stack.Screen name="budgets" />         {/* This is app/(app)/budgets/index.tsx */}
        <Stack.Screen name="reports" />         {/* This is app/(app)/reports/index.tsx */}
      </Stack>
    </AuthGuard>
  );
}