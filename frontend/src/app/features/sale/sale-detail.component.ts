import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { SaleService } from '../../core/services/sale.service';
import { SaleSocketService } from '../../core/services/sale-socket.service';
import { SaleEvent } from '../../core/models/sale.model';
import { ApiError, ReserveResponse } from '../../core/models/reservation.model';
import { CartService } from '../../core/services/cart.service';
import { StockBarComponent } from '../../shared/stock-bar.component';

type ViewState =
  | 'loading'
  | 'not-started'
  | 'live'
  | 'sold-out'
  | 'held'
  | 'expired'
  | 'payment-processing'
  | 'payment-failed'
  | 'confirmed'
  | 'error';

@Component({
  selector: 'app-sale-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, StockBarComponent],
  template: `
    <section class="container-x py-10 md:py-16">
      <a routerLink="/" fragment="drops" class="inline-flex items-center gap-2 text-sm text-mist transition hover:text-white">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        All drops
      </a>

      @if (state() === 'loading' && !sale()) {
        <div class="mt-8 grid gap-10 lg:grid-cols-2">
          <div class="card aspect-square animate-pulse"></div>
          <div class="space-y-4"><div class="h-10 w-2/3 animate-pulse rounded-xl bg-white/5"></div><div class="h-6 w-1/3 animate-pulse rounded-xl bg-white/5"></div></div>
        </div>
      }

      @if (sale(); as s) {
        <div class="mt-8 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          <div class="card product-stage relative grid aspect-square place-items-center overflow-hidden">
            <div class="absolute inset-16 rounded-full bg-blush/20 blur-3xl"></div>
            <span class="absolute left-5 top-5 rounded-full bg-blush px-3 py-1 text-xs font-bold">{{ discountPct() }}% OFF</span>
            @if (s.imageUrl) {
              <img [src]="s.imageUrl" [alt]="s.productTitle"
                   class="relative h-[80%] w-[80%] animate-float object-contain drop-shadow-[0_40px_40px_rgba(0,0,0,0.7)]" />
            }
          </div>

          <div class="lg:pt-6">
            <div class="flex items-center gap-3">
              <p class="eyebrow">{{ s.category }}</p>
              <span class="flex items-center gap-1.5 text-xs text-mist">
                <span class="h-1.5 w-1.5 rounded-full" [class.bg-emerald-400]="socket.connected()" [class.bg-mist]="!socket.connected()"></span>
                {{ socket.connected() ? 'Live stock' : 'Reconnecting…' }}
              </span>
            </div>
            <h1 class="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">{{ s.productTitle }}</h1>
            @if (s.description) { <p class="mt-4 max-w-lg text-mist-300">{{ s.description }}</p> }

            <div class="mt-6 flex flex-wrap items-baseline gap-3">
              <span class="text-4xl font-bold">₹{{ s.salePrice | number:'1.0-0' }}</span>
              <span class="text-lg text-mist line-through">₹{{ s.basePrice | number:'1.0-0' }}</span>
              <span class="text-sm font-semibold text-emerald-400">Save ₹{{ s.basePrice - s.salePrice | number:'1.0-0' }}</span>
            </div>
            <p class="mt-1 text-xs text-mist">Inclusive of all taxes · Limit {{ s.perUserLimit }} per shopper</p>

            <div class="mt-8 max-w-md"><app-stock-bar [remaining]="stockRemaining()" [total]="s.totalStock" /></div>

            <div class="mt-8 max-w-md">
              @switch (state()) {
                @case ('not-started') {
                  <p class="card p-5 text-mist-300">This drop opens {{ s.startsAt | date:'medium' }}.</p>
                }

                @case ('live') {
                  <div class="flex gap-3">
                    <button (click)="reserve()" [disabled]="reserving() || stockRemaining() === 0" class="btn-primary flex-1 !py-4 text-base">
                      {{ reserving() ? 'Securing yours…' : 'Buy now' }}
                    </button>
                    <button type="button" (click)="toggleBag(s)" class="btn-ghost !py-4" [class.!border-blush]="inBag()">
                      {{ inBag() ? '✓ In bag' : 'Add to bag' }}
                    </button>
                  </div>
                  <p class="mt-3 text-xs text-mist">Buy now holds one for you for 90 seconds while you pay.</p>
                }

                @case ('sold-out') {
                  <p class="card p-5 font-medium text-blush-400">Sold out. This drop is gone for good.</p>
                }

                @case ('held') {
                  <div class="card border-gold/40 p-6">
                    <p class="text-sm font-semibold text-gold">It's yours for the next</p>
                    <p class="mt-1 font-display text-6xl font-semibold tabular-nums">{{ formattedCountdown() }}</p>
                    <div class="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                      <div class="h-full bg-gold transition-[width] duration-500" [style.width.%]="secondsRemaining() / 0.9"></div>
                    </div>
                    <div class="mt-5 flex gap-3">
                      <button (click)="checkout()" [disabled]="checkingOut()" class="btn-success flex-1 !py-3.5">
                        {{ checkingOut() ? 'Processing…' : 'Pay ₹' + (s.salePrice | number:'1.0-0') }}
                      </button>
                      <button (click)="cancelReservation()" class="btn-ghost">Cancel</button>
                    </div>
                  </div>
                }

                @case ('expired') {
                  <div class="card p-5">
                    <p class="font-medium text-blush-400">Your hold expired and the item went back on sale.</p>
                    <button (click)="reset()" class="btn-primary mt-4 w-full">Try again</button>
                  </div>
                }

                @case ('payment-processing') {
                  <p class="card flex items-center gap-3 p-5 text-mist-300">
                    <span class="h-5 w-5 animate-spin rounded-full border-2 border-blush border-t-transparent"></span> Processing your payment…
                  </p>
                }

                @case ('payment-failed') {
                  <div class="card p-5">
                    <p class="font-medium text-blush-400">Payment failed. Your item is still held, so you can retry.</p>
                    <button (click)="checkout()" class="btn-primary mt-4 w-full">Retry payment</button>
                  </div>
                }

                @case ('confirmed') {
                  <div class="card border-emerald-500/40 p-6 text-center">
                    <p class="text-4xl">🎉</p>
                    <p class="mt-2 text-lg font-semibold text-emerald-400">Order confirmed!</p>
                    <p class="mt-1 text-xs text-mist">Payment ID: {{ paymentId() }}</p>
                    <a routerLink="/orders" class="btn-ghost mt-5">View orders</a>
                  </div>
                }

                @case ('error') {
                  <div class="card p-5">
                    <p class="font-medium text-blush-400">{{ errorMessage() }}</p>
                    <button (click)="reset()" class="btn-ghost mt-4 w-full">Back</button>
                  </div>
                }
              }
            </div>

            <ul class="mt-10 grid max-w-md grid-cols-3 gap-3 text-center text-[11px] text-mist-300">
              <li class="glass rounded-2xl px-2 py-3"><span class="block text-lg">🔒</span>Never oversold</li>
              <li class="glass rounded-2xl px-2 py-3"><span class="block text-lg">⏱️</span>90s checkout hold</li>
              <li class="glass rounded-2xl px-2 py-3"><span class="block text-lg">💳</span>No double charges</li>
            </ul>
          </div>
        </div>
      }
    </section>
  `,
})
export class SaleDetailComponent implements OnInit, OnDestroy {
  sale = signal<SaleEvent | null>(null);
  state = signal<ViewState>('loading');
  reserving = signal(false);
  checkingOut = signal(false);
  reservationToken = signal<string | null>(null);
  expiresAtMs = signal<number | null>(null);
  nowMs = signal(Date.now());
  errorMessage = signal('');
  paymentId = signal('');

