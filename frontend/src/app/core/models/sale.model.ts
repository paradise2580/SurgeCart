export interface SaleEvent {
  id: number;
  productId: number;
  productTitle: string;
  imageUrl: string | null;
  description: string | null;
  category: string | null;
  basePrice: number;
  salePrice: number;
  totalStock: number;
  stockRemaining: number;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'LIVE' | 'SOLD_OUT' | 'ENDED';
}

export interface StockUpdateMessage {
  saleId: number;
  stockRemaining: number;
  status: string;
  serverTime: string;
}
