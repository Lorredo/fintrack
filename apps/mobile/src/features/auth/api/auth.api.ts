import { api } from '@/lib/api';

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  AuthResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  GoogleAuthRequest,
  AppleAuthRequest,
  SetPinRequest,
  VerifyPinRequest,
  PinLoginRequest,
  PinResponse,
} from '../types/auth.types';
import { API_ENDPOINTS } from '@/shared/constants/api';

// The free Render instance can take most of a minute to wake up, and a social
// sign-in is often the first request after install.
const SOCIAL_LOGIN_TIMEOUT_MS = 90_000;

export class AuthApi {
  static async login(
    payload: LoginRequest,
  ): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      payload,
    );

    return data;
  }

  static async googleLogin(
    payload: GoogleAuthRequest,
  ): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      API_ENDPOINTS.AUTH.GOOGLE,
      payload,
      { timeout: SOCIAL_LOGIN_TIMEOUT_MS },
    );

    return data;
  }

  static async appleLogin(
    payload: AppleAuthRequest,
  ): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      API_ENDPOINTS.AUTH.APPLE,
      payload,
      { timeout: SOCIAL_LOGIN_TIMEOUT_MS },
    );

    return data;
  }

  static async setPin(
    payload: SetPinRequest,
  ): Promise<PinResponse> {
    const { data } = await api.post<PinResponse>(
      API_ENDPOINTS.AUTH.PIN,
      payload,
    );

    return data;
  }

  static async verifyPin(
    payload: VerifyPinRequest,
  ): Promise<PinResponse> {
    const { data } = await api.post<PinResponse>(
      API_ENDPOINTS.AUTH.VERIFY_PIN,
      payload,
    );

    return data;
  }

  static async pinLogin(
    payload: PinLoginRequest,
  ): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      API_ENDPOINTS.AUTH.PIN_LOGIN,
      payload,
    );

    return data;
  }

  static async register(
    payload: RegisterRequest,
  ): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      payload,
    );

    return data;
  }

  static async refresh(
    payload: RefreshTokenRequest,
  ): Promise<RefreshTokenResponse> {
    const { data } =
      await api.post<RefreshTokenResponse>(
        API_ENDPOINTS.AUTH.REFRESH,
        payload,
      );

    return data;
  }

  static async logout(): Promise<AuthResponse> {
    const { data } =
      await api.post<AuthResponse>(
        API_ENDPOINTS.AUTH.LOGOUT,
      );

    return data;
  }

  static async me() {
    const { data } =
      await api.get(API_ENDPOINTS.AUTH.ME);

    return data;
  }
}