import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../core/models/reservation.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="max-w-sm mx-auto mt-16 p-6 border rounded-lg shadow-sm">
      <h1 class="text-xl font-semibold mb-4">Log in</h1>
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-3">
        <input formControlName="email" type="email" placeholder="Email"
               class="w-full border rounded px-3 py-2" />
        <input formControlName="password" type="password" placeholder="Password"
               class="w-full border rounded px-3 py-2" />
        <button type="submit" [disabled]="form.invalid || loading()"
                class="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50">
          {{ loading() ? 'Logging in…' : 'Log in' }}
        </button>
      </form>
      @if (error()) {
        <p class="text-red-600 text-sm mt-3">{{ error()!.message }}</p>
      }
      <p class="text-sm mt-4">No account? <a routerLink="/register" class="text-blue-600">Register</a></p>
    </div>
  `,
})
export class LoginComponent {
  loading = signal(false);
  error = signal<ApiError | null>(null);

    form: ReturnType<FormBuilder['group']>;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
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
      next: () => this.router.navigateByUrl('/sales'),
      error: (err: ApiError) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }
}
