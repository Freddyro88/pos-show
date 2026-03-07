import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { OrdersDbService, StoredOrder } from '../core/orders-db.service';
import { ShiftsDbService, Shift } from '../core/shifts-db.service';
import { ShiftSummaryComponent } from './shift-summary.component';
import { PaymentModalComponent } from './payment-modal.component';

// ─── MODELO DE ORDEN ───────────────────────────────
type Order = {
  id: string;
  items: Product[];
  totalCents: number;
  timestamp: number;
  shiftId?: string;
};

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, ShiftSummaryComponent, PaymentModalComponent],
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {

  // ─── DATEN ─────────────────────────────────────────
  products: Product[] = [];
  currentOrder: Product[] = [];
  expandedOrderId: string | null = null;
  showSales = false;

  // ─── MODAL ZAHLUNG ─────────────────────────────────
  showPaymentModal = false;

  // ─── BESTELLUNGEN — nur aktuelle Kassenschicht ─────
  orders: Order[] = [];

  // ─── AKTIVE KASSENSCHICHT ──────────────────────────
  activeShift: Shift | null = null;

  // ─── GESCHLOSSENE KASSENSCHICHT — zeigt Zusammenfassung
  closedShift: Shift | null = null;
  closedShiftOrders: StoredOrder[] = [];

  // ─── CONSTRUCTOR ───────────────────────────────────
  constructor(
    private productService: ProductService,
    private ordersDb: OrdersDbService,
    private shiftsDb: ShiftsDbService,
    private cdr: ChangeDetectorRef
  ) {
    this.products = this.productService.getAll();
  }

  // ─── INIT — lädt aktive Kassenschicht ──────────────
  async ngOnInit() {
    this.activeShift = await this.shiftsDb.getActiveShift();
    if (this.activeShift) {
      await this.loadOrdersForShift(this.activeShift.id);
    }
    this.cdr.detectChanges();
    console.log('🕐 Kassenschicht aktiv:', this.activeShift);
  }

  // ─── BESTELLUNGEN EINER KASSENSCHICHT LADEN ────────
  private async loadOrdersForShift(shiftId: string) {
    const all = await this.ordersDb.getAllOrders();
    this.orders = all
      .filter(o => (o as any).shiftId === shiftId)
      .sort((a, b) => b.timestamp - a.timestamp) as unknown as Order[];
  }

  // ─── KASSENSCHICHT — öffnen ────────────────────────
  async openShift() {
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
    console.log('✅ Kassenschicht geöffnet:', shift.id);
  }

  // ─── KASSENSCHICHT — schließen ─────────────────────
  async closeShift() {
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
    console.log('🔒 Kassenschicht geschlossen');
  }

  // ─── VERLAUF — ein/ausblenden ──────────────────────
  toggleSales() {
    this.showSales = !this.showSales;
    this.expandedOrderId = null;
  }

  // ─── PRODUKTE — zum Verkauf hinzufügen ─────────────
  addItem(product: Product) {
    if (!this.activeShift) return;
    this.currentOrder = [...this.currentOrder, product];
  }

  // ─── STORNO — letzten Artikel entfernen ────────────
  undoLastItem() {
    if (this.currentOrder.length === 0) return;
    this.currentOrder = this.currentOrder.slice(0, -1);
  }

  // ─── EINZELNEN ARTIKEL LÖSCHEN ─────────────────────
  removeItem(productId: string) {
    const index = this.currentOrder.map(p => p.id).lastIndexOf(productId);
    if (index === -1) return;
    this.currentOrder = [
      ...this.currentOrder.slice(0, index),
      ...this.currentOrder.slice(index + 1)
    ];
  }

  // ─── LEEREN — aktuellen Verkauf leeren ─────────────
  clearOrder() {
    this.currentOrder = [];
  }

  // ─── KASSIEREN — öffnet Zahlungsmodal ──────────────
  checkout() {
    if (this.currentOrder.length === 0) return;
    if (!this.activeShift) return;
    this.showPaymentModal = true;
    this.cdr.detectChanges();
  }

  // ─── ZAHLUNG BESTÄTIGT — Verkauf speichern ─────────
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
      console.log('✅ gespeichert in IndexedDB', order.id);
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

  // ─── ZAHLUNG ABGEBROCHEN — Modal schließen ─────────
  cancelPayment() {
    this.showPaymentModal = false;
    this.cdr.detectChanges();
  }

  // ─── PRODUKTNUTZUNG — interner Zähler ──────────────
  private bumpUsageFromCurrentOrder() {
    const counts = new Map<string, number>();
    for (const p of this.currentOrder) {
      counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    }
    for (const [id, qty] of counts) {
      this.productService.incrementUsage(id, qty);
    }
  }

  // ─── VERLAUF — Details ein/ausblenden ──────────────
  toggleOrderDetails(orderId: string) {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
  }

  // ─── GESAMTBETRAG des aktuellen Verkaufs ───────────
  get currentTotalCents(): number {
    return this.currentOrder.reduce((sum, p) => sum + p.priceCents, 0);
  }

  // ─── ARTIKEL GRUPPIEREN — z.B. 2× Bier ────────────
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

  // ─── DATUM FORMATIEREN — z.B. "18:32 • 05.03.2026" ─
  formatDateTime(timestamp: number): string {
    const d = new Date(timestamp);
    const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} • ${date}`;
  }

  // ─── BETRAG FORMATIEREN — z.B. "€ 3,00" ───────────
  formatEUR(cents: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
}