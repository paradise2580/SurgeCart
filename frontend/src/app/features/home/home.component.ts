import { Component, OnInit, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { SaleService } from '../../core/services/sale.service';
import { SaleSocketService } from '../../core/services/sale-socket.service';
import { CartService } from '../../core/services/cart.service';
import { SaleEvent } from '../../core/models/sale.model';
import { HeroSceneComponent } from '../../shared/hero-scene.component';
import { ProductCardComponent } from '../../shared/product-card.component';
import { StockBarComponent } from '../../shared/stock-bar.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { ReviewsSectionComponent } from './reviews-section.component';

const PROMISES = ['Up to 70% off', 'Never oversold', 'No double charges', '90-second checkout hold', 'Live stock, to the second', 'Secure payments'];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DecimalPipe, RouterLink, HeroSceneComponent, ProductCardComponent, StockBarComponent, RevealDirective, ReviewsSectionComponent],
  animations: [
    trigger('grid', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(32px) scale(0.97)' }),
          stagger(70, animate('600ms cubic-bezier(.2,.7,.2,1)', style({ opacity: 1, transform: 'none' }))),
        ], { optional: true }),
      ]),
    ]),
    trigger('heroIn', [
      transition(':enter', [
        query('.hero-line', [
          style({ opacity: 0, transform: 'translateY(40px)' }),
          stagger(120, animate('900ms cubic-bezier(.2,.7,.2,1)', style({ opacity: 1, transform: 'none' }))),
        ]),
      ]),
    ]),
  ],
  template: `
    <!-- HERO -->
    <section class="relative isolate overflow-hidden border-b border-white/5">
      <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(155,92,255,0.25),transparent_60%)]"></div>
      <div class="absolute inset-0 -z-10 opacity-80"><app-hero-scene /></div>
      <!-- Keeps the headline and stats legible over the moving particles. -->
      <div class="absolute inset-0 -z-10 bg-ink/55 lg:bg-transparent lg:bg-gradient-to-r lg:from-ink lg:via-ink/75 lg:to-transparent"></div>
      <div class="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-ink to-transparent"></div>

      <div @heroIn class="container-x grid min-h-[88vh] items-center gap-12 py-20 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p class="hero-line inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-mist-300">
            <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulseRing"></span>
            {{ sales().length }} drops live now
          </p>
          <h1 class="hero-line mt-7 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
            Own it before<br /> it's <span class="italic text-gradient">gone.</span>
          </h1>
          <p class="hero-line mt-6 max-w-lg text-lg text-mist-300">
            Luxury beauty, fashion and accessories at up to {{ maxDiscount() }}% off.
            Limited stock. Once it's gone, it's gone.
          </p>
          <div class="hero-line mt-9 flex flex-wrap gap-3">
            <a href="#drops" class="btn-primary !px-8 !py-4 text-base">Shop the drop
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </a>
            <a routerLink="/cart" class="btn-ghost !px-8 !py-4 text-base">View bag @if (cart.count()) { ({{ cart.count() }}) }</a>
          </div>
          <dl class="hero-line mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
            <div><dt class="text-xs text-mist">Units left</dt><dd class="mt-1 text-2xl font-bold">{{ unitsLeft() | number }}</dd></div>
            <div><dt class="text-xs text-mist">Top discount</dt><dd class="mt-1 text-2xl font-bold">{{ maxDiscount() }}%</dd></div>
            <div><dt class="text-xs text-mist">Checkout hold</dt><dd class="mt-1 text-2xl font-bold">90s</dd></div>
          </dl>
        </div>

        @if (featured(); as f) {
          <a [routerLink]="['/sales', f.id]" class="hero-line group relative mx-auto block w-full max-w-md">
            <div class="absolute inset-6 -z-10 rounded-full bg-blush/30 blur-3xl transition group-hover:bg-blush/45"></div>
            <div class="absolute inset-0 -z-10 m-auto aspect-square w-[85%] rounded-full border border-white/10"></div>
            <img [src]="f.imageUrl" [alt]="f.productTitle"
                 class="relative mx-auto aspect-square w-[88%] animate-float object-contain drop-shadow-[0_40px_40px_rgba(0,0,0,0.7)]" />
            <div class="glass absolute -bottom-4 left-0 right-0 mx-auto w-[88%] rounded-2xl p-4 sm:-left-6 sm:right-auto sm:w-72">
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-blush-400">Hottest drop</p>
                <span class="rounded-full bg-blush px-2 py-0.5 text-[10px] font-bold">{{ discount(f) }}% OFF</span>
              </div>
              <p class="mt-1 font-medium">{{ f.productTitle }}</p>
              <p class="mt-1 text-sm"><span class="font-bold">₹{{ f.salePrice | number:'1.0-0' }}</span>
                <span class="ml-1 text-mist line-through">₹{{ f.basePrice | number:'1.0-0' }}</span></p>
              <div class="mt-3"><app-stock-bar [remaining]="stockOf(f)" [total]="f.totalStock" /></div>
            </div>
          </a>
        }
      </div>
    </section>

    <!-- PROMISE MARQUEE -->
    <div class="overflow-hidden border-b border-white/5 bg-ink-800/60 py-4" aria-hidden="true">
      <div class="flex w-max animate-marquee gap-12 whitespace-nowrap text-sm font-medium text-mist-300">
        @for (p of marquee; track $index) {
          <span class="flex items-center gap-12">{{ p }} <span class="text-blush">✦</span></span>
        }
      </div>
    </div>

    <!-- DROPS -->
    <section id="drops" class="container-x scroll-mt-20 py-24">
      <div appReveal class="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p class="eyebrow">Live drops</p>
          <h2 class="mt-3 font-display text-4xl font-semibold md:text-5xl">Grab it. <span class="italic text-gradient">Flex it.</span></h2>
        </div>
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
          @for (c of categories(); track c) {
            <button type="button" role="tab" class="chip" [class.chip-active]="category() === c"
                    [attr.aria-selected]="category() === c" (click)="category.set(c)">{{ c }}</button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="mt-12 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          @for (i of [1,2,3,4]; track i) {
            <div class="card aspect-[3/4] animate-pulse bg-white/[0.03]"></div>
          }
        </div>
      } @else if (sales().length === 0) {
        <div class="card mt-12 p-12 text-center">
          <p class="font-display text-2xl">No drops live right now.</p>
          <p class="mt-2 text-mist">The next one lands soon. Keep this tab open.</p>
        </div>
      } @else {
        <div [@grid]="category()" class="mt-12 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          @for (s of filtered(); track s.id) {
            <app-product-card [sale]="s" [liveStock]="liveStock()[s.id]" />
          }
        </div>
      }
    </section>

    <app-reviews-section />
  `,
})
export class HomeComponent implements OnInit {
  readonly marquee = [...PROMISES, ...PROMISES];