  stockRemaining = computed(() => {
    const saleId = this.sale()?.id;
    const live = saleId ? this.socket.lastUpdateBySaleId()[saleId] : undefined;
    return live?.stockRemaining ?? this.sale()?.stockRemaining ?? 0;
  });

  secondsRemaining = computed(() => {
    const expires = this.expiresAtMs();
    if (!expires) return 0;
    return Math.max(0, Math.round((expires - this.nowMs()) / 1000));
  });

  discountPct = computed(() => {
    const s = this.sale();
    return s && s.basePrice > 0 ? Math.round((1 - s.salePrice / s.basePrice) * 100) : 0;
  });

  inBag = computed(() => {
    const id = this.sale()?.id;
    return id !== undefined && this.cart.items().some((i) => i.saleId === id);
  });

  formattedCountdown = computed(() => {
    const s = this.secondsRemaining();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  private tickSub?: Subscription;
  private saleId!: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private saleService: SaleService,
    public socket: SaleSocketService,
    private cart: CartService
  ) {
    // The one clock-tick effect driving both the countdown display and the
    // "held -> expired" transition, anchored to the server-synced clock.
    // Angular 18 disallows signal writes inside effect() by default (NG0600).
    // This effect legitimately needs to write — it's the single transition
    // that flips 'held' -> 'expired' the moment the server-synced countdown
    // hits zero — so opt in explicitly.
    effect(() => {
      if (this.state() === 'held' && this.secondsRemaining() === 0) {
        this.state.set('expired');
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.saleId = Number(this.route.snapshot.paramMap.get('id'));
    this.socket.connect();
    this.socket.subscribeToSale(this.saleId);

    this.tickSub = interval(500).subscribe(() => this.nowMs.set(this.socket.serverNow()));

    this.loadSale();
  }

  ngOnDestroy(): void {
    this.tickSub?.unsubscribe();
  }

  private loadSale(): void {
    this.saleService.getOne(this.saleId).subscribe({
      next: (s) => {
        this.sale.set(s);
        this.state.set(s.status === 'SCHEDULED' ? 'not-started'
          : s.stockRemaining === 0 ? 'sold-out'
          : 'live');
      },
      error: () => { this.state.set('error'); this.errorMessage.set('Could not load this sale.'); },
    });
  }

  reserve(): void {
    this.reserving.set(true);
    this.saleService.reserve(this.saleId, 1).subscribe({
      next: (res: ReserveResponse) => {
        this.reservationToken.set(res.token);
        this.expiresAtMs.set(new Date(res.expiresAt).getTime());
        this.state.set('held');
        this.reserving.set(false);
      },
      error: (err: ApiError) => {
        this.reserving.set(false);
        if (err.code === 'SOLD_OUT') this.state.set('sold-out');
        else if (err.code === 'USER_LIMIT_EXCEEDED') { this.errorMessage.set(err.message); this.state.set('error'); }
        else if (err.code === 'RATE_LIMITED') { this.errorMessage.set('Too many attempts — please wait a moment.'); this.state.set('error'); }
        else { this.errorMessage.set(err.message); this.state.set('error'); }
      },
    });
  }

  checkout(): void {
    const token = this.reservationToken();
    if (!token) return;
    this.checkingOut.set(true);
    this.state.set('payment-processing');

    this.saleService.checkout(token).subscribe({
      next: (res) => {
        this.paymentId.set(res.paymentId);
        this.state.set('confirmed');
        this.checkingOut.set(false);
      },
      error: () => {
        this.state.set('payment-failed');
        this.checkingOut.set(false);
      },
    });
  }

  cancelReservation(): void {
    const token = this.reservationToken();
    if (!token) return;
    this.saleService.release(token).subscribe({ next: () => this.reset(), error: () => this.reset() });
  }

  toggleBag(sale: SaleEvent): void {
    if (this.inBag()) this.cart.remove(sale.id);
    else this.cart.add(sale);
  }

  reset(): void {
    this.reservationToken.set(null);
    this.expiresAtMs.set(null);
    this.loadSale();
  }
}
