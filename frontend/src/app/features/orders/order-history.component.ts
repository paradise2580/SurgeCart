import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaleService } from '../../core/services/sale.service';
import { OrderDto } from '../../core/models/order.model';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-2xl mx-auto p-6">
      <h1 class="text-2xl font-bold mb-6">Your orders</h1>
      @if (orders().length === 0) {
        <p class="text-gray-500">No orders yet.</p>
      } @else {
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="text-left border-b">
              <th class="py-2">Order</th><th>Amount</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            @for (o of orders(); track o.id) {
              <tr class="border-b">
                <td class="py-2">#{{ o.id }}</td>
                <td>₹{{ o.amount }}</td>
                <td>
                  <span class="px-2 py-1 rounded text-xs"
                        [class.bg-green-100]="o.status === 'PAID'" [class.text-green-700]="o.status === 'PAID'"
                        [class.bg-yellow-100]="o.status === 'PENDING'" [class.text-yellow-700]="o.status === 'PENDING'">
                    {{ o.status }}
                  </span>
                </td>
                <td>{{ o.createdAt | date:'short' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class OrderHistoryComponent implements OnInit {
  orders = signal<OrderDto[]>([]);
  constructor(private saleService: SaleService) {}
  ngOnInit(): void {
    this.saleService.myOrders().subscribe((orders) => this.orders.set(orders));
  }
}