  sales = signal<SaleEvent[]>([]);
  loading = signal(true);
  category = signal('All');

  liveStock = computed(() => {
    const updates = this.socket.lastUpdateBySaleId();
    const out: Record<number, number> = {};
    for (const id of Object.keys(updates)) out[+id] = updates[+id].stockRemaining;
    return out;
  });

  categories = computed(() => ['All', ...new Set(this.sales().map((s) => s.category).filter((c): c is string => !!c))]);
  filtered = computed(() => this.category() === 'All' ? this.sales() : this.sales().filter((s) => s.category === this.category()));
  unitsLeft = computed(() => this.sales().reduce((sum, s) => sum + this.stockOf(s), 0));
  maxDiscount = computed(() => Math.max(0, ...this.sales().map((s) => this.discount(s))));
  /** The drop closest to selling out that still has stock. */
  featured = computed(() => [...this.sales()]
    .filter((s) => this.stockOf(s) > 0)
    .sort((a, b) => this.stockOf(a) / a.totalStock - this.stockOf(b) / b.totalStock)[0] ?? null);

  constructor(private saleService: SaleService, private socket: SaleSocketService, public cart: CartService) {}

  ngOnInit(): void {
    this.socket.connect();
    this.saleService.listLive().subscribe({
      next: (sales) => {
        this.sales.set([...sales].sort((a, b) => a.id - b.id));
        sales.forEach((s) => this.socket.subscribeToSale(s.id));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  stockOf(s: SaleEvent): number {
    return this.liveStock()[s.id] ?? s.stockRemaining;
  }

  discount(s: SaleEvent): number {
    return s.basePrice > 0 ? Math.round((1 - s.salePrice / s.basePrice) * 100) : 0;
  }
}
