import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../products/product.model';
import { ProductService } from '../products/product.service';
import { OrdersDbService, StoredOrder } from '../core/orders-db.service';
import { ShiftsDbService, Shift } from '../core/shifts-db.service';
import { ShowsDbService, Show } from '../core/shows-db.service';
import { UsersDbService, User } from '../core/users-db.service';
import { PinService } from '../core/pin.service';
import { ShiftSummaryComponent } from './shift-summary.component';
import { PinModalComponent } from '../shared/pin-modal.component';
import { RouterModule } from '@angular/router';

type Order = {
  id: string;
  items: Product[];
  totalCents: number;
  timestamp: number;
  shiftId?: string;
  userId?: string;
  userName?: string;
};

type PosStep = 'select-show' | 'select-user' | 'verify-pin' | 'active';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ShiftSummaryComponent, PinModalComponent],
  templateUrl: './pos.component.html',
})
export class PosComponent implements OnInit {

  products: Product[] = [];
  currentOrder: Product[] = [];
  expandedOrderId: string | null = null;
  showSales = false;
  orders: Order[] = [];
  activeShift: Shift | null = null;
  closedShift: Shift | null = null;
  closedShiftOrders: StoredOrder[] = [];

  // ─── FLUJO DE INICIO ───────────────────────────────
  step: PosStep = 'select-show';
  shows: Show[] = [];
  users: User[] = [];
  selectedShow: Show | null = null;
  selectedUser: User | null = null;

  // ─── PIN ───────────────────────────────────────────
  pinInput = '';
  pinError = '';

  // ─── ADMIN PIN ─────────────────────────────────────
  showPinModal = false;
  pinModalMode: 'verify' | 'set' = 'verify';
  pinActionLabel = '';

  // ─── NUMPAD — Wechselgeld ──────────────────────────
  numpadInput: string = '';
  quickAmounts = [5, 10, 20, 50];
  keys = ['1','2','3','4','5','6','7','8','9',',','0','⌫'];

  constructor(
    private productService: ProductService,
    private ordersDb: OrdersDbService,
    private shiftsDb: ShiftsDbService,
    private showsDb: ShowsDbService,
    private usersDb: UsersDbService,
    private pinService: PinService,
    private cdr: ChangeDetectorRef
  ) {
    this.products = this.productService.getAll();
  }

  async ngOnInit() {
    this.activeShift = await this.shiftsDb.getActiveShift();
    if (this.activeShift) {
      await this.loadOrdersForShift(this.activeShift.id);
      this.step = 'active';
    } else {
      this.shows = await this.showsDb.getAllShows();
      this.users = await this.usersDb.getAllUsers();
      this.step = 'select-show';
    }
    this.cdr.detectChanges();
  }

  private async loadOrdersForShift(shiftId: string) {
    const all = await this.ordersDb.getAllOrders();
    this.orders = all
      .filter(o => (o as any).shiftId === shiftId)
      .sort((a, b) => b.timestamp - a.timestamp) as unknown as Order[];
  }

  // ─── FLUJO: Show → Usuario → PIN ───────────────────
  selectShow(show: Show) {
    this.selectedShow = show;
    this.step = 'select-user';
    this.cdr.detectChanges();
  }

  selectUser(user: User) {
    this.selectedUser = user;
    this.pinInput = '';
    this.pinError = '';
    this.step = 'verify-pin';
    this.cdr.detectChanges();
  }

  backToShows() {
    this.selectedShow = null;
    this.step = 'select-show';
    this.cdr.detectChanges();
  }

  backToUsers() {
    this.selectedUser = null;
    this.step = 'select-user';
    this.cdr.detectChanges();
  }

  pressPinKey(key: string) {
    if (key === '⌫') {
      this.pinInput = this.pinInput.slice(0, -1);
    } else if (this.pinInput.length < 4) {
      this.pinInput += key;
    }
    this.pinError = '';
    this.cdr.detectChanges();
  }

  async confirmPin() {
    if (!this.selectedUser) return;
    if (this.pinInput === this.selectedUser.pin) {
      await this._doOpenShift();
    } else {
      this.pinError = 'Falscher PIN. Bitte erneut versuchen.';
      this.pinInput = '';
      this.cdr.detectChanges();
    }
  }

