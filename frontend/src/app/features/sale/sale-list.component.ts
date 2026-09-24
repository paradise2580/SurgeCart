import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SaleService } from '../../core/services/sale.service';
import { SaleEvent } from '../../core/models/sale.model';

@Component({
  selector: 'app-sale-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-2xl font-bold mb-6">Live sales</h1>

      @if (loading()) {
        <p class="text-gray-500">Loading…</p>
      } @else if (sales().length === 0) {
        <p class="text-gray-500">No sales are live right now. Check back soon.</p>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          @for (sale of sales(); track sale.id) {
            <a [routerLink]="['/sales', sale.id]"
               class="border rounded-lg p-4 hover:shadow-md transition block">
              @if (sale.imageUrl) {
                <img [src]="sale.imageUrl" class="w-full h-40 object-cover rounded mb-3" [alt]="sale.productTitle" />
              }
              <h2 class="font-semibold">{{ sale.productTitle }}</h2>
              <p class="text-lg text-blue-600 font-bold">₹{{ sale.salePrice }}</p>
              <p class="text-sm" [class.text-red-600]="sale.stockRemaining === 0" [class.text-gray-600]="sale.stockRemaining > 0">
                {{ sale.stockRemaining === 0 ? 'Sold out' : sale.stockRemaining + ' left' }}
              </p>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class SaleListComponent implements OnInit {
  sales = signal<SaleEvent[]>([]);
  loading = signal(true);

  constructor(private saleService: SaleService) {}

  ngOnInit(): void {
    this.saleService.listLive().subscribe({
      next: (sales) => { this.sales.set(sales); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
