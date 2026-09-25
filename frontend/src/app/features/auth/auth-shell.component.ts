import { Component, OnDestroy, OnInit, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SaleService } from '../../core/services/sale.service';
import { SaleSocketService } from '../../core/services/sale-socket.service';
import { SaleEvent } from '../../core/models/sale.model';
import { HeroSceneComponent } from '../../shared/hero-scene.component';
import { StockBarComponent } from '../../shared/stock-bar.component';

const ROTATE_MS = 3800;

/**
 * Shared stage for login and register: the particle-wave background, a
 * rotating showcase of the drops that are live right now (real data and
 * live stock, never invented activity), and the form in a glowing card.
 */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [DecimalPipe, HeroSceneComponent, StockBarComponent],
  template: `
    <section class="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden">
      <div class="absolute inset-0 -z-10 opacity-70"><app-hero-scene /></div>
      <div class="absolute -left-40 top-10 -z-10 h-[28rem] w-[28rem] animate-drift rounded-full bg-blush/20 blur-[120px]"></div>
      <div class="absolute -right-40 bottom-0 -z-10 h-[30rem] w-[30rem] animate-drift rounded-full bg-orchid/20 blur-[120px] [animation-delay:-7s]"></div>
      <div class="absolute inset-0 -z-10 bg-gradient-to-b from-ink/40 via-ink/60 to-ink"></div>

      <div class="container-x grid items-center gap-12 py-12 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.1fr_1fr] lg:gap-20">
        <!-- Showcase -->
        <div class="hidden lg:block">
          <p class="eyebrow animate-fadeUp">{{ eyebrow() }}</p>
          <h2 class="mt-4 animate-fadeUp font-display text-5xl font-semibold leading-[1.05] [animation-delay:.08s] xl:text-6xl">
            Your next favourite thing is <span class="italic text-gradient">already dropping.</span>
          </h2>

          @if (current(); as s) {
            <div class="relative mt-10 h-[21rem] max-w-xl animate-fadeUp [animation-delay:.16s]">
              @for (sale of sales(); track sale.id; let i = $index) {
                <div class="absolute inset-0 flex items-center gap-8 transition-all duration-700 ease-out"
                     [class.opacity-0]="i !== index()" [class.translate-y-6]="i !== index()" [class.pointer-events-none]="i !== index()"
                     [attr.aria-hidden]="i !== index()">
                  <div class="relative grid h-72 w-72 shrink-0 place-items-center">
                    <div class="absolute inset-4 rounded-full bg-blush/25 blur-3xl"></div>
                    <div class="absolute inset-0 rounded-full border border-white/10"></div>
                    <div class="absolute inset-8 rounded-full border border-dashed border-white/10 animate-[spin_40s_linear_infinite]"></div>
                    @if (sale.imageUrl) {
                      <img [src]="sale.imageUrl" [alt]="sale.productTitle"
                           class="relative h-56 w-56 animate-float object-contain drop-shadow-[0_30px_30px_rgba(0,0,0,0.7)]" />
                    }
                  </div>
                  <div class="min-w-0 flex-1">
                    <span class="rounded-full bg-blush px-2.5 py-1 text-[11px] font-bold">{{ discount(sale) }}% OFF</span>
                    <p class="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-mist">{{ sale.category }}</p>
                    <p class="mt-1 font-display text-3xl font-semibold leading-tight">{{ sale.productTitle }}</p>
                    <p class="mt-3"><span class="text-2xl font-bold">₹{{ sale.salePrice | number:'1.0-0' }}</span>
                      <span class="ml-2 text-mist line-through">₹{{ sale.basePrice | number:'1.0-0' }}</span></p>
                    <div class="mt-5 max-w-xs"><app-stock-bar [remaining]="stockOf(sale)" [total]="sale.totalStock" /></div>
                  </div>
                </div>
              }
            </div>

            <div class="mt-2 flex gap-2" role="tablist" aria-label="Live drops">
              @for (sale of sales(); track sale.id; let i = $index) {
                <button type="button" role="tab" (click)="goTo(i)" [attr.aria-selected]="i === index()"
                        [attr.aria-label]="sale.productTitle"
                        class="h-1.5 rounded-full transition-all duration-500"
                        [class.w-8]="i === index()" [class.bg-blush]="i === index()"
                        [class.w-3]="i !== index()" [class.bg-white]="i !== index()" [class.opacity-25]="i !== index()"></button>
              }
            </div>
          }

          <dl class="mt-12 grid max-w-lg animate-fadeUp grid-cols-3 gap-6 border-t border-white/10 pt-6 [animation-delay:.24s]">
            <div><dt class="text-xs text-mist">Live drops</dt><dd class="mt-1 text-2xl font-bold">{{ sales().length }}</dd></div>
            <div><dt class="text-xs text-mist">Up to</dt><dd class="mt-1 text-2xl font-bold">{{ maxDiscount() }}% off</dd></div>
            <div><dt class="text-xs text-mist">Units left</dt><dd class="mt-1 text-2xl font-bold">{{ unitsLeft() | number }}</dd></div>
          </dl>
        </div>

        <!-- Form -->
        <div class="mx-auto w-full max-w-md">
          @if (sales().length) {
            <div class="mb-6 flex items-center justify-center gap-3 lg:hidden">
              @for (sale of sales().slice(0, 5); track sale.id; let i = $index) {
                <div class="product-stage grid h-14 w-14 animate-fadeUp place-items-center rounded-2xl border border-white/10 bg-ink-800/80"
                     [style.animation-delay]="i * 70 + 'ms'">
                  @if (sale.imageUrl) { <img [src]="sale.imageUrl" alt="" class="h-10 w-10 object-contain" /> }
                </div>
              }
            </div>
          }
          <div class="glow-ring animate-fadeUp [animation-delay:.1s]">
            <div class="glow-ring-inner p-8 sm:p-10"><ng-content /></div>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class AuthShellComponent implements OnInit, OnDestroy {
  eyebrow = input('Members shop first');

  sales = signal<SaleEvent[]>([]);
  index = signal(0);
  current = computed(() => this.sales()[this.index()] ?? null);
  unitsLeft = computed(() => this.sales().reduce((n, s) => n + this.stockOf(s), 0));
  maxDiscount = computed(() => Math.max(0, ...this.sales().map((s) => this.discount(s))));

  private timer?: ReturnType<typeof setInterval>;

  constructor(private saleService: SaleService, private socket: SaleSocketService) {}

  ngOnInit(): void {
    this.socket.connect();
    this.saleService.listLive().subscribe({
      next: (sales) => {
        // Lead with the drops closest to selling out: that's the pull.
        const live = sales.filter((s) => s.stockRemaining > 0)
          .sort((a, b) => a.stockRemaining / a.totalStock - b.stockRemaining / b.totalStock);
        this.sales.set(live);
        live.forEach((s) => this.socket.subscribeToSale(s.id));
        this.startRotation();
      },
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  goTo(i: number): void {
    this.index.set(i);
    this.startRotation();
  }

  stockOf(s: SaleEvent): number {
    return this.socket.lastUpdateBySaleId()[s.id]?.stockRemaining ?? s.stockRemaining;
  }

  discount(s: SaleEvent): number {
    return s.basePrice > 0 ? Math.round((1 - s.salePrice / s.basePrice) * 100) : 0;
  }

  private startRotation(): void {
    clearInterval(this.timer);
    if (this.sales().length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => this.index.update((i) => (i + 1) % this.sales().length), ROTATE_MS);
  }
}