  // ─── KASSENSCHICHT ─────────────────────────────────
  private async _doOpenShift() {
    const shift: Shift = {
      id: crypto.randomUUID(),
      openedAt: Date.now(),
      closedAt: null,
      orderIds: [],
      totalCents: 0,
      showId: this.selectedShow?.id ?? '',
      showName: this.selectedShow?.name ?? '',
      userId: this.selectedUser?.id ?? '',
      userName: this.selectedUser?.name ?? '',
    };
    await this.shiftsDb.saveShift(shift);
    this.activeShift = shift;
    this.closedShift = null;
    this.closedShiftOrders = [];
    this.orders = [];
    this.numpadInput = '';
    this.step = 'active';
    this.cdr.detectChanges();
  }

  async closeShift() {
    const hasPin = await this.pinService.hasPin();
    this.pinModalMode = hasPin ? 'verify' : 'set';
    this.pinActionLabel = 'Kassenschicht schließen';
    this.showPinModal = true;
    this.cdr.detectChanges();
  }

  async onPinSuccess() {
    this.showPinModal = false;
    await this._doCloseShift();
    this.cdr.detectChanges();
  }

  onPinDismissed() {
    this.showPinModal = false;
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
    this.step = 'select-show';
    this.selectedShow = null;
    this.selectedUser = null;
    this.shows = await this.showsDb.getAllShows();
    this.users = await this.usersDb.getAllUsers();
    this.cdr.detectChanges();
  }

  // ─── NUMPAD LOGIK ──────────────────────────────────
  pressKey(key: string) {
    if (key === '⌫') {
      this.numpadInput = this.numpadInput.slice(0, -1);
      return;
    }
    if (key === ',') {
      if (this.numpadInput.includes(',')) return;
      this.numpadInput += ',';
      return;
    }
    if (this.numpadInput.includes(',')) {
      const decimals = this.numpadInput.split(',')[1];
      if (decimals && decimals.length >= 2) return;
    }
    const beforeComma = this.numpadInput.split(',')[0];
    if (!this.numpadInput.includes(',') && beforeComma.length >= 4) return;
    this.numpadInput += key;
  }

  setQuickAmount(cents: number) {
    const euros = cents / 100;
    this.numpadInput = Number.isInteger(euros)
      ? euros.toString()
      : euros.toFixed(2).replace('.', ',');
  }

  setPassend() {
    this.setQuickAmount(this.currentTotalCents);
  }

  get givenCents(): number {
    if (!this.numpadInput) return 0;
    const val = parseFloat(this.numpadInput.replace(',', '.'));
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }

  get wechselgeld(): number {
    return this.givenCents - this.currentTotalCents;
  }

  get canKassieren(): boolean {
    return this.currentOrder.length > 0 && this.givenCents >= this.currentTotalCents;
  }

  // ─── VERKAUF ───────────────────────────────────────
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
    this.numpadInput = '';
  }

  async checkout() {
    if (!this.canKassieren) return;
    if (!this.activeShift) return;

    this.bumpUsageFromCurrentOrder();

    const totalCents = this.currentOrder.reduce((sum, p) => sum + p.priceCents, 0);
    const order: Order = {
      id: crypto.randomUUID(),
      items: this.currentOrder,
      totalCents,
      timestamp: Date.now(),
      shiftId: this.activeShift.id,
      userId: this.activeShift.userId,
      userName: this.activeShift.userName,
    };

    try {
      await this.ordersDb.addOrder(order as StoredOrder);
    } catch (e) {
      console.error('IndexedDB Fehler', e);
    }

    this.activeShift.orderIds.push(order.id);
    this.activeShift.totalCents += totalCents;
    await this.shiftsDb.saveShift(this.activeShift);

    this.orders = [order, ...this.orders];
    this.clearOrder();
    this.products = this.productService.getAll();
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

  // ─── HELPERS ───────────────────────────────────────
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

  // Para el openShift desde shift-summary
  async openShift() {
    this.closedShift = null;
    this.shows = await this.showsDb.getAllShows();
    this.users = await this.usersDb.getAllUsers();
    this.step = 'select-show';
    this.cdr.detectChanges();
  }
}
