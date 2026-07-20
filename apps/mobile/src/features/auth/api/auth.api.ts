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


  console.log(
    "MOCK LOGIN REQUEST",
    payload
  );


  await new Promise(
    resolve => setTimeout(resolve,1000)
  );


  if(
    payload.email !== "test@test.com" ||
    payload.password !== "12345678"
  ){

    throw new Error(
      "Invalid credentials"
    );

  }


  const response: LoginResponse = {

    user: {

      id: 1,

      firstName: "Test",

      lastName: "User",

      email: payload.email,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),

    },


    tokens: {

      accessToken:
        "mock-access-token",

      refreshToken:
        "mock-refresh-token",

    }

  };


  return response;
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