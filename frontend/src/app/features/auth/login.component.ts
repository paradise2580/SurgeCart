import { Component, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/models/reservation.model';
import { safeReturnUrl } from './return-url';
import { AuthShellComponent } from './auth-shell.component';
import { PasswordFieldComponent } from './password-field.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, PasswordFieldComponent],
  template: `
    <app-auth-shell eyebrow="Welcome back">
      <p class="eyebrow animate-fadeUp [animation-delay:.15s]">Log in</p>
      <h1 class="mt-3 animate-fadeUp font-display text-4xl font-semibold [animation-delay:.2s]">
        The drop <span class="italic text-gradient">won't wait.</span>
      </h1>
      <p class="mt-3 animate-fadeUp text-sm text-mist-300 [animation-delay:.25s]">Sign in and grab it before the stock bar hits zero.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-4">
        <label class="block animate-fadeUp [animation-delay:.3s]">
          <span class="mb-1.5 block text-xs font-medium text-mist-300">Email</span>
          <input formControlName="email" type="email" autocomplete="email" placeholder="you@example.com" class="field" />
        </label>
        <label class="block animate-fadeUp [animation-delay:.36s]">
          <span class="mb-1.5 block text-xs font-medium text-mist-300">Password</span>
          <app-password-field [control]="password" placeholder="Your password" />
        </label>
        <button type="submit" [disabled]="form.invalid || loading()"
                class="btn-primary btn-shine w-full animate-fadeUp !py-3.5 [animation-delay:.42s]">
          @if (loading()) {
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span> Logging in…
          } @else {
            Log in
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          }
        </button>
      </form>
      @if (error()) {
        <p class="mt-4 animate-fadeUp rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush-400">{{ error()!.message }}</p>
      }

      <div class="my-7 flex animate-fadeUp items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-mist [animation-delay:.48s]">
        <span class="h-px flex-1 bg-white/10"></span>New to SurgeCart?<span class="h-px flex-1 bg-white/10"></span>
      </div>
      <a routerLink="/register" [queryParams]="{ returnUrl: returnUrl }"
         class="btn-ghost w-full animate-fadeUp [animation-delay:.52s]">Create a free account</a>
    </app-auth-shell>
  `,
})
export class LoginComponent {
  loading = signal(false);
  error = signal<ApiError | null>(null);
  readonly returnUrl: string;

  form: ReturnType<FormBuilder['group']>;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, route: ActivatedRoute) {
    this.returnUrl = safeReturnUrl(route.snapshot.queryParamMap.get('returnUrl'));
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  get password(): FormControl {
    return this.form.get('password') as FormControl;
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.value.email!, this.form.value.password!).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),
      error: (err: ApiError) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
