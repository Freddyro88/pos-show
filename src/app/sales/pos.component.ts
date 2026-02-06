import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { OrdersDbService } from '../core/orders-db.service';

type Order = {
  id: string;
  items: Product[];
  totalCents: number;
  timestamp: number;
};

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {
  products: Product[] = [];

  currentOrder: Product[] = [];
  orders: Order[] = [];
  expandedOrderId: string | null = null;

  showSales = false;

  toggleSales() {
    this.showSales = !this.showSales;
    this.expandedOrderId = null;
  }

  constructor(
  private productService: ProductService,
  private ordersDb: OrdersDbService
) {
  this.products = this.productService.getAll();
}

  async ngOnInit() {
    const stored = await this.ordersDb.getAllOrders();
console.log('📦 IndexedDB orders loaded:', stored);
    // newest first
    this.orders = stored
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp) as unknown as Order[];
  }

  addItem(product: Product) {
    this.currentOrder = [...this.currentOrder, product];
  }

  undoLastItem() {
    if (this.currentOrder.length === 0) return;
    this.currentOrder = this.currentOrder.slice(0, -1);
  }

  clearOrder() {
    this.currentOrder = [];
  }

  async checkout() {
    if (this.currentOrder.length === 0) return;

    // ✅ 1) sumar "uso" por cada producto vendido
    this.bumpUsageFromCurrentOrder();

    const totalCents = this.currentOrder.reduce((sum, p) => sum + p.priceCents, 0);

    const order: Order = {
      id: crypto.randomUUID(),
      items: this.currentOrder,
      totalCents,
      timestamp: Date.now(),
    };

    try {
  await this.ordersDb.addOrder(order);
  console.log('✅ saved to IndexedDB', order.id);
} catch (e) {
  console.error('❌ IndexedDB save failed', e);
}


    this.orders = [order, ...this.orders];
    this.clearOrder();

    // opcional: refrescar productos (por si en algún lugar muestras usageCount)
    this.products = this.productService.getAll();
  }

  private bumpUsageFromCurrentOrder() {
    const counts = new Map<string, number>();

    for (const p of this.currentOrder) {
      counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    }

    for (const [id, qty] of counts) {
      this.productService.incrementUsage(id, qty);
    }
  }

  toggleOrderDetails(orderId: string) {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
  }

  get currentTotalCents(): number {
    return this.currentOrder.reduce((sum, p) => sum + p.priceCents, 0);
  }

  summarizeItems(items: Product[]) {
    const map = new Map<string, { name: string; qty: number; lineTotalCents: number }>();

    for (const item of items) {
      const existing = map.get(item.id);
      if (existing) {
        existing.qty += 1;
        existing.lineTotalCents += item.priceCents;
      } else {
        map.set(item.id, { name: item.name, qty: 1, lineTotalCents: item.priceCents });
      }
    }

    return Array.from(map.values());
  }

  formatDateTime(timestamp: number): string {
    const d = new Date(timestamp);

    const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return `${time} • ${date}`;
  }

  formatEUR(cents: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
}
