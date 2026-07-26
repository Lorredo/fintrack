import { api } from '@/lib/api';

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  AuthResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '../types/auth.types';
import { API_ENDPOINTS } from '@/shared/constants/api';

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