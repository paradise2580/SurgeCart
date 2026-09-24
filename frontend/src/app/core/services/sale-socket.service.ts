import { Injectable, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { environment } from '../../../environments/environment';
import { StockUpdateMessage } from '../models/sale.model';

/**
 * One shared STOMP client for the whole app, subscribing per-sale on
 * demand. Two things this deliberately gets right:
 *
 *  1. Clock sync — every message carries the server's own timestamp. We
 *     compute (serverTime - Date.now()) once per message and expose it as
 *     `clockOffsetMs`, so every countdown in the app is anchored to the
 *     server's clock, not the buyer's — a skewed local clock must never
 *     open or close a sale early for that one user.
 *
 *  2. Reconnection — stompjs's built-in reconnectDelay handles a dropped
 *     connection; on reconnect we don't assume anything about missed
 *     messages, so components re-fetch current state via SaleService
 *     rather than trusting the socket alone for correctness.
 */
@Injectable({ providedIn: 'root' })
export class SaleSocketService {
  private client: Client | null = null;
  private readonly subscribedSaleIds = new Set<number>();

  readonly connected = signal(false);
  readonly clockOffsetMs = signal(0);
  readonly lastUpdateBySaleId = signal<Record<number, StockUpdateMessage>>({});

  connect(): void {
    if (this.client) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl) as any,
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.connected.set(true);
        // Re-subscribe to everything the app cared about before a drop/reconnect.
        this.subscribedSaleIds.forEach((id) => this.doSubscribe(id));
      },
      onWebSocketClose: () => this.connected.set(false),
    });

    this.client.activate();
  }

  subscribeToSale(saleId: number): void {
    this.subscribedSaleIds.add(saleId);
    if (this.client?.connected) this.doSubscribe(saleId);
  }

  private doSubscribe(saleId: number): void {
    this.client!.subscribe(`/topic/sale/${saleId}`, (message: IMessage) => {
      const update: StockUpdateMessage = JSON.parse(message.body);
      this.clockOffsetMs.set(new Date(update.serverTime).getTime() - Date.now());
      this.lastUpdateBySaleId.update((m) => ({ ...m, [update.saleId]: update }));
    });
  }

  /** Server-synced "now" — use this instead of Date.now() for any countdown. */
  serverNow(): number {
    return Date.now() + this.clockOffsetMs();
  }
}
