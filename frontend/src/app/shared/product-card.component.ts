import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SaleEvent } from '../core/models/sale.model';
import { CartService } from '../core/services/cart.service';
import { StockBarComponent } from './stock-bar.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [DecimalPipe, RouterLink, StockBarComponent],
  template: `
    @let s = sale();
    <article class="group card relative flex h-full flex-col overflow-hidden p-3 transition duration-300
                    hover:-translate-y-1.5 hover:border-blush/40 hover:shadow-glow">
      <a [routerLink]="['/sales', s.id]" class="product-stage relative block aspect-square overflow-hidden rounded-2xl bg-ink-800">
        <span class="absolute left-3 top-3 z-10 rounded-full bg-blush px-2.5 py-1 text-[11px] font-bold text-white">
          {{ discountPct() }}% OFF
        </span>
        @if (soldOut()) {
          <span class="absolute right-3 top-3 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-mist-300">Sold out</span>
        } @else if (hot()) {
          <span class="absolute right-3 top-3 z-10 rounded-full bg-gold/90 px-2.5 py-1 text-[11px] font-bold text-ink">🔥 Selling fast</span>
        }
        @if (s.imageUrl) {
          <img [src]="s.imageUrl" [alt]="s.productTitle" loading="lazy"
               class="h-full w-full object-contain p-6 drop-shadow-[0_25px_25px_rgba(0,0,0,0.6)] transition duration-500
                      group-hover:scale-110 group-hover:-rotate-2" [class.grayscale]="soldOut()" />
        }
      </a>

      <div class="flex flex-1 flex-col px-2 pb-2 pt-4">
        <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-mist">{{ s.category }}</p>
        <a [routerLink]="['/sales', s.id]" class="mt-1 line-clamp-1 font-medium text-white hover:text-blush-400">{{ s.productTitle }}</a>

        <div class="mt-2 flex items-baseline gap-2">
          <span class="text-lg font-bold">₹{{ s.salePrice | number:'1.0-0' }}</span>
          <span class="text-sm text-mist line-through">₹{{ s.basePrice | number:'1.0-0' }}</span>
        </div>

        <div class="mt-3"><app-stock-bar [remaining]="stock()" [total]="s.totalStock" /></div>

        <div class="mt-4 flex gap-2">
          <a [routerLink]="['/sales', s.id]" class="btn-primary flex-1 !py-2.5" [class.pointer-events-none]="soldOut()"
             [class.opacity-50]="soldOut()">Buy now</a>
          <button type="button" (click)="toggleBag()" [disabled]="soldOut()"
                  class="btn-ghost !px-3.5 !py-2.5" [class.!border-blush]="inBag()"
                  [attr.aria-label]="inBag() ? 'Remove from bag' : 'Add to bag'" [title]="inBag() ? 'In your bag' : 'Add to bag'">
            @if (inBag()) {
              <svg class="h-4 w-4 text-blush" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>
            } @else {
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            }
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCardComponent {
  sale = input.required<SaleEvent>();
  /** Live stock from the socket; falls back to the REST snapshot. */
  liveStock = input<number | undefined>(undefined);

  constructor(private cart: CartService) {}

  stock = computed(() => this.liveStock() ?? this.sale().stockRemaining);
  soldOut = computed(() => this.stock() === 0);
  hot = computed(() => this.stock() / Math.max(1, this.sale().totalStock) < 0.35);
  discountPct = computed(() => Math.round((1 - this.sale().salePrice / this.sale().basePrice) * 100));
  inBag = computed(() => this.cart.items().some((i) => i.saleId === this.sale().id));

  toggleBag(): void {
    if (this.inBag()) this.cart.remove(this.sale().id);
    else this.cart.add(this.sale());
  }
}
