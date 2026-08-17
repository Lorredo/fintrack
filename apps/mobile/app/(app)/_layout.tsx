import AuthGuard from "@/shared/navigation/AuthGuard";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AppLayout() {
  return (
    <AuthGuard>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f1f2f4ff' }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: "#2563EB",
            tabBarInactiveTintColor: "#94A3B8",
            tabBarStyle: {
              backgroundColor: "#FFFFFF",
              borderTopColor: "#E2E8F0",
              borderTopWidth: 1,
              height: 80,
              paddingBottom: 20,
              paddingTop: 12,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "600",
              marginTop: 4,
            },
          }}
        >
          {/* Hide the index redirect */}
          <Tabs.Screen
            name="index"
            options={{
              href: null,
            }}
          />
          
          {/* Dashboard from the dashboard folder */}
          <Tabs.Screen
            name="dashboard"
            options={{
              title: "Dashboard",
              tabBarIcon: ({ color, focused }) => (
                <MaterialCommunityIcons
                  name={focused ? "view-dashboard" : "view-dashboard-outline"}
                  size={24}
                  color={color}
                />
              ),
            }}
          />
          
          <Tabs.Screen
            name="transactions"
            options={{
              title: "Transactions",
              tabBarIcon: ({ color, focused }) => (
                <MaterialCommunityIcons
                  name={focused ? "credit-card" : "credit-card-outline"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="budgets"
            options={{
              title: "Budget",
              tabBarIcon: ({ color, focused }) => (
                <MaterialCommunityIcons
                  name={focused ? "wallet" : "wallet-outline"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="reports"
            options={{
              title: "Reports",
              tabBarIcon: ({ color, focused }) => (
                <MaterialCommunityIcons
                  name={focused ? "chart-bar" : "chart-bar"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="more"
            options={{
              title: "More",
              tabBarIcon: ({ color, focused }) => (
                <MaterialCommunityIcons
                  name={focused ? "dots-horizontal-circle" : "dots-horizontal-circle-outline"}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
        </Tabs>
      </SafeAreaView>
    </AuthGuard>
  );
}