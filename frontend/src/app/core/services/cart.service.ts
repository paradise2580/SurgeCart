import { Injectable, computed, effect, signal } from '@angular/core';
import { SaleEvent } from '../models/sale.model';

export interface CartItem {
  saleId: number;
  title: string;
  imageUrl: string | null;
  category: string | null;
  basePrice: number;
  salePrice: number;
}

const STORAGE_KEY = 'surgecart.bag';

/**
 * The bag is a wish-list of drops, not a stock hold: nothing is reserved
 * until checkout, when each item goes through the same reserve -> pay flow
 * as "Buy now". Holding stock for a browsing cart would let one shopper
 * starve a flash sale.
 *
 * Persisted to localStorage so the bag survives a refresh; access is wrapped
 * because storage can be unavailable (private mode, blocked site data).
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>(this.load());

  readonly items = this._items.asReadonly();
  readonly count = computed(() => this._items().length);
  readonly subtotal = computed(() => this._items().reduce((sum, i) => sum + i.salePrice, 0));
  readonly savings = computed(() => this._items().reduce((sum, i) => sum + (i.basePrice - i.salePrice), 0));

  constructor() {
    effect(() => this.save(this._items()));
  }

  has(saleId: number): boolean {
    return this._items().some((i) => i.saleId === saleId);
  }

  add(sale: SaleEvent): void {
    if (this.has(sale.id)) return;
    this._items.update((items) => [...items, {
      saleId: sale.id, title: sale.productTitle, imageUrl: sale.imageUrl, category: sale.category,
      basePrice: sale.basePrice, salePrice: sale.salePrice,
    }]);
  }

  remove(saleId: number): void {
    this._items.update((items) => items.filter((i) => i.saleId !== saleId));
  }

  clear(): void {
    this._items.set([]);
  }

  private load(): CartItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  }

  private save(items: CartItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage unavailable — the bag still works for this tab.
    }
  }
}
