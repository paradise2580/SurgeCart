import { Component, Signal, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/models/reservation.model';
import { safeReturnUrl } from './return-url';
import { AuthShellComponent } from './auth-shell.component';
import { PasswordFieldComponent } from './password-field.component';

const STRENGTH = [
  { label: 'Too short', color: 'bg-white/20', text: 'text-mist' },
  { label: 'Weak', color: 'bg-blush', text: 'text-blush-400' },
  { label: 'Okay', color: 'bg-gold', text: 'text-gold' },
  { label: 'Strong', color: 'bg-emerald-400', text: 'text-emerald-400' },
  { label: 'Unbreakable', color: 'bg-emerald-400', text: 'text-emerald-400' },
];

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent, PasswordFieldComponent],
  template: `
    <app-auth-shell eyebrow="Join free · Shop first">
      <p class="eyebrow animate-fadeUp [animation-delay:.15s]">Create account</p>
      <h1 class="mt-3 animate-fadeUp font-display text-4xl font-semibold [animation-delay:.2s]">
        Luxury for less. <span class="italic text-gradient">Every drop.</span>
      </h1>
      <p class="mt-3 animate-fadeUp text-sm text-mist-300 [animation-delay:.25s]">One account to buy, save a bag and review your hauls.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-4">
        <label class="block animate-fadeUp [animation-delay:.3s]">
          <span class="mb-1.5 block text-xs font-medium text-mist-300">Email</span>
          <input formControlName="email" type="email" autocomplete="email" placeholder="you@example.com" class="field" />
        </label>
        <div class="animate-fadeUp [animation-delay:.36s]">
          <label class="block">
            <span class="mb-1.5 block text-xs font-medium text-mist-300">Password</span>
            <app-password-field [control]="password" placeholder="At least 8 characters" autocomplete="new-password" />
          </label>
          @if (passwordValue()) {
            <div class="mt-2.5 flex items-center gap-3">
              <div class="flex flex-1 gap-1.5">
                @for (i of [1, 2, 3, 4]; track i) {
                  <span class="h-1 flex-1 rounded-full transition-colors duration-300"
                        [class]="i <= strength() ? level().color : 'bg-white/10'"></span>
                }
              </div>
              <span class="w-20 text-right text-[11px] font-medium" [class]="level().text">{{ level().label }}</span>
            </div>
          }
        </div>
        <button type="submit" [disabled]="form.invalid || loading()"
                class="btn-primary btn-shine w-full animate-fadeUp !py-3.5 [animation-delay:.42s]">
          @if (loading()) {
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span> Creating your account…
          } @else {
            Create account
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          }
        </button>
      </form>
      @if (error()) {
        <p class="mt-4 animate-fadeUp rounded-xl bg-blush/10 px-4 py-3 text-sm text-blush-400">{{ error()!.message }}</p>
      }

      <ul class="mt-6 grid animate-fadeUp grid-cols-3 gap-2 text-center text-[11px] text-mist-300 [animation-delay:.48s]">
        <li class="glass rounded-xl px-2 py-2.5">🔒 Never oversold</li>
        <li class="glass rounded-xl px-2 py-2.5">⏱️ 90s hold</li>
        <li class="glass rounded-xl px-2 py-2.5">💳 No double charge</li>
      </ul>

      <p class="mt-7 animate-fadeUp text-center text-sm text-mist [animation-delay:.52s]">Already have an account?
        <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl }" class="font-semibold text-blush-400 hover:text-blush">Log in</a>
      </p>
    </app-auth-shell>
  `,
})
export class RegisterComponent {
  loading = signal(false);
  error = signal<ApiError | null>(null);
  readonly returnUrl: string;

  form: ReturnType<FormBuilder['group']>;
  passwordValue: Signal<string>;
  strength = computed(() => {
    const p: string = this.passwordValue() ?? '';
    if (p.length < 8) return 0;
    return 1 + [/[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p) || p.length >= 14]
      .filter(Boolean).length;
  });
  level = computed(() => STRENGTH[Math.min(this.strength(), 4)]);

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, route: ActivatedRoute) {
    this.returnUrl = safeReturnUrl(route.snapshot.queryParamMap.get('returnUrl'));
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
    this.passwordValue = toSignal(this.password.valueChanges, { initialValue: '' });
  }

  get password(): FormControl {
    return this.form.get('password') as FormControl;
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
