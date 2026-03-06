import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { OrdersDbService, StoredOrder } from '../core/orders-db.service';
import { ShiftsDbService, Shift } from '../core/shifts-db.service';
import { ShiftSummaryComponent } from './shift-summary.component';

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
  imports: [CommonModule, ShiftSummaryComponent],
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {

  // ─── DATOS ─────────────────────────────────────────
  products: Product[] = [];
  currentOrder: Product[] = [];
  expandedOrderId: string | null = null;
  showSales = false;

  // ─── ÓRDENES — solo del turno activo ───────────────
  orders: Order[] = [];

  // ─── KASSENSCHICHT ACTIVA ──────────────────────────
  // null = no hay Kassenschicht abierta
  activeShift: Shift | null = null;

  // ─── KASSENSCHICHT CERRADA — muestra resumen ───────
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

  // ─── INIT — carga Kassenschicht activa ─────────────
  async ngOnInit() {
    // Comprueba si hay una Kassenschicht abierta
    this.activeShift = await this.shiftsDb.getActiveShift();

    if (this.activeShift) {
      // Carga solo las órdenes de la Kassenschicht activa
      await this.loadOrdersForShift(this.activeShift.id);
    }

    this.cdr.detectChanges();
    console.log('🕐 Kassenschicht aktiv:', this.activeShift);
  }

  // ─── CARGA ÓRDENES DE UNA KASSENSCHICHT ────────────
  private async loadOrdersForShift(shiftId: string) {
    const all = await this.ordersDb.getAllOrders();
    this.orders = all
      .filter(o => (o as any).shiftId === shiftId)
      .sort((a, b) => b.timestamp - a.timestamp) as unknown as Order[];
  }

  // ─── KASSENSCHICHT — abrir ─────────────────────────
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
    this.orders = []; // limpia órdenes anteriores
    this.cdr.detectChanges();
    console.log('✅ Kassenschicht geöffnet:', shift.id);
  }

  // ─── KASSENSCHICHT — cerrar ────────────────────────
  async closeShift() {
    if (!this.activeShift) return;
    this.activeShift.closedAt = Date.now();
    await this.shiftsDb.saveShift(this.activeShift);

    // Recoge las órdenes de esta Kassenschicht para el resumen
    const allOrders = await this.ordersDb.getAllOrders();
    this.closedShiftOrders = allOrders.filter(
      o => (o as any).shiftId === this.activeShift!.id
    );

    this.closedShift = this.activeShift;
    this.activeShift = null;
    this.cdr.detectChanges();
    console.log('🔒 Kassenschicht geschlossen');
  }

  // ─── HISTORIAL — mostrar / ocultar ─────────────────
  toggleSales() {
    this.showSales = !this.showSales;
    this.expandedOrderId = null;
  }

  // ─── PRODUKTE — zum aktuellen Verkauf hinzufügen ───
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

  // ─── KASSIEREN — Verkauf speichern ─────────────────
  async checkout() {
    if (this.currentOrder.length === 0) return;
    if (!this.activeShift) return;

    this.bumpUsageFromCurrentOrder();

    const totalCents = this.currentOrder.reduce((sum, p) => sum + p.priceCents, 0);

    const order: Order = {
      id: crypto.randomUUID(),
      items: this.currentOrder,
      totalCents,
      timestamp: Date.now(),
      shiftId: this.activeShift.id,
    };

    // Speichert in IndexedDB
    try {
      await this.ordersDb.addOrder(order);
      console.log('✅ gespeichert in IndexedDB', order.id);
    } catch (e) {
      console.error('❌ IndexedDB Fehler', e);
    }

    // Kassenschicht aktualisieren
    this.activeShift.orderIds.push(order.id);
    this.activeShift.totalCents += totalCents;
    await this.shiftsDb.saveShift(this.activeShift);

    this.orders = [order, ...this.orders];
    this.clearOrder();
    this.products = this.productService.getAll();
    this.cdr.detectChanges(); // ← fuerza actualización con un solo toque
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