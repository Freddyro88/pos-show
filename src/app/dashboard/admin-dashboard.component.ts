import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShiftsDbService, Shift } from '../core/shifts-db.service';
import { OrdersDbService, StoredOrder } from '../core/orders-db.service';
import { ShowsDbService, Show } from '../core/shows-db.service';
import { PinService } from '../core/pin.service';
import { PinModalComponent } from '../shared/pin-modal.component';
import { SidebarComponent } from '../shared/sidebar.component';

type ShiftRow = {
  shift: Shift;
  orders: StoredOrder[];
  totalCents: number;
  orderCount: number;
};

type TopProduct = {
  name: string;
  qty: number;
  totalCents: number;
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PinModalComponent, SidebarComponent],
  template: `
    <!-- PIN Modal -->
    <app-pin-modal
      *ngIf="showPinModal"
      mode="verify"
      actionLabel="Admin Dashboard"
      (success)="onPinSuccess()"
      (dismissed)="onPinDismissed()"
    />

    <!-- Gesperrte Ansicht -->
    <div *ngIf="!unlocked" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:var(--content-bg);gap:1rem">
      <div style="font-size:3rem">🔒</div>
      <p style="color:var(--text-light)">Dashboard gesperrt</p>
    </div>

    <!-- Dashboard -->
    <div class="app-shell" *ngIf="unlocked">
      <app-sidebar />

      <div class="main-area">

        <!-- Topbar -->
        <div class="topbar">
          <span class="topbar-title">Admin Dashboard</span>
          <div class="topbar-actions">
            <!-- Show Filter Pills -->
            <button class="topbar-badge"
              [style.background]="selectedShowId === 'all' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.14)'"
              [style.font-weight]="selectedShowId === 'all' ? '700' : '500'"
              style="cursor:pointer;border:1px solid rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:99px;font-size:11px"
              (click)="setShowFilter('all')">
              Alle
            </button>
            <button *ngFor="let show of allShows"
              [style.background]="selectedShowId === show.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.14)'"
              [style.font-weight]="selectedShowId === show.id ? '700' : '500'"
              style="cursor:pointer;border:1px solid rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:99px;font-size:11px"
              (click)="setShowFilter(show.id)">
              🎭 {{ show.name }}
            </button>
            <button class="topbar-btn" (click)="openPinSetup()">🔑 PIN ändern</button>
            <button class="topbar-btn" (click)="exportPdf()">↓ PDF</button>
            <button class="topbar-btn topbar-btn-danger" routerLink="/pos">← Zur Kasse</button>
          </div>
        </div>

        <!-- PIN Setup Modal -->
        <app-pin-modal
          *ngIf="showPinSetup"
          mode="set"
          actionLabel="Neuen PIN festlegen"
          (success)="onPinSetupSuccess()"
          (dismissed)="showPinSetup = false"
        />

        <div class="page-content">

          <!-- KPI Grid -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Gesamt Umsatz</div>
              <div class="kpi-value blue">{{ formatEUR(filteredRevenueCents) }}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Kassenschichten</div>
              <div class="kpi-value">{{ filteredShiftRows.length }}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Verkäufe gesamt</div>
              <div class="kpi-value">{{ filteredOrderCount }}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Ø pro Schicht</div>
              <div class="kpi-value">{{ formatEUR(filteredAvgPerShift) }}</div>
            </div>
          </div>

          <!-- Top Produkte -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">🏆 Meistverkaufte Produkte</span>
              <span class="chip-gray">Top {{ topProducts.length }}</span>
            </div>
            <div class="card-body">
              <div *ngIf="topProducts.length === 0" style="color:var(--text-light);font-size:0.85rem">
                Keine Daten vorhanden
              </div>
              <div *ngFor="let p of topProducts; let i = index" class="bar-row">
                <span class="bar-name">
                  {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1) }}
                  {{ p.name }}
                </span>
                <div class="bar-track">
                  <div class="bar-fill" [style.width.%]="(p.qty / topProducts[0].qty) * 100"></div>
                </div>
                <span class="chip-blue">{{ p.qty }}×</span>
              </div>
            </div>
          </div>

          <!-- Kassenschichten Tabelle -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Kassenschichten{{ selectedShowId !== 'all' ? ' — ' + selectedShowName : '' }}</span>
              <span class="chip-gray">{{ filteredShiftRows.length }} gesamt</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Show</th>
                  <th>Kassier/in</th>
                  <th>Datum</th>
                  <th>Geöffnet</th>
                  <th>Geschlossen</th>
                  <th>Verkäufe</th>
                  <th>Umsatz</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of filteredShiftRows">
                  <td style="color:var(--blue);font-weight:600">{{ row.shift.showName || '—' }}</td>
                  <td>{{ row.shift.userName || '—' }}</td>
                  <td>{{ formatDate(row.shift.openedAt) }}</td>
                  <td>{{ formatTime(row.shift.openedAt) }}</td>
                  <td>{{ row.shift.closedAt ? formatTime(row.shift.closedAt) : '—' }}</td>
                  <td>{{ row.orderCount }}</td>
                  <td style="font-weight:600;color:var(--blue)">{{ formatEUR(row.totalCents) }}</td>
                  <td>
                    <span [class]="row.shift.closedAt ? 'chip-gray' : 'chip-blue'">
                      {{ row.shift.closedAt ? 'Geschlossen' : '● Offen' }}
                    </span>
                  </td>
                </tr>
                <tr *ngIf="filteredShiftRows.length === 0">
                  <td colspan="8" style="color:var(--text-light);font-style:italic;padding:1rem">
                    Keine Kassenschichten vorhanden
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class AdminDashboardComponent implements OnInit {

  unlocked = false;
  showPinModal = false;
  showPinSetup = false;

  shiftRows: ShiftRow[] = [];
  topProducts: TopProduct[] = [];
  allShows: Show[] = [];
  selectedShowId = 'all';

  get filteredShiftRows(): ShiftRow[] {
    if (this.selectedShowId === 'all') return this.shiftRows;
    return this.shiftRows.filter(r => r.shift.showId === this.selectedShowId);
  }
  get filteredRevenueCents(): number {
    return this.filteredShiftRows.reduce((s, r) => s + r.totalCents, 0);
  }
  get filteredOrderCount(): number {
    return this.filteredShiftRows.reduce((s, r) => s + r.orderCount, 0);
  }
  get filteredAvgPerShift(): number {
    return this.filteredShiftRows.length
      ? Math.round(this.filteredRevenueCents / this.filteredShiftRows.length) : 0;
  }
  get selectedShowName(): string {
    return this.allShows.find(s => s.id === this.selectedShowId)?.name ?? '';
  }

  setShowFilter(id: string) {
    this.selectedShowId = id;
    this.cdr.detectChanges();
  }

  constructor(
    private shiftsDb: ShiftsDbService,
    private ordersDb: OrdersDbService,
    private showsDb: ShowsDbService,
    private pinService: PinService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const hasPin = await this.pinService.hasPin();
    if (hasPin) { this.showPinModal = true; }
    else { this.unlocked = true; await this.loadData(); }
    this.cdr.detectChanges();
  }

  async onPinSuccess() {
    this.showPinModal = false;
    this.unlocked = true;
    await this.loadData();
    this.cdr.detectChanges();
  }
  onPinDismissed() { this.showPinModal = false; this.cdr.detectChanges(); }
  openPinSetup() { this.showPinSetup = true; this.cdr.detectChanges(); }
  onPinSetupSuccess() { this.showPinSetup = false; this.cdr.detectChanges(); }

  private async loadData() {
    const [shifts, allOrders, shows] = await Promise.all([
      this.shiftsDb.getAllShifts(),
      this.ordersDb.getAllOrders(),
      this.showsDb.getAllShows(),
    ]);

    this.allShows = shows.sort((a, b) => b.createdAt - a.createdAt);

    this.shiftRows = shifts
      .sort((a, b) => b.openedAt - a.openedAt)
      .map(shift => {
        const orders = allOrders.filter(o => (o as any).shiftId === shift.id);
        const totalCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
        return { shift, orders, totalCents, orderCount: orders.length };
      });

    const productMap = new Map<string, TopProduct>();
    for (const order of allOrders) {
      for (const item of order.items) {
        const key = item.id ?? item.name;
        const ex = productMap.get(key);
        if (ex) { ex.qty += 1; ex.totalCents += item.priceCents; }
        else { productMap.set(key, { name: item.name, qty: 1, totalCents: item.priceCents }); }
      }
    }
    this.topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty).slice(0, 10);

    this.cdr.detectChanges();
  }

  exportPdf() {
    const now = new Date().toLocaleDateString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const filterLabel = this.selectedShowId === 'all' ? 'Alle Shows' : this.selectedShowName;

    const shiftsHtml = this.filteredShiftRows.map(row => `
      <tr>
        <td>${row.shift.showName || '—'}</td>
        <td>${row.shift.userName || '—'}</td>
        <td>${this.formatDate(row.shift.openedAt)}</td>
        <td>${this.formatTime(row.shift.openedAt)}</td>
        <td>${row.shift.closedAt ? this.formatTime(row.shift.closedAt) : '—'}</td>
        <td>${row.orderCount}</td>
        <td>${this.formatEUR(row.totalCents)}</td>
        <td>${row.shift.closedAt ? 'Geschlossen' : 'Offen'}</td>
      </tr>`).join('');

    const productsHtml = this.topProducts.map((p, i) => `
      <tr>
        <td>#${i + 1}</td><td>${p.name}</td>
        <td>${p.qty}×</td><td>${this.formatEUR(p.totalCents)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
      <title>POS Show — Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; padding: 2cm; }
        h1 { font-size: 20px; color: #1976d2; margin-bottom: 0.3cm; }
        .meta { color: #666; font-size: 10px; margin-bottom: 0.8cm; }
        .kpi-row { display: flex; gap: 0.5cm; margin-bottom: 0.8cm; }
        .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 0.4cm 0.6cm; flex: 1; }
        .kpi-label { font-size: 9px; color: #888; text-transform: uppercase; }
        .kpi-value { font-size: 16px; font-weight: bold; color: #1976d2; }
        h2 { font-size: 13px; color: #1976d2; margin: 0.6cm 0 0.3cm; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 0.5cm; }
        th { text-align: left; padding: 5px 6px; background: #e3f0fb; font-size: 9px; text-transform: uppercase; color: #666; }
        td { padding: 5px 6px; border-bottom: 1px solid #eee; }
      </style></head><body>
      <h1>POS Show — Admin Report</h1>
      <p class="meta">Generiert am ${now} · Filter: ${filterLabel}</p>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-label">Gesamt Umsatz</div><div class="kpi-value">${this.formatEUR(this.filteredRevenueCents)}</div></div>
        <div class="kpi"><div class="kpi-label">Kassenschichten</div><div class="kpi-value">${this.filteredShiftRows.length}</div></div>
        <div class="kpi"><div class="kpi-label">Verkäufe</div><div class="kpi-value">${this.filteredOrderCount}</div></div>
        <div class="kpi"><div class="kpi-label">Ø pro Schicht</div><div class="kpi-value">${this.formatEUR(this.filteredAvgPerShift)}</div></div>
      </div>
      <h2>Kassenschichten</h2>
      <table><thead><tr><th>Show</th><th>Kassier/in</th><th>Datum</th><th>Geöffnet</th><th>Geschlossen</th><th>Verkäufe</th><th>Umsatz</th><th>Status</th></tr></thead>
      <tbody>${shiftsHtml || '<tr><td colspan="8">Keine Daten</td></tr>'}</tbody></table>
      <h2>Meistverkaufte Produkte</h2>
      <table><thead><tr><th>Rang</th><th>Produkt</th><th>Menge</th><th>Umsatz</th></tr></thead>
      <tbody>${productsHtml || '<tr><td colspan="4">Keine Daten</td></tr>'}</tbody></table>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  formatEUR(cents: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
  formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  }
}
