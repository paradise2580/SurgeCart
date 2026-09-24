export interface OrderDto {
  id: number;
  saleEventId: number;
  reservationToken: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED';
  createdAt: string;
}

export interface CheckoutResponse {
  status: string;
  paymentId: string;
  razorpayOrderId: string;
}
