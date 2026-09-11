import { View, Text, Pressable, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { Screen } from "@/components/ui";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const menuItems: { icon: IconName; label: string; color: string; bg: string; route?: string }[] = [
  { icon: 'wallet-outline', label: 'Wallets & Accounts', color: '#0EA5E9', bg: '#E0F2FE', route: '/(app)/accounts' },
  { icon: 'account-circle-outline', label: 'Account Settings', color: '#2563EB', bg: '#EFF6FF' },
  { icon: 'bell-outline', label: 'Notifications', color: '#7C3AED', bg: '#F5F3FF' },
  { icon: 'help-circle-outline', label: 'Help & Support', color: '#22C55E', bg: '#F0FDF4' },
  { icon: 'information-outline', label: 'About', color: '#F59E0B', bg: '#FFFBEB' },
];

export default function MeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => {
            logoutMutation.mutate(undefined, {
              onSuccess: () => router.replace("/login"),
              onError: () => router.replace("/login"),
            });
          },
        },
      ],
    );
  };

  const fullName = user ? `${user.firstName} ${user.lastName}` : "User";
  const email = user?.email ?? "";
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Screen scrollable>
      {/* Profile Card */}
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 24,
          padding: 20,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#2563EB',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
            shadowColor: '#2563EB',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{fullName}</Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{email}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
            <Text style={{ fontSize: 12, color: '#22C55E', fontWeight: '500' }}>Active Account</Text>
          </View>
        </View>
        <Pressable style={{ padding: 8, borderRadius: 10, backgroundColor: '#F5F7FA' }}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color="#6B7280" />
        </Pressable>
      </View>

      {/* Menu Items */}
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          marginBottom: 16,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {menuItems.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={() => item.route && router.push(item.route as any)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 18,
              paddingVertical: 16,
              borderBottomWidth: index < menuItems.length - 1 ? 1 : 0,
              borderBottomColor: '#F5F7FA',
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: '#111827' }}>{item.label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
          </Pressable>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* Version */}
      <Text style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
        FinTrack v1.1.0
      </Text>

      {/* Logout */}
      <View style={{ marginTop: 'auto' }}>
        <Pressable
          onPress={handleLogout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: '#FEE2E2',
            borderRadius: 14,
            paddingVertical: 14,
            gap: 8,
            backgroundColor: '#FEF2F2',
          }}
        >
          {logoutMutation.isPending ? (
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#EF4444' }}>Logging out...</Text>
          ) : (
            <>
              <MaterialCommunityIcons name="logout" size={18} color="#EF4444" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#EF4444' }}>Logout</Text>
            </>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}
