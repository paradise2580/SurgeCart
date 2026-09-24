export interface ReserveResponse {
  token: string;
  expiresAt: string;
  stockRemaining: number;
}

export interface ReservationStatus {
  token: string;
  status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'RELEASED';
  expiresAt: string;
  secondsRemaining: number;
}

export type ReserveErrorCode = 'SOLD_OUT' | 'USER_LIMIT_EXCEEDED' | 'SALE_NOT_LIVE' | 'RATE_LIMITED' | 'DUPLICATE_IN_FLIGHT';

export interface ApiError {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  path: string;
  traceId: string;
}
