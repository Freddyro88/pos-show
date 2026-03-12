import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShiftsDbService, Shift } from '../core/shifts-db.service';
import { OrdersDbService, StoredOrder } from '../core/orders-db.service';
import { ShowsDbService, Show } from '../core/shows-db.service';
import { PinService } from '../core/pin.service';
import { PinModalComponent } from '../shared/pin-modal.component';

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
  imports: [CommonModule, FormsModule, RouterModule, PinModalComponent],
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
    <div class="locked-screen" *ngIf="!unlocked">
      <div class="lock-icon">🔒</div>
      <p class="lock-text">Dashboard gesperrt</p>
    </div>

    <!-- Dashboard -->
    <div class="dashboard" *ngIf="unlocked">

      <!-- Topbar -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-logo">POS Show</span>
          <span class="topbar-sep">/</span>
          <span class="topbar-page">Admin Dashboard</span>
        </div>
        <div class="topbar-right">
          <button class="btn-nav" routerLink="/pos">← Zur Kasse</button>
          <button class="btn-nav" routerLink="/admin">Produkte</button>
          <button class="btn-nav" routerLink="/shows">🎭 Shows</button>
          <button class="btn-pin" (click)="openPinSetup()">🔐 PIN ändern</button>
          <button class="btn-export" (click)="exportPdf()">📄 PDF Export</button>
        </div>
      </header>

      <!-- PIN Setup Modal -->
      <app-pin-modal
        *ngIf="showPinSetup"
        mode="set"
        actionLabel="Neuen PIN festlegen"
        (success)="onPinSetupSuccess()"
        (dismissed)="showPinSetup = false"
      />

      <!-- Show Filter -->
      <section class="filter-bar">
        <label class="filter-label">🎭 Show:</label>
        <div class="filter-pills">
          <button
            class="pill"
            [class.pill--active]="selectedShowId === 'all'"
            (click)="setShowFilter('all')"
          >Alle Shows</button>
          <button
            class="pill"
            *ngFor="let show of allShows"
            [class.pill--active]="selectedShowId === show.id"
            (click)="setShowFilter(show.id)"
          >{{ show.name }}</button>
        </div>
      </section>

      <!-- KPI Karten -->
      <section class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Gesamt Umsatz</div>
          <div class="kpi-value">{{ formatEUR(filteredRevenueCents) }}</div>
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
      </section>

      <!-- Zwei Spalten: Schichten + Top Produkte -->
      <section class="content-grid">

        <!-- Kassenschichten -->
        <div class="panel">
          <h2 class="panel-title">Kassenschichten{{ selectedShowId !== 'all' ? ' — ' + selectedShowName : '' }}</h2>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Show</th>
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
                  <td class="show-cell">{{ row.shift.showName || '—' }}</td>
                  <td>{{ formatDate(row.shift.openedAt) }}</td>
                  <td>{{ formatTime(row.shift.openedAt) }}</td>
                  <td>{{ row.shift.closedAt ? formatTime(row.shift.closedAt) : '—' }}</td>
                  <td>{{ row.orderCount }}</td>
                  <td class="amount">{{ formatEUR(row.totalCents) }}</td>
                  <td>
                    <span class="badge" [class.badge--open]="!row.shift.closedAt" [class.badge--closed]="row.shift.closedAt">
                      {{ row.shift.closedAt ? 'Geschlossen' : 'Offen' }}
                    </span>
                  </td>
                </tr>
                <tr *ngIf="filteredShiftRows.length === 0">
                  <td colspan="7" class="empty">Keine Kassenschichten vorhanden</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Produkte -->
        <div class="panel">
          <h2 class="panel-title">🏆 Meistverkaufte Produkte</h2>
          <div class="top-list">
            <div class="top-item" *ngFor="let p of topProducts; let i = index">
              <div class="top-rank" [class.gold]="i===0" [class.silver]="i===1" [class.bronze]="i===2">
                {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1) }}
              </div>
              <div class="top-info">
                <div class="top-name">{{ p.name }}</div>
                <div class="top-meta">{{ p.qty }}× verkauft • {{ formatEUR(p.totalCents) }}</div>
              </div>
              <div class="top-bar-wrap">
                <div class="top-bar" [style.width.%]="(p.qty / topProducts[0].qty) * 100"></div>
              </div>
            </div>
            <div class="empty" *ngIf="topProducts.length === 0">Keine Daten vorhanden</div>
          </div>
        </div>

      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #0f0f1a;
      color: #e0e0ff;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }

    /* ── Locked ── */
    .locked-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 1rem;
    }
    .lock-icon { font-size: 3rem; }
    .lock-text { color: #888aaa; font-size: 1rem; }

    /* ── Topbar ── */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #1e1e3a;
      background: #12121f;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .topbar-left { display: flex; align-items: center; gap: 0.5rem; }
    .topbar-logo { font-weight: 800; font-size: 1rem; color: #7c6fff; }
    .topbar-sep { color: #333355; }
    .topbar-page { color: #aaaacc; font-size: 0.9rem; }
    .topbar-right { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .btn-nav {
      background: transparent;
      border: 1px solid #333355;
      color: #aaaacc;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
    }
    .btn-nav:hover { border-color: #7c6fff; color: #e0e0ff; }

    .btn-pin {
      background: transparent;
      border: 1px solid #555577;
      color: #aaaacc;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.82rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-pin:hover { border-color: #7c6fff; color: #e0e0ff; }

    .btn-export {
      background: #7c6fff;
      border: none;
      color: white;
      padding: 0.4rem 1rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-export:hover { background: #6a5fdd; }

    /* ── Show Filter ── */
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.8rem 1.5rem;
      background: #12121f;
      border-bottom: 1px solid #1e1e3a;
      flex-wrap: wrap;
    }
    .filter-label {
      font-size: 0.78rem;
      color: #666688;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .filter-pills {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .pill {
      background: transparent;
      border: 1px solid #2a2a4a;
      color: #888aaa;
      padding: 0.3rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .pill:hover { border-color: #7c6fff; color: #e0e0ff; }
    .pill--active {
      background: #7c6fff;
      border-color: #7c6fff;
      color: white;
      font-weight: 600;
    }
    .show-cell {
      color: #7c6fff;
      font-size: 0.8rem;
      max-width: 120px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── KPI ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      padding: 1.5rem;
    }
    .kpi-card {
      background: #1a1a2e;
      border: 1px solid #2a2a4a;
      border-radius: 14px;
      padding: 1.2rem 1rem;
    }
    .kpi-label { font-size: 0.75rem; color: #888aaa; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi-value { font-size: 1.6rem; font-weight: 800; color: #e0e0ff; }

    /* ── Content Grid ── */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 1rem;
      padding: 0 1.5rem 1.5rem;
    }
    @media (max-width: 900px) {
      .content-grid { grid-template-columns: 1fr; }
    }

    /* ── Panel ── */
    .panel {
      background: #1a1a2e;
      border: 1px solid #2a2a4a;
      border-radius: 14px;
      padding: 1.2rem;
      overflow: hidden;
    }
    .panel-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #aaaacc;
      margin: 0 0 1rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ── Table ── */
    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .data-table th {
      text-align: left;
      padding: 0.5rem 0.6rem;
      color: #666688;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #222244;
    }
    .data-table td {
      padding: 0.6rem 0.6rem;
      border-bottom: 1px solid #1a1a30;
      color: #ccccee;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .amount { color: #7c6fff; font-weight: 600; }
    .empty { color: #555577; font-style: italic; padding: 1rem 0; }

    /* ── Badge ── */
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .badge--open { background: rgba(100,220,100,0.12); color: #64dc64; border: 1px solid rgba(100,220,100,0.3); }
    .badge--closed { background: rgba(120,120,180,0.12); color: #9999cc; border: 1px solid rgba(120,120,180,0.3); }

    /* ── Top Products ── */
    .top-list { display: flex; flex-direction: column; gap: 0.7rem; }
    .top-item { display: flex; align-items: center; gap: 0.8rem; }
    .top-rank { font-size: 1.1rem; min-width: 30px; text-align: center; }
    .top-info { flex: 1; min-width: 0; }
    .top-name { font-size: 0.88rem; font-weight: 600; color: #e0e0ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .top-meta { font-size: 0.75rem; color: #777799; }
    .top-bar-wrap { width: 70px; height: 6px; background: #252545; border-radius: 3px; overflow: hidden; }
    .top-bar { height: 100%; background: #7c6fff; border-radius: 3px; transition: width 0.4s ease; }
  `],
})
export class AdminDashboardComponent implements OnInit {

  unlocked = false;
  showPinModal = false;
  showPinSetup = false;

  shiftRows: ShiftRow[] = [];
  topProducts: TopProduct[] = [];
  allShows: Show[] = [];

  selectedShowId: string = 'all';

  totalRevenueCents = 0;
  totalOrders = 0;
  avgPerShift = 0;

  // ─── Gefilterte Werte ────────────────────────────
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
      ? Math.round(this.filteredRevenueCents / this.filteredShiftRows.length)
      : 0;
  }

  get selectedShowName(): string {
    return this.allShows.find(s => s.id === this.selectedShowId)?.name ?? '';
  }

  setShowFilter(showId: string) {
    this.selectedShowId = showId;
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
    if (hasPin) {
      this.showPinModal = true;
    } else {
      this.unlocked = true;
      await this.loadData();
    }
    this.cdr.detectChanges();
  }

  async onPinSuccess() {
    this.showPinModal = false;
    this.unlocked = true;
    await this.loadData();
    this.cdr.detectChanges();
  }

  onPinDismissed() {
    this.showPinModal = false;
    this.cdr.detectChanges();
  }

  openPinSetup() {
    this.showPinSetup = true;
    this.cdr.detectChanges();
  }

  onPinSetupSuccess() {
    this.showPinSetup = false;
    this.cdr.detectChanges();
  }

  private async loadData() {
    const [shifts, allOrders, shows] = await Promise.all([
      this.shiftsDb.getAllShifts(),
      this.ordersDb.getAllOrders(),
      this.showsDb.getAllShows(),
    ]);

    this.allShows = shows.sort((a, b) => b.createdAt - a.createdAt);

    // Schichten aufbauen
    this.shiftRows = shifts
      .sort((a, b) => b.openedAt - a.openedAt)
      .map(shift => {
        const orders = allOrders.filter(o => (o as any).shiftId === shift.id);
        const totalCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
        return { shift, orders, totalCents, orderCount: orders.length };
      });

    // KPIs
    this.totalRevenueCents = this.shiftRows.reduce((s, r) => s + r.totalCents, 0);
    this.totalOrders = allOrders.length;
    this.avgPerShift = this.shiftRows.length
      ? Math.round(this.totalRevenueCents / this.shiftRows.length)
      : 0;

    // Top Produkte
    const productMap = new Map<string, TopProduct>();
    for (const order of allOrders) {
      for (const item of order.items) {
        const existing = productMap.get(item.id ?? item.name);
        if (existing) {
          existing.qty += 1;
          existing.totalCents += item.priceCents;
        } else {
          productMap.set(item.id ?? item.name, {
            name: item.name,
            qty: 1,
            totalCents: item.priceCents,
          });
        }
      }
    }
    this.topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    this.cdr.detectChanges();
  }

  // ─── PDF EXPORT ───────────────────────────────────
  exportPdf() {
    const now = new Date().toLocaleDateString('de-AT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const shiftsHtml = this.shiftRows.map((row, i) => `
      <tr>
        <td>${this.formatDate(row.shift.openedAt)}</td>
        <td>${this.formatTime(row.shift.openedAt)}</td>
        <td>${row.shift.closedAt ? this.formatTime(row.shift.closedAt) : '—'}</td>
        <td>${row.orderCount}</td>
        <td>${this.formatEUR(row.totalCents)}</td>
        <td>${row.shift.closedAt ? 'Geschlossen' : 'Offen'}</td>
      </tr>
    `).join('');

    const productsHtml = this.topProducts.map((p, i) => `
      <tr>
        <td>#${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.qty}×</td>
        <td>${this.formatEUR(p.totalCents)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8">
        <title>POS Show — Admin Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; padding: 2cm; }
          h1 { font-size: 20px; color: #7c6fff; margin-bottom: 0.3cm; }
          .meta { color: #666; font-size: 10px; margin-bottom: 0.8cm; }
          .kpi-row { display: flex; gap: 0.5cm; margin-bottom: 0.8cm; }
          .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 0.4cm 0.6cm; flex: 1; }
          .kpi-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
          .kpi-value { font-size: 16px; font-weight: bold; color: #1a1a2e; }
          h2 { font-size: 13px; color: #7c6fff; margin: 0.6cm 0 0.3cm; text-transform: uppercase; letter-spacing: 0.05em; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 0.5cm; }
          th { text-align: left; padding: 5px 6px; background: #f0f0ff; font-size: 9px; text-transform: uppercase; color: #666; }
          td { padding: 5px 6px; border-bottom: 1px solid #eee; }
          tr:last-child td { border-bottom: none; }
          .amount { color: #7c6fff; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>POS Show — Admin Report</h1>
        <p class="meta">Generiert am ${now}</p>

        <div class="kpi-row">
          <div class="kpi"><div class="kpi-label">Gesamt Umsatz</div><div class="kpi-value">${this.formatEUR(this.totalRevenueCents)}</div></div>
          <div class="kpi"><div class="kpi-label">Kassenschichten</div><div class="kpi-value">${this.shiftRows.length}</div></div>
          <div class="kpi"><div class="kpi-label">Verkäufe gesamt</div><div class="kpi-value">${this.totalOrders}</div></div>
          <div class="kpi"><div class="kpi-label">Ø pro Schicht</div><div class="kpi-value">${this.formatEUR(this.avgPerShift)}</div></div>
        </div>

        <h2>Kassenschichten</h2>
        <table>
          <thead><tr><th>Datum</th><th>Geöffnet</th><th>Geschlossen</th><th>Verkäufe</th><th>Umsatz</th><th>Status</th></tr></thead>
          <tbody>${shiftsHtml || '<tr><td colspan="6">Keine Daten</td></tr>'}</tbody>
        </table>

        <h2>Meistverkaufte Produkte</h2>
        <table>
          <thead><tr><th>Rang</th><th>Produkt</th><th>Menge</th><th>Umsatz</th></tr></thead>
          <tbody>${productsHtml || '<tr><td colspan="4">Keine Daten</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  // ─── HELPERS ──────────────────────────────────────
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
