import { Component, HostListener, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="sticky top-0 z-50 transition duration-300"
            [class.glass]="scrolled()" [class.!border-x-0]="scrolled()" [class.!border-t-0]="scrolled()">
      <nav class="container-x flex h-16 items-center justify-between gap-4">
        <a routerLink="/" class="flex items-center gap-2" aria-label="SurgeCart home">
          <span class="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blush to-orchid text-sm shadow-glow">⚡</span>
          <span class="font-display text-xl font-semibold tracking-tight">SurgeCart</span>
        </a>

        <div class="hidden items-center gap-8 text-sm text-mist-300 md:flex">
          <a routerLink="/" fragment="drops" class="transition hover:text-white">Live drops</a>
          <a routerLink="/" fragment="reviews" class="transition hover:text-white">Reviews</a>
          @if (auth.isAuthenticated()) {
            <a routerLink="/orders" routerLinkActive="!text-white" class="transition hover:text-white">Orders</a>
            @if (auth.isAdmin()) { <a routerLink="/admin" routerLinkActive="!text-white" class="transition hover:text-white">Admin</a> }
          }
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          @if (auth.isAuthenticated()) {
            <span class="hidden max-w-[12rem] truncate text-xs text-mist lg:block">{{ auth.email() }}</span>
            <button type="button" (click)="logout()" class="btn-ghost !px-4 !py-2 text-xs">Log out</button>
          } @else {
            <a routerLink="/login" class="btn-ghost !px-4 !py-2 text-xs">Log in</a>
          }
          <a routerLink="/cart" class="relative grid h-10 w-10 place-items-center rounded-full border border-white/15 transition hover:border-white/40"
             [attr.aria-label]="'Bag, ' + cart.count() + ' items'">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            @if (cart.count()) {
              <span class="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-blush px-1 text-[10px] font-bold">{{ cart.count() }}</span>
            }
          </a>
        </div>
      </nav>
    </header>

    <main class="min-h-[70vh]"><router-outlet /></main>

    <footer class="mt-12 border-t border-white/5">
      <div class="container-x flex flex-col items-center justify-between gap-4 py-10 text-sm text-mist md:flex-row">
        <p class="flex items-center gap-2">
          <span class="font-display text-base text-white">SurgeCart</span> · Luxury drops, gone in seconds.
        </p>
        <p>Demo store · payments are simulated · © {{ year }}</p>
      </div>
    </footer>
  `,
})
export class AppComponent {
  readonly year = new Date().getFullYear();
  scrolled = signal(false);

  constructor(public auth: AuthService, public cart: CartService, private router: Router) {}

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  logout(): void {
    this.auth.logout().subscribe({ complete: () => this.router.navigateByUrl('/') });
  }
}
