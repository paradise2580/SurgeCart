import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { SaleEvent } from '../models/sale.model';

const sale = (id: number, basePrice: number, salePrice: number): SaleEvent => ({
  id, productId: id, productTitle: `Item ${id}`, imageUrl: null, description: null, category: 'Makeup',
  basePrice, salePrice, totalStock: 10, stockRemaining: 10, perUserLimit: 1,
  startsAt: '', endsAt: '', status: 'LIVE',
});

describe('CartService', () => {
  let cart: CartService;

  beforeEach(() => {
    localStorage.removeItem('surgecart.bag');
    TestBed.configureTestingModule({});
    cart = TestBed.inject(CartService);
  });

  it('adds each drop once and totals price and savings', () => {
    cart.add(sale(1, 1000, 600));
    cart.add(sale(1, 1000, 600));
    cart.add(sale(2, 500, 400));

    expect(cart.count()).toBe(2);
    expect(cart.subtotal()).toBe(1000);
    expect(cart.savings()).toBe(500);
  });

  it('removes an item', () => {
    cart.add(sale(1, 1000, 600));
    cart.remove(1);

    expect(cart.count()).toBe(0);
    expect(cart.has(1)).toBeFalse();
  });
});
