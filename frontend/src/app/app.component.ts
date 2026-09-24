import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  template: `
    <nav class="border-b px-6 py-3 flex items-center justify-between">
      <a routerLink="/sales" class="font-bold text-lg">⚡ SurgeCart</a>
      <div class="flex items-center gap-4 text-sm">
        <a routerLink="/sales">Sales</a>
        @if (auth.isAuthenticated()) {
          <a routerLink="/orders">Orders</a>
          @if (auth.isAdmin()) { <a routerLink="/admin">Admin</a> }
          <span class="text-gray-500">{{ auth.email() }}</span>
          <button (click)="logout()" class="text-red-600">Log out</button>
        } @else {
          <a routerLink="/login">Log in</a>
        }
      </div>
    </nav>
    <router-outlet />
  `,
})
export class AppComponent {
  constructor(public auth: AuthService) {}
  logout(): void { this.auth.logout().subscribe(); }
}
