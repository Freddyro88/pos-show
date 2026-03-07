import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { OrdersDbService, StoredOrder } from '../core/orders-db.service';
import { ShiftsDbService, Shift } from '../core/shifts-db.service';
import { PinService } from '../core/pin.service';
import { ShiftSummaryComponent } from './shift-summary.component';
import { PaymentModalComponent } from './payment-modal.component';
import { PinModalComponent } from '../shared/pin-modal.component';

type Order = {
  id: string;
  items: Product[];
  totalCents: number;
  timestamp: number;
  shiftId?: string;
};

type PinAction = 'open-shift' | 'close-shift' | null;

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, ShiftSummaryComponent, PaymentModalComponent, PinModalComponent],
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {

  products: Product[] = [];
  currentOrder: Product[] = [];
  expandedOrderId: string | null = null;
  showSales = false;
  showPaymentModal = false;
  orders: Order[] = [];
  activeShift: Shift | null = null;
  closedShift: Shift | null = null;
  closedShiftOrders: StoredOrder[] = [];

  // ─── PIN ──────────────────────────────────────────
  showPinModal = false;
  pinModalMode: 'verify' | 'set' = 'verify';
  pinActionLabel = '';
  pendingPinAction: PinAction = null;

  constructor(
    private productService: ProductService,
    private ordersDb: OrdersDbService,
    private shiftsDb: ShiftsDbService,
    private pinService: PinService,
    private cdr: ChangeDetectorRef
  ) {
    this.products = this.productService.getAll();
  }

  async ngOnInit() {
    this.activeShift = await this.shiftsDb.getActiveShift();
    if (this.activeShift) {
      await this.loadOrdersForShift(this.activeShift.id);
    }
    this.cdr.detectChanges();
  }

  private async loadOrdersForShift(shiftId: string) {
    const all = await this.ordersDb.getAllOrders();
    this.orders = all
      .filter(o => (o as any).shiftId === shiftId)
      .sort((a, b) => b.timestamp - a.timestamp) as unknown as Order[];
  }

  // ─── PIN FLOW ─────────────────────────────────────
  async openShift() {
    await this.requestPin('open-shift', 'Kassenschicht öffnen');
  }

  async closeShift() {
    await this.requestPin('close-shift', 'Kassenschicht schließen');
  }

  private async requestPin(action: PinAction, label: string) {
    try {
      const hasPin = await this.pinService.hasPin();
      this.pendingPinAction = action;
      this.pinModalMode = hasPin ? 'verify' : 'set';
      this.pinActionLabel = label;
      this.showPinModal = true;
      this.cdr.detectChanges();
    } catch (e) {
      console.error('❌ PIN service error:', e);
      // Fallback: ejecutar sin PIN
      if (action === 'open-shift') await this._doOpenShift();
      else if (action === 'close-shift') await this._doCloseShift();
    }
  }

  async onPinSuccess() {
    this.showPinModal = false;
    const action = this.pendingPinAction;
    this.pendingPinAction = null;
    this.cdr.detectChanges();

    if (action === 'open-shift') await this._doOpenShift();
    else if (action === 'close-shift') await this._doCloseShift();
  }

  onPinDismissed() {
    this.showPinModal = false;
    this.pendingPinAction = null;
    this.cdr.detectChanges();
  }

  private async _doOpenShift() {
    const shift: Shift = {
      id: crypto.randomUUID(),
      openedAt: Date.now(),
      closedAt: null,
      orderIds: [],
      totalCents: 0,
    };
    await this.shiftsDb.saveShift(shift);
    this.activeShift = shift;
    this.closedShift = null;
    this.closedShiftOrders = [];
    this.orders = [];
    this.cdr.detectChanges();
  }

  private async _doCloseShift() {
    if (!this.activeShift) return;
    this.activeShift.closedAt = Date.now();
    await this.shiftsDb.saveShift(this.activeShift);
    const allOrders = await this.ordersDb.getAllOrders();
    this.closedShiftOrders = allOrders.filter(
      o => (o as any).shiftId === this.activeShift!.id
    );
    this.closedShift = this.activeShift;
    this.activeShift = null;
    this.cdr.detectChanges();
  }

  // ─── VERKAUF ──────────────────────────────────────
  toggleSales() {
    this.showSales = !this.showSales;
    this.expandedOrderId = null;
  }

  addItem(product: Product) {
    if (!this.activeShift) return;
    this.currentOrder = [...this.currentOrder, product];
  }

  undoLastItem() {
    if (this.currentOrder.length === 0) return;
    this.currentOrder = this.currentOrder.slice(0, -1);
  }

  removeItem(productId: string) {
    const index = this.currentOrder.map(p => p.id).lastIndexOf(productId);
    if (index === -1) return;
    this.currentOrder = [
      ...this.currentOrder.slice(0, index),
      ...this.currentOrder.slice(index + 1),
    ];
  }

  clearOrder() {
    this.currentOrder = [];
  }

  checkout() {
    if (this.currentOrder.length === 0) return;
    if (!this.activeShift) return;
    this.showPaymentModal = true;
    this.cdr.detectChanges();
  }

  async confirmPayment() {
    if (!this.activeShift) return;
    this.showPaymentModal = false;
    this.bumpUsageFromCurrentOrder();

    const totalCents = this.currentOrder.reduce((sum, p) => sum + p.priceCents, 0);
    const order: Order = {
      id: crypto.randomUUID(),
      items: this.currentOrder,
      totalCents,
      timestamp: Date.now(),
      shiftId: this.activeShift.id,
    };

    try {
      await this.ordersDb.addOrder(order);
    } catch (e) {
      console.error('❌ IndexedDB Fehler', e);
    }

    this.activeShift.orderIds.push(order.id);
    this.activeShift.totalCents += totalCents;
    await this.shiftsDb.saveShift(this.activeShift);

    this.orders = [order, ...this.orders];
    this.clearOrder();
    this.products = this.productService.getAll();
    this.cdr.detectChanges();
  }

  cancelPayment() {
    this.showPaymentModal = false;
    this.cdr.detectChanges();
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

  // ─── HELPERS ──────────────────────────────────────
  get currentTotalCents(): number {
    return this.currentOrder.reduce((sum, p) => sum + p.priceCents, 0);
  }

  summarizeItems(items: Product[]) {
    const map = new Map<string, { id: string; name: string; qty: number; lineTotalCents: number }>();
    for (const item of items) {
      const existing = map.get(item.id);
      if (existing) {
        existing.qty += 1;
        existing.lineTotalCents += item.priceCents;
      } else {
        map.set(item.id, { id: item.id, name: item.name, qty: 1, lineTotalCents: item.priceCents });
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
