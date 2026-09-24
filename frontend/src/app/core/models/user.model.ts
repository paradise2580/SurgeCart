export interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  email: string;
  role: 'ADMIN' | 'BUYER';
}
