import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SaleService } from '../../core/services/sale.service';
import { OrderDto } from '../../core/models/order.model';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="container-x max-w-4xl py-16">
      <p class="eyebrow">Your hauls</p>
      <h1 class="mt-3 font-display text-4xl font-semibold">Orders</h1>
      @if (orders().length === 0) {
        <div class="card mt-10 p-12 text-center">
          <p class="text-mist-300">No orders yet. Your first steal is one drop away.</p>
          <a routerLink="/" fragment="drops" class="btn-primary mt-6">Shop live drops</a>
        </div>
      } @else {
        <div class="card mt-10 overflow-x-auto p-2">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wider text-mist">
                <th class="px-4 py-3 font-medium">Order</th><th class="px-4 py-3 font-medium">Amount</th>
                <th class="px-4 py-3 font-medium">Status</th><th class="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              @for (o of orders(); track o.id) {
                <tr class="border-t border-white/5">
                  <td class="px-4 py-4 font-medium">#{{ o.id }}</td>
                  <td class="px-4 py-4">₹{{ o.amount | number:'1.0-0' }}</td>
                  <td class="px-4 py-4">
                    <span class="rounded-full px-2.5 py-1 text-xs font-semibold" [ngClass]="statusClass[o.status]">
                      {{ o.status }}
                    </span>
                  </td>
                  <td class="px-4 py-4 text-mist-300">{{ o.createdAt | date:'d MMM, h:mm a' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class OrderHistoryComponent implements OnInit {
  readonly statusClass: Record<OrderDto['status'], string> = {
    PAID: 'bg-emerald-500/15 text-emerald-400',
    PENDING: 'bg-gold/15 text-gold',
    FAILED: 'bg-blush/15 text-blush-400',
  };
  orders = signal<OrderDto[]>([]);
  constructor(private saleService: SaleService) {}
  ngOnInit(): void {
    this.saleService.myOrders().subscribe((orders) => this.orders.set(orders));
  }
}
