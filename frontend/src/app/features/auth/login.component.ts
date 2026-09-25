import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/models/reservation.model';
import { safeReturnUrl } from './return-url';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="container-x grid min-h-[80vh] place-items-center py-16">
      <div class="card w-full max-w-md p-8 sm:p-10">
        <p class="eyebrow">Welcome back</p>
        <h1 class="mt-3 font-display text-4xl font-semibold">Log in to <span class="italic text-gradient">shop the drop.</span></h1>
        <p class="mt-3 text-sm text-mist-300">The best deals go in seconds. Be ready when they do.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-4">
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-mist-300">Email</span>
            <input formControlName="email" type="email" autocomplete="email" placeholder="you@example.com" class="field" />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-mist-300">Password</span>
            <input formControlName="password" type="password" autocomplete="current-password" placeholder="••••••••" class="field" />
          </label>
          <button type="submit" [disabled]="form.invalid || loading()" class="btn-primary w-full !py-3.5">
            {{ loading() ? 'Logging in…' : 'Log in' }}
          </button>
        </form>
        @if (error()) {
          <p class="mt-4 rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush-400">{{ error()!.message }}</p>
        }
        <p class="mt-6 text-center text-sm text-mist">New here?
          <a routerLink="/register" [queryParams]="{ returnUrl: returnUrl }" class="font-semibold text-blush-400 hover:text-blush">Create an account</a>
        </p>
      </div>
    </section>
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
