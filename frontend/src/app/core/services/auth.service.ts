import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/user.model';

/**
 * The access token lives ONLY in this signal — never localStorage,
 * sessionStorage, or a cookie. An XSS payload that runs in this page can
 * read variables but has no persistent store to lift; the token dies with
 * the tab. The refresh token is the httpOnly cookie the browser manages
 * automatically (withCredentials: true on every request) — this service
 * never sees it directly.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _accessToken = signal<string | null>(null);
  private readonly _email = signal<string | null>(null);
  private readonly _role = signal<'ADMIN' | 'BUYER' | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly email = this._email.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);
  readonly isAdmin = computed(() => this._role() === 'ADMIN');

  constructor(private http: HttpClient) {}

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, { email, password }, { withCredentials: true })
      .pipe(tap((res) => this.applySession(res)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(tap((res) => this.applySession(res)));
  }

  refresh(): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(tap((res) => this.applySession(res)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.clearSession())
    );
  }

  applySession(res: AuthResponse): void {
    this._accessToken.set(res.accessToken);
    this._email.set(res.email);
    this._role.set(res.role);
  }

  clearSession(): void {
    this._accessToken.set(null);
    this._email.set(null);
    this._role.set(null);
  }
}
