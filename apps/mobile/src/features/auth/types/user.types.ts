export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  authProvider?: string;
  avatarUrl?: string;
  hasPin?: boolean;
  hasPassword?: boolean;
  hasRecoveryCode?: boolean;
  createdAt: string;
  updatedAt: string;
}
