import AuthGuard from "@/shared/navigation/AuthGuard";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AppLayout() {
  const insets = useSafeAreaInsets();

  return (
    <AuthGuard>
      <View style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: "#2563EB",
            tabBarInactiveTintColor: "#9CA3AF",
            tabBarStyle: {
              backgroundColor: "#FFFFFF",
              borderTopWidth: 0,
              height: 60 + insets.bottom,
              paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 14,
              paddingTop: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 8,
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: "600",
              marginTop: 2,
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

          <Tabs.Screen
            name="accounts"
            options={{
              href: null,
            }}
          />
          
          <Tabs.Screen
            name="dashboard"
            options={{
              title: "Dashboard",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 4 } : { padding: 4 }}>
                  <MaterialCommunityIcons
                    name={focused ? "view-dashboard" : "view-dashboard-outline"}
                    size={22}
                    color={color}
                  />
                </View>
              ),
            }}
          />
          
          <Tabs.Screen
            name="transactions"
            options={{
              title: "Transactions",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 4 } : { padding: 4 }}>
                  <MaterialCommunityIcons
                    name={focused ? "swap-horizontal-bold" : "swap-horizontal"}
                    size={22}
                    color={color}
                  />
                </View>
              ),
            }}
          />

          <Tabs.Screen
            name="budgets"
            options={{
              href: null,
              title: "Budgets",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 4 } : { padding: 4 }}>
                  <MaterialCommunityIcons
                    name={focused ? "wallet" : "wallet-outline"}
                    size={22}
                    color={color}
                  />
                </View>
              ),
            }}
          />

          <Tabs.Screen
            name="reports"
            options={{
              title: "Reports",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 4 } : { padding: 4 }}>
                  <MaterialCommunityIcons
                    name={focused ? "chart-bar" : "chart-bar-stacked"}
                    size={22}
                    color={color}
                  />
                </View>
              ),
            }}
          />

          <Tabs.Screen
            name="me"
            options={{
              title: "Me",
              tabBarIcon: ({ color, focused }) => (
                <View style={focused ? { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 4 } : { padding: 4 }}>
                  <MaterialCommunityIcons
                    name={focused ? "account" : "account-outline"}
                    size={22}
                    color={color}
                  />
                </View>
              ),
            }}
          />
        </Tabs>
      </View>
    </AuthGuard>
  );
}
