import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { SaleService } from '../../core/services/sale.service';
import { SaleSocketService } from '../../core/services/sale-socket.service';
import { SaleEvent } from '../../core/models/sale.model';
import { ApiError, ReserveResponse } from '../../core/models/reservation.model';

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
  imports: [CommonModule],
  template: `
    <div class="max-w-xl mx-auto p-6">
      @if (state() === 'loading') {
        <p class="text-gray-500">Loading…</p>
      }

      @if (sale(); as s) {
        <div class="border rounded-lg p-5">
          @if (s.imageUrl) {
            <img [src]="s.imageUrl" class="w-full h-56 object-cover rounded mb-4" [alt]="s.productTitle" />
          }
          <h1 class="text-xl font-bold">{{ s.productTitle }}</h1>
          <p class="text-2xl text-blue-600 font-bold my-2">₹{{ s.salePrice }}</p>

          <div class="flex items-center gap-2 mb-4">
            <span class="inline-block w-2 h-2 rounded-full"
                  [class.bg-green-500]="socket.connected()" [class.bg-gray-300]="!socket.connected()"></span>
            <span class="text-xs text-gray-500">{{ socket.connected() ? 'Live' : 'Reconnecting…' }}</span>
          </div>

          @switch (state()) {
            @case ('not-started') {
              <p class="text-gray-600">This sale hasn't started yet. Starts {{ s.startsAt | date:'medium' }}.</p>
            }

            @case ('live') {
              <p class="mb-3 font-medium">{{ stockRemaining() }} left</p>
              <button (click)="reserve()" [disabled]="reserving() || stockRemaining() === 0"
                      class="w-full bg-blue-600 text-white rounded py-3 font-semibold disabled:opacity-50">
                {{ reserving() ? 'Reserving…' : 'Buy now' }}
              </button>
            }

            @case ('sold-out') {
              <p class="text-red-600 font-medium">Sold out.</p>
            }

            @case ('held') {
              <div class="bg-amber-50 border border-amber-200 rounded p-4">
                <p class="font-semibold">Reserved — complete checkout within</p>
                <p class="text-3xl font-bold text-amber-700">{{ formattedCountdown() }}</p>
                <div class="flex gap-2 mt-3">
                  <button (click)="checkout()" [disabled]="checkingOut()"
                          class="flex-1 bg-green-600 text-white rounded py-2 font-semibold disabled:opacity-50">
                    {{ checkingOut() ? 'Processing…' : 'Pay now' }}
                  </button>
                  <button (click)="cancelReservation()" class="px-4 border rounded">Cancel</button>
                </div>
              </div>
            }

            @case ('expired') {
              <p class="text-red-600 font-medium mb-3">Your reservation expired.</p>
              <button (click)="reset()" class="w-full bg-blue-600 text-white rounded py-2">Try again</button>
            }

            @case ('payment-processing') {
              <p class="text-gray-600">Processing your payment…</p>
            }

            @case ('payment-failed') {
              <p class="text-red-600 font-medium mb-3">Payment failed. Your reservation is still held — you can retry.</p>
              <button (click)="checkout()" class="w-full bg-blue-600 text-white rounded py-2">Retry payment</button>
            }

            @case ('confirmed') {
              <div class="bg-green-50 border border-green-200 rounded p-4 text-center">
                <p class="text-green-700 font-semibold text-lg">Order confirmed 🎉</p>
                <p class="text-sm text-gray-600 mt-1">Payment ID: {{ paymentId() }}</p>
              </div>
            }

            @case ('error') {
              <p class="text-red-600 font-medium">{{ errorMessage() }}</p>
              <button (click)="reset()" class="mt-3 w-full border rounded py-2">Back</button>
            }
          }
        </div>
      }
    </div>
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
    public socket: SaleSocketService
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

  reset(): void {
    this.reservationToken.set(null);
    this.expiresAtMs.set(null);
    this.loadSale();
  }
}
