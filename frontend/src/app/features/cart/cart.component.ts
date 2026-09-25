import { Component, OnInit, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CartItem, CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { SaleService } from '../../core/services/sale.service';
import { SaleSocketService } from '../../core/services/sale-socket.service';
import { ApiError, ReserveResponse } from '../../core/models/reservation.model';

type LineState = { status: 'idle' | 'working' | 'paid' | 'failed'; message?: string };

const FRIENDLY: Record<string, string> = {
  SOLD_OUT: 'Sold out before we got to it.',
  USER_LIMIT_EXCEEDED: "You've reached the limit for this drop.",
  SALE_NOT_LIVE: 'This drop has ended.',
  RATE_LIMITED: 'Too many attempts. Try again in a moment.',
};

/**
 * Checkout runs each bag item through the exact same reserve -> pay flow as
 * "Buy now", one after another, so the flash-sale guarantees (atomic stock
 * claim, per-user limit, idempotent payment) apply per item. One item
 * selling out never blocks the rest.
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  template: `
    <section class="container-x py-16">
      <p class="eyebrow">Your bag</p>
      <h1 class="mt-3 font-display text-4xl font-semibold md:text-5xl">
        @if (cart.count()) { Ready when you are. } @else if (paidCount()) { You're all set. } @else { Your bag is empty. }
      </h1>

      @if (cart.count() === 0 && paidCount() === 0) {
        <div class="card mt-10 flex flex-col items-center p-14 text-center">
          <span class="text-5xl">🛍️</span>
          <p class="mt-4 max-w-sm text-mist-300">Drops sell out in minutes. Add what you love and check out in one go.</p>
          <a routerLink="/" fragment="drops" class="btn-primary mt-8">Shop live drops</a>
        </div>
      }

      @if (paidCount() && cart.count() === 0) {
        <div class="card mt-10 border-emerald-500/30 p-10 text-center">
          <p class="text-4xl">🎉</p>
          <p class="mt-3 text-lg font-semibold">{{ paidCount() }} {{ paidCount() === 1 ? 'order' : 'orders' }} confirmed.</p>
          <div class="mt-6 flex justify-center gap-3">
            <a routerLink="/orders" class="btn-primary">View orders</a>
            <a routerLink="/" class="btn-ghost">Keep shopping</a>
          </div>
        </div>
      }

      @if (cart.count()) {
        <div class="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          <ul class="space-y-4">
            @for (item of cart.items(); track item.saleId) {
              @let line = lines()[item.saleId];
              <li class="card flex items-center gap-5 p-4">
                <a [routerLink]="['/sales', item.saleId]" class="product-stage grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-ink-800 sm:h-28 sm:w-28">
                  @if (item.imageUrl) { <img [src]="item.imageUrl" [alt]="item.title" class="h-full w-full object-contain p-3" /> }
                </a>
                <div class="min-w-0 flex-1">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-mist">{{ item.category }}</p>
                  <p class="mt-0.5 truncate font-medium">{{ item.title }}</p>
                  <p class="mt-1 text-sm"><span class="font-bold">₹{{ item.salePrice | number:'1.0-0' }}</span>
                    <span class="ml-2 text-mist line-through">₹{{ item.basePrice | number:'1.0-0' }}</span></p>
                  @if (line?.status === 'failed') {
                    <p class="mt-1 text-xs text-blush-400">{{ line.message }}</p>
                  } @else if (liveStock(item) !== null) {
                    <p class="mt-1 text-xs" [class.text-blush-400]="liveStock(item)! < 15" [class.text-mist]="liveStock(item)! >= 15">
                      {{ liveStock(item) === 0 ? 'Sold out' : liveStock(item) + ' left' }}
                    </p>
                  }
                </div>
                @if (line?.status === 'working') {
                  <span class="h-5 w-5 animate-spin rounded-full border-2 border-blush border-t-transparent" aria-label="Processing"></span>
                } @else {
                  <button type="button" (click)="cart.remove(item.saleId)" [disabled]="checkingOut()"
                          class="rounded-full p-2 text-mist transition hover:bg-white/5 hover:text-white" aria-label="Remove from bag">
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
                  </button>
                }
              </li>
            }
          </ul>

          <aside class="card h-fit p-6 lg:sticky lg:top-24">
            <h2 class="font-display text-2xl font-semibold">Order summary</h2>
            <dl class="mt-6 space-y-3 text-sm">
              <div class="flex justify-between"><dt class="text-mist-300">Items</dt><dd>{{ cart.count() }}</dd></div>
              <div class="flex justify-between"><dt class="text-mist-300">MRP</dt><dd class="text-mist line-through">₹{{ cart.subtotal() + cart.savings() | number:'1.0-0' }}</dd></div>
              <div class="flex justify-between"><dt class="text-mist-300">Drop discount</dt><dd class="text-emerald-400">−₹{{ cart.savings() | number:'1.0-0' }}</dd></div>
              <div class="flex justify-between border-t border-white/10 pt-4 text-base font-semibold"><dt>Total</dt><dd>₹{{ cart.subtotal() | number:'1.0-0' }}</dd></div>
            </dl>
            <p class="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">You save ₹{{ cart.savings() | number:'1.0-0' }} on this order.</p>
            @if (auth.isAuthenticated()) {
              <button type="button" class="btn-primary mt-6 w-full !py-4" (click)="checkout()" [disabled]="checkingOut()">
                {{ checkingOut() ? 'Securing your items…' : 'Checkout · ₹' + (cart.subtotal() | number:'1.0-0') }}
              </button>
            } @else {
              <button type="button" class="btn-primary mt-6 w-full !py-4" (click)="login()">Log in to checkout</button>
            }
            <p class="mt-3 text-center text-[11px] text-mist">Each item is reserved and paid for in one step. Payments are simulated.</p>
          </aside>
        </div>
      }
    </section>
  `,
})
export class CartComponent implements OnInit {
  lines = signal<Record<number, LineState>>({});
  checkingOut = signal(false);
  paidCount = computed(() => Object.values(this.lines()).filter((l) => l.status === 'paid').length);

  constructor(
    public cart: CartService,
    public auth: AuthService,
    private saleService: SaleService,
    private socket: SaleSocketService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.socket.connect();
    this.cart.items().forEach((i) => this.socket.subscribeToSale(i.saleId));
  }

  liveStock(item: CartItem): number | null {
    return this.socket.lastUpdateBySaleId()[item.saleId]?.stockRemaining ?? null;
  }

  login(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/cart' } });
  }

  async checkout(): Promise<void> {
    this.checkingOut.set(true);
    for (const item of [...this.cart.items()]) {
      this.setLine(item.saleId, { status: 'working' });
      let token: string | null = null;
      try {
        token = (await this.reserveWithBackoff(item.saleId)).token;
        await firstValueFrom(this.saleService.checkout(token));
        this.setLine(item.saleId, { status: 'paid' });
        this.cart.remove(item.saleId);
      } catch (e) {
        // A failed payment gives the held unit straight back rather than
        // keeping it off the shelf for the rest of the 90-second hold.
        if (token) this.saleService.release(token).subscribe({ error: () => {} });
        const err = e as ApiError;
        this.setLine(item.saleId, { status: 'failed', message: FRIENDLY[err?.code] ?? err?.message ?? 'Payment failed.' });
      }
    }
    this.checkingOut.set(false);
  }

  /**
   * The API allows three reserve calls per ten seconds per shopper, so a bag
   * of four or more items is paced rather than failed. A rate-limited call
   * never claimed stock, so retrying it with a fresh idempotency key is safe.
   */
  private async reserveWithBackoff(saleId: number, attempts = 4): Promise<ReserveResponse> {
    for (let i = 1; ; i++) {
      try {
        return await firstValueFrom(this.saleService.reserve(saleId, 1));
      } catch (e) {
        if ((e as ApiError)?.code !== 'RATE_LIMITED' || i >= attempts) throw e;
        await new Promise((r) => setTimeout(r, 3500));
      }
    }
  }

  private setLine(saleId: number, state: LineState): void {
    this.lines.update((l) => ({ ...l, [saleId]: state }));
  }
}
