import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService, BenchmarkResult } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="container-x max-w-4xl space-y-8 py-16">
      <div><p class="eyebrow">Control room</p><h1 class="mt-3 font-display text-4xl font-semibold">Admin</h1></div>

      <section class="card p-6">
        <h2 class="font-semibold mb-4">Activate a sale</h2>
        <div class="flex gap-2">
          <input [(ngModel)]="activateSaleId" type="number" placeholder="Sale ID"
                 class="field !w-32" />
          <button (click)="activate()" class="btn-primary">Activate</button>
        </div>
        @if (activateResult()) {
          <p class="text-sm text-emerald-400 mt-2">Activated — stock seeded into Redis: {{ activateResult() }}</p>
        }
      </section>

      <section class="card p-6">
        <h2 class="font-semibold mb-1">Concurrency benchmark</h2>
        <p class="text-xs text-mist mb-3">
          Fires N concurrent claims at the chosen strategy against a fresh stock count. This is the
          harness behind the benchmark table in docs/DESIGN.md.
        </p>
        <form [formGroup]="benchForm" (ngSubmit)="runBenchmark()" class="grid grid-cols-2 gap-3">
          <input formControlName="saleId" type="number" placeholder="Sale ID" class="field" />
          <select formControlName="strategy" class="field">
            <option value="naive">naive (broken baseline)</option>
            <option value="optimistic">jpa-optimistic-locking</option>
            <option value="pessimistic">jpa-pessimistic-locking</option>
            <option value="redis">redis-atomic-lua</option>
          </select>
          <input formControlName="stock" type="number" placeholder="Stock seeded" class="field" />
          <input formControlName="concurrentRequests" type="number" placeholder="Concurrent requests" class="field" />
          <button type="submit" [disabled]="running()" class="btn-primary col-span-2">
            {{ running() ? 'Running…' : 'Run benchmark' }}
          </button>
        </form>

        @if (results().length > 0) {
          <table class="w-full text-xs mt-4 border-collapse">
            <thead>
              <tr class="text-left border-b border-white/10 text-mist">
                <th class="py-1">Strategy</th><th>Granted</th><th>Rejected</th><th>Oversold</th><th>Duration (ms)</th><th>Throughput/s</th>
              </tr>
            </thead>
            <tbody>
              @for (r of results(); track $index) {
                <tr class="border-b border-white/10" [ngClass]="{ 'bg-blush/10': r.oversold }">
                  <td class="py-1">{{ r.strategy }}</td>
                  <td>{{ r.grantedCount }}</td>
                  <td>{{ r.rejectedCount }}</td>
                  <td [class.text-blush-400]="r.oversold" [class.font-bold]="r.oversold">{{ r.oversold ? 'YES' : 'no' }}</td>
                  <td>{{ r.durationMillis }}</td>
                  <td>{{ r.throughputPerSecond }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>
    </div>
  `,
})
export class AdminDashboardComponent {
  activateSaleId = 1;
  activateResult = signal<string | null>(null);
  running = signal(false);
  results = signal<BenchmarkResult[]>([]);

  benchForm: ReturnType<FormBuilder['group']>;

  constructor(private fb: FormBuilder, private admin: AdminService) {
    this.benchForm = this.fb.group({
      saleId: [1, Validators.required],
      strategy: ['redis', Validators.required],
      stock: [100, Validators.required],
      concurrentRequests: [5000, Validators.required],
    });
  }

  activate(): void {
    this.admin.activate(this.activateSaleId).subscribe((sale) => {
      this.activateResult.set(String(sale.stockRemaining));
    });
  }

  runBenchmark(): void {
    if (this.benchForm.invalid) return;
    this.running.set(true);
    const { saleId, strategy, stock, concurrentRequests } = this.benchForm.value;

    this.admin.runBenchmark(saleId!, strategy!, stock!, concurrentRequests!).subscribe({
      next: (result) => {
        this.results.update((rs) => [result, ...rs]);
        this.running.set(false);
      },
      error: () => this.running.set(false),
    });
  }
}
