import { Component, OnInit, computed, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ReviewService } from '../../core/services/review.service';
import { Review } from '../../core/models/review.model';
import { ApiError } from '../../core/models/reservation.model';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-reviews-section',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NgClass, FormsModule, RouterLink, RevealDirective],
  template: `
    <section id="reviews" class="container-x py-24">
      <div appReveal class="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p class="eyebrow">Loved by shoppers</p>
          <h2 class="mt-3 font-display text-4xl font-semibold md:text-5xl">Real people. <span class="italic text-gradient">Real steals.</span></h2>
        </div>
        @if (reviews().length) {
          <div class="flex items-center gap-3">
            <span class="font-display text-5xl font-semibold">{{ average() | number:'1.1-1' }}</span>
            <div>
              <div class="flex text-gold">@for (i of stars; track i) { <span [class.opacity-25]="i > roundedAverage()">★</span> }</div>
              <p class="text-xs text-mist">from {{ reviews().length }} recent reviews</p>
            </div>
          </div>
        }
      </div>

      <div class="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        @for (r of reviews(); track r.id) {
          <figure appReveal class="card flex flex-col p-6">
            <div class="flex text-gold text-sm">@for (i of stars; track i) { <span [class.opacity-20]="i > r.rating">★</span> }</div>
            <blockquote class="mt-4 flex-1 text-[15px] leading-relaxed text-mist-300">“{{ r.comment }}”</blockquote>
            <figcaption class="mt-6 flex items-center gap-3">
              <span class="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-blush to-orchid text-sm font-bold">
                {{ r.authorName.charAt(0) }}
              </span>
              <span>
                <span class="block text-sm font-semibold">{{ r.authorName }}</span>
                <span class="block text-xs text-mist">Shopper · {{ r.createdAt | date:'d MMM' }}</span>
              </span>
            </figcaption>
          </figure>
        }

        <div appReveal class="card flex flex-col p-6 md:col-span-2 lg:col-span-1 border-blush/30">
          <h3 class="font-display text-2xl font-semibold">Share your haul</h3>
          @if (auth.isAuthenticated()) {
            @if (submitted()) {
              <p class="mt-4 text-sm text-emerald-400">Thank you! Your review is live. 💖</p>
            } @else {
              <form (ngSubmit)="submit()" class="mt-4 flex flex-1 flex-col gap-3">
                <div class="flex gap-1 text-2xl" role="radiogroup" aria-label="Rating">
                  @for (i of stars; track i) {
                    <button type="button" role="radio" [attr.aria-checked]="rating() === i" [attr.aria-label]="i + ' stars'"
                            (click)="rating.set(i)" (mouseenter)="hover.set(i)" (mouseleave)="hover.set(0)"
                            class="transition hover:scale-125"
                            [ngClass]="i <= (hover() || rating()) ? 'text-gold' : 'text-white/20'">★</button>
                  }
                </div>
                <textarea name="comment" [(ngModel)]="comment" rows="4" maxlength="500" required
                          placeholder="What did you snag, and how was it?" class="field flex-1 resize-none"></textarea>
                @if (error()) { <p class="text-xs text-blush-400">{{ error() }}</p> }
                <button type="submit" class="btn-primary" [disabled]="posting() || comment.trim().length < 10">
                  {{ posting() ? 'Posting…' : 'Post review' }}
                </button>
              </form>
            }
          } @else {
            <p class="mt-3 flex-1 text-sm text-mist-300">Bought something on a drop? Tell other shoppers how it went.</p>
            <a routerLink="/login" class="btn-ghost mt-6">Log in to write a review</a>
          }
        </div>
      </div>
    </section>
  `,
})
export class ReviewsSectionComponent implements OnInit {
  readonly stars = [1, 2, 3, 4, 5];
  reviews = signal<Review[]>([]);
  rating = signal(5);
  hover = signal(0);
  comment = '';
  posting = signal(false);
  submitted = signal(false);
  error = signal('');

  average = computed(() => {
    const rs = this.reviews();
    return rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0;
  });
  roundedAverage = computed(() => Math.round(this.average()));

  constructor(public auth: AuthService, private reviewService: ReviewService) {}

  ngOnInit(): void {
    this.reviewService.latest().subscribe({ next: (rs) => this.reviews.set(rs), error: () => {} });
  }

  submit(): void {
    this.posting.set(true);
    this.error.set('');
    this.reviewService.create(this.rating(), this.comment.trim()).subscribe({
      next: (review) => {
        this.reviews.update((rs) => [review, ...rs]);
        this.posting.set(false);
        this.submitted.set(true);
      },
      error: (err: ApiError) => {
        this.posting.set(false);
        this.error.set(err?.message ?? 'Could not post your review. Please try again.');
      },
    });
  }
}
