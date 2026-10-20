import { AuthApi } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import { storage, StorageKeys } from '@/lib/storage';
import { PinService } from './pin.service';
import type {
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  AppleAuthRequest,
  GoogleAuthRequest,
} from '../types/auth.types';

export class AuthService {
  private static handleAuthSuccess(response: LoginResponse) {
    storage.set(StorageKeys.ACCESS_TOKEN, response.tokens.accessToken);
    storage.set(StorageKeys.REFRESH_TOKEN, response.tokens.refreshToken);
    storage.set(StorageKeys.USER, JSON.stringify(response.user));
    if (response.user.email) {
      storage.set(StorageKeys.REMEMBERED_EMAIL, response.user.email);
    }
    if (response.user.hasPin) {
      storage.set(StorageKeys.HAS_PIN, 'true');
    }

    useAuthStore.getState().setSession(
      response.user,
      response.tokens.accessToken,
      response.tokens.refreshToken,
    );

    return response.user;
  }

  static async login(payload: LoginRequest) {
    const response = await AuthApi.login(payload);
    return this.handleAuthSuccess(response);
  }

  static async googleLogin(payload: GoogleAuthRequest | string) {
    const req = typeof payload === 'string' ? { idToken: payload } : payload;
    const response = await AuthApi.googleLogin(req);
    return this.handleAuthSuccess(response);
  }

  static async appleLogin(payload: AppleAuthRequest) {
    const response = await AuthApi.appleLogin(payload);
    return this.handleAuthSuccess(response);
  }

  static async pinLogin(pin: string, email?: string) {
    const response = await AuthApi.pinLogin({ pin, email });
    const user = this.handleAuthSuccess(response);
    const hash = await PinService.hashPin(pin);
    storage.set(StorageKeys.PIN_HASH, hash);
    storage.set(StorageKeys.HAS_PIN, 'true');
    return user;
  }

  static async register(payload: RegisterRequest) {
    return AuthApi.register(payload);
  }

  static async logout(clearDevicePin = false) {
    try {
      await AuthApi.logout();
    } catch {
      // Ignore API errors on logout (e.g., token already expired)
    }

    storage.remove(StorageKeys.ACCESS_TOKEN);
    storage.remove(StorageKeys.REFRESH_TOKEN);

    if (clearDevicePin) {
      storage.remove(StorageKeys.USER);
      PinService.clearPin();
    }

    useAuthStore.getState().clearSession();
  }

  static getRememberedEmail(): string | undefined {
    return storage.get(StorageKeys.REMEMBERED_EMAIL);
  }

  static setRememberedEmail(email: string): void {
    storage.set(StorageKeys.REMEMBERED_EMAIL, email);
  }
}