import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/models/reservation.model';
import { safeReturnUrl } from './return-url';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="container-x grid min-h-[80vh] place-items-center py-16">
      <div class="card w-full max-w-md p-8 sm:p-10">
        <p class="eyebrow">Join SurgeCart</p>
        <h1 class="mt-3 font-display text-4xl font-semibold">Luxury for less. <span class="italic text-gradient">Every drop.</span></h1>
        <p class="mt-3 text-sm text-mist-300">Create a free account to buy, save a bag and review your hauls.</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-4">
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-mist-300">Email</span>
            <input formControlName="email" type="email" autocomplete="email" placeholder="you@example.com" class="field" />
          </label>
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-mist-300">Password</span>
            <input formControlName="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" class="field" />
          </label>
          <button type="submit" [disabled]="form.invalid || loading()" class="btn-primary w-full !py-3.5">
            {{ loading() ? 'Creating your account…' : 'Create account' }}
          </button>
        </form>
        @if (error()) {
          <p class="mt-4 rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush-400">{{ error()!.message }}</p>
        }
        <p class="mt-6 text-center text-sm text-mist">Already have an account?
          <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl }" class="font-semibold text-blush-400 hover:text-blush">Log in</a>
        </p>
      </div>
    </section>
  `,
})
export class RegisterComponent {
  loading = signal(false);
  error = signal<ApiError | null>(null);
  readonly returnUrl: string;

  form: ReturnType<FormBuilder['group']>;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, route: ActivatedRoute) {
    this.returnUrl = safeReturnUrl(route.snapshot.queryParamMap.get('returnUrl'));
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.register(this.form.value.email!, this.form.value.password!).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),
      error: (err: ApiError) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
