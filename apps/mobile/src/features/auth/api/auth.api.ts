import { api } from '@/lib/api';

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  AuthResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  GoogleAuthRequest,
  GoogleRecoverRequest,
  AppleAuthRequest,
  RecoverRequest,
  RecoveryCodeResponse,
  SetPinRequest,
  VerifyPinRequest,
  PinLoginRequest,
  PinResponse,
} from '../types/auth.types';
import { API_ENDPOINTS } from '@/shared/constants/api';

// The free Render instance can take most of a minute to wake up, and a social
// sign-in or account recovery is often the first request it sees.
const COLD_START_TIMEOUT_MS = 90_000;

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
      { timeout: COLD_START_TIMEOUT_MS },
    );

    return data;
  }

  static async appleLogin(
    payload: AppleAuthRequest,
  ): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>(
      API_ENDPOINTS.AUTH.APPLE,
      payload,
      { timeout: COLD_START_TIMEOUT_MS },
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

  static async logout(refreshToken?: string): Promise<AuthResponse> {
    const { data } =
      await api.post<AuthResponse>(
        API_ENDPOINTS.AUTH.LOGOUT,
        { refreshToken },
      );

    return data;
  }

  static async logoutAll(): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGOUT_ALL);

    return data;
  }

  static async recover(payload: RecoverRequest): Promise<RecoveryCodeResponse> {
    const { data } = await api.post<RecoveryCodeResponse>(
      API_ENDPOINTS.AUTH.RECOVER,
      payload,
      { timeout: COLD_START_TIMEOUT_MS },
    );

    return data;
  }

  static async recoverWithGoogle(payload: GoogleRecoverRequest): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>(
      API_ENDPOINTS.AUTH.RECOVER_GOOGLE,
      payload,
      { timeout: COLD_START_TIMEOUT_MS },
    );

    return data;
  }

  static async createRecoveryCode(password: string): Promise<RecoveryCodeResponse> {
    const { data } = await api.post<RecoveryCodeResponse>(
      API_ENDPOINTS.AUTH.RECOVERY_CODE,
      { password },
    );

    return data;
  }

  static async me() {
    const { data } =
      await api.get(API_ENDPOINTS.AUTH.ME);

    return data;
  }
}