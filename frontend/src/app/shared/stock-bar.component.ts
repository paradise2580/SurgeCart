import { Component, computed, input } from '@angular/core';

/** Claimed-vs-remaining bar. Turns urgent below 15% and pulses when nearly gone. */
@Component({
  selector: 'app-stock-bar',
  standalone: true,
  template: `
    <div class="flex items-center justify-between text-[11px] font-medium mb-1.5">
      @if (remaining() === 0) {
        <span class="text-mist">Sold out</span>
      } @else if (urgent()) {
        <span class="text-blush-400 flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-blush animate-pulseRing"></span>
          Only {{ remaining() }} left
        </span>
      } @else {
        <span class="text-mist-300">{{ remaining() }} left</span>
      }
      <span class="text-mist">{{ claimedPct() }}% claimed</span>
    </div>
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
         role="progressbar" [attr.aria-valuenow]="claimedPct()" aria-valuemin="0" aria-valuemax="100"
         [attr.aria-label]="claimedPct() + '% of stock claimed'">
      <div class="h-full rounded-full transition-[width] duration-700 ease-out"
           [style.width.%]="claimedPct()"
           [style.background]="urgent() ? 'linear-gradient(90deg,#ff3e8a,#ff8a3e)' : 'linear-gradient(90deg,#9b5cff,#ff3e8a)'"></div>
    </div>
  `,
})
export class StockBarComponent {
  remaining = input.required<number>();
  total = input.required<number>();

  claimedPct = computed(() => {
    const total = this.total();
    return total > 0 ? Math.round(((total - this.remaining()) / total) * 100) : 100;
  });
  urgent = computed(() => this.remaining() > 0 && this.remaining() / Math.max(1, this.total()) < 0.15);
}
