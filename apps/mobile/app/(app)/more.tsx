import { View, Text, StyleSheet, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/features/auth/store/auth.store";

export default function MorePage() {
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
              onSuccess: () => {
                router.replace("/login");
              },
              onError: () => {
                // Even if the API call fails, clear local session and redirect
                router.replace("/login");
              },
            });
          },
        },
      ],
    );
  };

  const fullName = user ? `${user.firstName} ${user.lastName}` : "User";
  const email = user?.email ?? "";

  return (
    <View style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {fullName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <View style={styles.menuItem}>
          <MaterialCommunityIcons name="account-circle-outline" size={22} color="#64748B" />
          <Text style={styles.menuText}>Account Settings</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </View>
        <View style={styles.menuItem}>
          <MaterialCommunityIcons name="bell-outline" size={22} color="#64748B" />
          <Text style={styles.menuText}>Notifications</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </View>
        <View style={styles.menuItem}>
          <MaterialCommunityIcons name="help-circle-outline" size={22} color="#64748B" />
          <Text style={styles.menuText}>Help & Support</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </View>
        <View style={styles.menuItem}>
          <MaterialCommunityIcons name="information-outline" size={22} color="#64748B" />
          <Text style={styles.menuText}>About</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </View>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <Button
          title="Logout"
          variant="danger"
          icon="logout"
          onPress={handleLogout}
          loading={logoutMutation.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f2f4",
    padding: 20,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  email: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  menuSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
    marginLeft: 12,
  },
  logoutSection: {
    marginTop: "auto",
  },
});