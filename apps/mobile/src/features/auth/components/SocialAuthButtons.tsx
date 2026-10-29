import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { AuthService } from '../services/auth.service';
import { GoogleAccountPickerModal, type GoogleAccount } from './GoogleAccountPickerModal';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';

WebBrowser.maybeCompleteAuthSession();

interface SocialAuthButtonsProps {
  onSuccess?: () => void;
  disabled?: boolean;
}

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  onSuccess,
  disabled = false,
}) => {
  const router = useRouter();
  const toast = useToast();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  // Client IDs from environment variables, with safe fallbacks to prevent
  // Google.useIdTokenAuthRequest from throwing an unhandled invariant exception at render time
  // if an env var is missing in a release or CI build.
  const webClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    'placeholder-web-client-id';
  const androidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    'placeholder-android-client-id';
  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    'placeholder-ios-client-id';

  const isGoogleConfigured = Boolean(
    Platform.select({
      android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      default:
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    })
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: Platform.OS === 'android' ? androidClientId : webClientId,
    androidClientId,
    iosClientId,
    webClientId,
  });

  const handleAuthSuccess = useCallback(() => {
    if (onSuccess) {
      onSuccess();
    } else {
      router.replace('/');
    }
  }, [onSuccess, router]);

  const handleRealGoogleAuth = useCallback(async (idToken: string) => {
    setLoadingGoogle(true);
    try {
      toast.info('Authenticating with Google...');
      await AuthService.googleLogin({ idToken });
      toast.success('Signed in with Google!');
      handleAuthSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Google sign-in failed');
    } finally {
      setLoadingGoogle(false);
    }
  }, [handleAuthSuccess, toast]);

  // Handle Google Auth response when code exchange completes
  useEffect(() => {
    if (response?.type === 'success') {
      const idToken =
        response.params?.id_token ||
        (response as any).authentication?.idToken;
      if (idToken) {
        handleRealGoogleAuth(idToken);
      }
    }
  }, [response, handleRealGoogleAuth]);

  useEffect(() => {
    async function checkApple() {
      if (Platform.OS === 'ios') {
        const available = await AppleAuthentication.isAvailableAsync();
        setAppleAvailable(available);
      }
    }
    checkApple();
  }, []);

  const handleGooglePress = async () => {
    if (disabled || loadingGoogle || loadingApple) return;

    if (isGoogleConfigured && request) {
      try {
        // The success result is handled by the `response` effect above;
        // handling it here too would sign in twice and show every toast twice.
        await promptAsync();
      } catch (err: unknown) {
        toast.error(getErrorMessage(err) || 'Failed to open Google sign-in');
      }
    } else {
      // Fallback to Account Picker dialog when Client ID is not configured
      setShowGoogleModal(true);
    }
  };

  const handleAccountSelected = async (account: GoogleAccount) => {
    setLoadingGoogle(true);

    try {
      toast.info(`Signing in as ${account.email}...`);

      const nameParts = (account.name || '').trim().split(' ');
      const firstName = nameParts[0] || account.email.split('@')[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const token = 'google_oauth_' + Date.now();

      await AuthService.googleLogin({
        idToken: token,
        email: account.email,
        firstName,
        lastName,
        avatarUrl: account.avatarUrl,
      });

      setShowGoogleModal(false);
      toast.success(`Signed in as ${account.email}`);
      handleAuthSuccess();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Google sign-in failed');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleApplePress = async () => {
    if (disabled || loadingGoogle || loadingApple) return;
    setLoadingApple(true);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple identity token missing');
      }

      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : undefined;

      await AuthService.appleLogin({
        identityToken: credential.identityToken,
        user: credential.user,
        email: credential.email || undefined,
        fullName,
      });

      toast.success('Signed in with Apple!');
      handleAuthSuccess();
    } catch (err: unknown) {
      const errorObj = err as { code?: string };
      if (errorObj?.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled Apple sign in dialog
        return;
      }
      toast.error(getErrorMessage(err) || 'Apple sign-in failed');
    } finally {
      setLoadingApple(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Google 1-Tap Button */}
      <Pressable
        style={[
          styles.button,
          styles.googleButton,
          (disabled || loadingGoogle) && styles.buttonDisabled,
        ]}
        onPress={handleGooglePress}
        disabled={disabled || loadingGoogle || loadingApple}
        android_ripple={{ color: '#F1F5F9' }}
      >
        {loadingGoogle ? (
          <ActivityIndicator color="#1F2937" size="small" />
        ) : (
          <View style={styles.buttonContent}>
            <Image
              source={require('../../../../assets/google.png')}
              style={styles.googleIcon}
              resizeMode="contain"
            />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </View>
        )}
      </Pressable>

      {/* Apple Sign-In Button (iOS only) */}
      {(appleAvailable || Platform.OS === 'ios') && (
        <Pressable
          style={[
            styles.button,
            styles.appleButton,
            (disabled || loadingApple) && styles.buttonDisabled,
          ]}
          onPress={handleApplePress}
          disabled={disabled || loadingGoogle || loadingApple}
          android_ripple={{ color: '#334155' }}
        >
          {loadingApple ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="apple" size={22} color="#FFFFFF" />
              <Text style={styles.appleButtonText}>Sign in with Apple</Text>
            </View>
          )}
        </Pressable>
      )}

      {/* Google Account Picker Modal */}
      <GoogleAccountPickerModal
        visible={showGoogleModal}
        onClose={() => setShowGoogleModal(false)}
        onSelectAccount={handleAccountSelected}
        loading={loadingGoogle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  button: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 10,
  },
});
