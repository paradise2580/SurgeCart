import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="relative">
      <input [formControl]="control()" [type]="visible() ? 'text' : 'password'" [attr.autocomplete]="autocomplete()"
             [placeholder]="placeholder()" class="field pr-12" />
      <button type="button" (click)="visible.set(!visible())"
              class="absolute inset-y-0 right-2 my-auto grid h-9 w-9 place-items-center rounded-lg text-mist transition hover:bg-white/5 hover:text-white"
              [attr.aria-label]="visible() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="visible()">
        @if (visible()) {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.4 8 2.8 10.1 2 12c1 2.5 5 7 10 7 1.8 0 3.4-.6 4.8-1.4"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>
        } @else {
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        }
      </button>
    </div>
  `,
})
export class PasswordFieldComponent {
  control = input.required<FormControl>();
  placeholder = input('••••••••');
  autocomplete = input('current-password');
  visible = signal(false);
}
