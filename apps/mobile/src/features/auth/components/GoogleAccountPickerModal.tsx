import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { storage, StorageKeys } from '@/lib/storage';

export interface GoogleAccount {
  email: string;
  name: string;
  avatarUrl?: string;
}

interface GoogleAccountPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAccount: (account: GoogleAccount) => void;
  loading?: boolean;
}

const DEFAULT_ACCOUNTS: GoogleAccount[] = [
  {
    email: 'lorredoartemioiii@gmail.com',
    name: 'Artem Lorredo',
  },
  {
    email: 'bossatan2425@gmail.com',
    name: 'Boss Atan',
  },
];

const loadInitialAccounts = (): GoogleAccount[] => {
  try {
    const stored = storage.get(StorageKeys.RECENT_GOOGLE_ACCOUNTS);
    if (stored) {
      const parsed: GoogleAccount[] = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged = [...parsed];
        DEFAULT_ACCOUNTS.forEach((def) => {
          if (!merged.some((a) => a.email.toLowerCase() === def.email.toLowerCase())) {
            merged.push(def);
          }
        });
        return merged;
      }
    }
  } catch {
    // Use defaults
  }
  return DEFAULT_ACCOUNTS;
};

export const GoogleAccountPickerModal: React.FC<GoogleAccountPickerModalProps> = ({
  visible,
  onClose,
  onSelectAccount,
  loading = false,
}) => {
  const [accounts, setAccounts] = useState<GoogleAccount[]>(loadInitialAccounts);

  const saveAndSelect = (account: GoogleAccount) => {
    // Add to saved list if not present
    try {
      const updated = [
        account,
        ...accounts.filter((a) => a.email.toLowerCase() !== account.email.toLowerCase()),
      ];
      storage.set(StorageKeys.RECENT_GOOGLE_ACCOUNTS, JSON.stringify(updated.slice(0, 5)));
      setAccounts(updated);
    } catch {
      // Ignore
    }
    onSelectAccount(account);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Google Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Image
                source={require('../../../../assets/google.png')}
                style={styles.googleLogo}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>Choose an account</Text>
            </View>
            <Text style={styles.headerSubtitle}>to continue to FinTrack</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1A73E8" />
              <Text style={styles.loadingText}>Connecting with Google...</Text>
            </View>
          ) : (
            <ScrollView style={styles.accountList} showsVerticalScrollIndicator={false}>
              {accounts.map((acc, index) => {
                const initial = acc.name ? acc.name.charAt(0).toUpperCase() : acc.email.charAt(0).toUpperCase();
                const colors = ['#1A73E8', '#34A853', '#FBBC05', '#9334E8'];
                const avatarColor = colors[index % colors.length];

                return (
                  <Pressable
                    key={acc.email}
                    style={styles.accountPressable}
                    onPress={() => saveAndSelect(acc)}
                    android_ripple={{ color: '#F1F3F4' }}
                  >
                    <View style={styles.accountItem}>
                      <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                        <Text style={styles.avatarLetter}>{initial}</Text>
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={styles.accountName} numberOfLines={1}>
                          {acc.name}
                        </Text>
                        <Text style={styles.accountEmail} numberOfLines={1}>
                          {acc.email}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.disclaimerText}>
              To continue, Google will share your name, email address, and profile picture with FinTrack.
            </Text>
            <Pressable style={styles.closeButton} onPress={onClose} disabled={loading}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADCE0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleLogo: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202124',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 4,
    marginLeft: 34,
  },
  accountList: {
    paddingVertical: 8,
    maxHeight: 320,
    width: '100%',
  },
  accountPressable: {
    width: '100%',
  },
  accountItem: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 16,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#202124',
  },
  accountEmail: {
    fontSize: 13,
    color: '#5F6368',
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#5F6368',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F4',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#70757A',
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  closeButton: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5F6368',
  },
});
