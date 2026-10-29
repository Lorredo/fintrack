import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import { AuthService } from '../services/auth.service';
import { AuthProgressOverlay } from './AuthProgressOverlay';
import { useToast } from '@/features/toast/hooks/useToast';
import { getErrorMessage } from '@/shared/utils/apiErrors';
import type { User } from '../types/user.types';

WebBrowser.maybeCompleteAuthSession();

const googleClientIds = {
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};

// Google.useIdTokenAuthRequest throws when the current platform's client ID
// is missing, so the Google button only renders when it's configured.
const isGoogleConfigured = Boolean(
  Platform.select({
    android: googleClientIds.androidClientId,
    ios: googleClientIds.iosClientId,
    default: googleClientIds.webClientId,
  })
);

type Provider = 'google' | 'apple';

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
  const [signingIn, setSigningIn] = useState<Provider | null>(null);
  // State updates land a render late; the ref blocks a second sign-in
  // starting in the meantime.
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const signIn = async (provider: Provider, login: () => Promise<User>) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSigningIn(provider);
    try {
      const user = await login();
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace('/');
      }
      toast.success(`Welcome, ${user.firstName}!`);
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err) || `${provider === 'google' ? 'Google' : 'Apple'} sign-in failed`
      );
    } finally {
      inFlightRef.current = false;
      setSigningIn(null);
    }
  };

  const handleApplePress = async () => {
    if (disabled || inFlightRef.current) return;

    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        toast.error(getErrorMessage(err) || 'Apple sign-in failed');
      }
      return;
    }

    const { identityToken, fullName } = credential;
    if (!identityToken) {
      toast.error('Apple sign-in failed');
      return;
    }

    await signIn('apple', () =>
      AuthService.appleLogin({
        identityToken,
        fullName: fullName
          ? [fullName.givenName, fullName.familyName].filter(Boolean).join(' ') || undefined
          : undefined,
      })
    );
  };

  const busy = disabled || signingIn !== null;

  return (
    <View style={styles.container}>
      {isGoogleConfigured && (
        <GoogleButton
          disabled={busy}
          onIdToken={(idToken) => signIn('google', () => AuthService.googleLogin(idToken))}
          onError={(message) => toast.error(message)}
        />
      )}

      {(appleAvailable || Platform.OS === 'ios') && (
        <Pressable
          style={[styles.button, styles.appleButton, busy && styles.buttonDisabled]}
          onPress={handleApplePress}
          disabled={busy}
          android_ripple={{ color: '#334155' }}
        >
          <View style={styles.buttonContent}>
            <MaterialCommunityIcons name="apple" size={22} color="#FFFFFF" />
            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
          </View>
        </Pressable>
      )}

      <AuthProgressOverlay visible={signingIn !== null} />
    </View>
  );
};

interface GoogleButtonProps {
  disabled: boolean;
  onIdToken: (idToken: string) => void;
  onError: (message: string) => void;
}

const GoogleButton: React.FC<GoogleButtonProps> = ({ disabled, onIdToken, onError }) => {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleClientIds);

  // Callbacks change identity every render; reading them through a ref keeps
  // the effect below keyed on `response` alone.
  const handlersRef = useRef({ onIdToken, onError });
  useEffect(() => {
    handlersRef.current = { onIdToken, onError };
  });

  // Each response object is handled exactly once, however often this re-renders.
  const handledResponseRef = useRef<typeof response>(null);
  useEffect(() => {
    if (!response || handledResponseRef.current === response) return;
    handledResponseRef.current = response;

    if (response.type === 'success') {
      const idToken = response.params?.id_token || response.authentication?.idToken;
      if (idToken) {
        handlersRef.current.onIdToken(idToken);
      } else {
        handlersRef.current.onError('Google did not return a sign-in token');
      }
    } else if (response.type === 'error') {
      handlersRef.current.onError(response.error?.message || 'Google sign-in failed');
    }
    // 'cancel' / 'dismiss': the user backed out, nothing to say.
  }, [response]);

  const handlePress = async () => {
    if (disabled || !request) return;
    try {
      await promptAsync();
    } catch (err: unknown) {
      onError(getErrorMessage(err) || 'Failed to open Google sign-in');
    }
  };

  return (
    <Pressable
      style={[styles.button, styles.googleButton, (disabled || !request) && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={disabled || !request}
      android_ripple={{ color: '#F1F5F9' }}
    >
      <View style={styles.buttonContent}>
        <Image
          source={require('../../../../assets/google.png')}
          style={styles.googleIcon}
          resizeMode="contain"
        />
        <Text style={styles.googleButtonText}>Continue with Google</Text>
      </View>
    </Pressable>
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
