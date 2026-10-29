import type { User } from './user.types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthResponse {
  message: string;
}

export interface GoogleAuthRequest {
  idToken: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface AppleAuthRequest {
  identityToken: string;
  user?: string;
  email?: string;
  fullName?: string;
}

export interface SetPinRequest {
  pin: string;
}

export interface VerifyPinRequest {
  pin: string;
}

export interface PinLoginRequest {
  pin: string;
  email: string;
}

export interface PinResponse {
  message: string;
}