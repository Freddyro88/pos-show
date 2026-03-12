import * as XLSX from 'xlsx';
import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Shift, ShiftsDbService } from '../core/shifts-db.service';
import { StoredOrder, OrdersDbService } from '../core/orders-db.service';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-shift-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- ─────────────────────────────────────────
       ABSCHLUSS DER KASSENSCHICHT
       Erscheint nach dem Schließen der Kassenschicht
    ───────────────────────────────────────── -->
    <div class="summary-screen">
      <div class="summary-box">

       <!-- ─── TITEL + SHOW NAME ─────────────────────── -->
<div class="summary-icon">🔒</div>
<h1 class="summary-title">Kassenschicht geschlossen</h1>
@if (shift.showName) {
  <div class="summary-show-name">🎪 {{ shift.showName }}</div>
}

        <!-- Öffnungs- und Schließzeit -->
        <div class="summary-time">
          <span>{{ formatDateTime(shift.openedAt) }}</span>
          <span class="time-arrow">→</span>
          <span>{{ formatDateTime(shift.closedAt!) }}</span>
        </div>

        <!-- Hauptstatistiken -->
        <div class="summary-stats">
          <div class="stat-box">
            <div class="stat-label">Gesamtumsatz</div>
            <div class="stat-value green">{{ formatEUR(shift.totalCents) }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Verkäufe</div>
            <div class="stat-value">{{ shift.orderIds.length }}</div>
          </div>
        </div>

        <!-- Verkaufte Artikel dieser Kassenschicht -->
        <div class="summary-products">
          <div class="summary-products-title">Verkaufte Artikel</div>
          @for (item of productSummary; track $index) {
            <div class="summary-product-row">
              <span class="sp-qty">{{ item.qty }}×</span>
              <span class="sp-name">{{ item.name }}</span>
              <span class="sp-total">{{ formatEUR(item.totalCents) }}</span>
            </div>
          }
        </div>

       <!-- ─── EXPORT BUTTONS ────────────────────────── -->
<div class="summary-actions">
  <button class="btn-export-csv" (click)="exportCSV()">
    ↓ CSV
  </button>
  <button class="btn-export-pdf" (click)="exportPDF()">
    ↓ PDF
  </button>
  <button class="btn-export-csv" (click)="exportExcel()">
    ↓ Excel
  </button>
  <button class="btn-new-shift" (click)="onNewShift()">
    ▶ Neue Kassenschicht
  </button>
</div>
        <!-- ─────────────────────────────────────────
           VERLAUF ALLER KASSENSCHICHTEN
           Zeigt alle vergangenen Kassenschichten
        ───────────────────────────────────────── -->
        <div class="summary-products" style="margin-top: 8px;">
          <div class="summary-products-title">Alle Kassenschichten</div>

          @if (allShifts.length === 0) {
            <p class="muted">Keine Kassenschichten vorhanden.</p>
          } @else {
            @for (s of allShifts; track s.id) {

              <!-- Zeile je Kassenschicht — antippen zum Erweitern -->
              <div class="sale-row" (click)="toggleShiftDetails(s.id)"
                [style.opacity]="s.id === shift.id ? '1' : '0.6'">
                <span class="sale-time">{{ formatDateTime(s.openedAt) }}</span>
                <span class="sale-items">{{ s.orderIds.length }} Verkäufe</span>
                <strong class="sale-total">{{ formatEUR(s.totalCents) }}</strong>
                <span class="chevron">{{ expandedShiftId === s.id ? '▲' : '▼' }}</span>
              </div>

              <!-- Detailansicht der Kassenschicht -->
              @if (expandedShiftId === s.id) {
                <div class="sale-details">
                  @for (order of getOrdersForShift(s.id); track order.id) {
                    <div class="detail-row">
                      <span>{{ formatDateTime(order.timestamp) }}</span>
                      <span>{{ formatEUR(order.totalCents) }}</span>
                    </div>
                  }
                  @if (getOrdersForShift(s.id).length === 0) {
                    <p class="muted">Keine Verkäufe.</p>
                  }
                </div>
              }

            }
          }
        </div>

      </div>
    </div>
  `,
})
export class ShiftSummaryComponent implements OnInit {

  // ─── INPUTS — Daten der Kassenschicht und Bestellungen ─
  @Input() shift!: Shift;
  @Input() orders: StoredOrder[] = [];

  // ─── OUTPUT — Event für neue Kassenschicht ──────────
  @Output() newShift = new EventEmitter<void>();

  // ─── ALLE KASSENSCHICHTEN ──────────────────────────
  allShifts: Shift[] = [];

  // ─── ERWEITERTE KASSENSCHICHT im Verlauf ───────────
  expandedShiftId: string | null = null;

  // ─── ALLE BESTELLUNGEN für den Verlauf ─────────────
  allOrders: StoredOrder[] = [];

  // ─── CONSTRUCTOR ───────────────────────────────────
  constructor(
    private shiftsDb: ShiftsDbService,
    private ordersDb: OrdersDbService,
    private cdr: ChangeDetectorRef // fuerza actualización después de async
  ) {}

  // ─── INIT — lädt alle Kassenschichten und Bestellungen ─
  async ngOnInit() {
    const shifts = await this.shiftsDb.getAllShifts();
    // Neueste Kassenschicht zuerst
    this.allShifts = shifts.sort((a, b) => b.openedAt - a.openedAt);
    // Alle Bestellungen für den Verlauf laden
    this.allOrders = await this.ordersDb.getAllOrders();
    this.cdr.detectChanges(); // ← fuerza actualización de la vista
  }

  // ─── NEUE KASSENSCHICHT öffnen ─────────────────────
  onNewShift() {
    this.newShift.emit();
  }

  // ─── KASSENSCHICHT DETAILS — ein/ausblenden ────────
  toggleShiftDetails(shiftId: string) {
    this.expandedShiftId = this.expandedShiftId === shiftId ? null : shiftId;
  }

  // ─── BESTELLUNGEN EINER KASSENSCHICHT ──────────────
  getOrdersForShift(shiftId: string): StoredOrder[] {
    return this.allOrders.filter(o => (o as any).shiftId === shiftId);
  }

  // ─── ARTIKEL ZUSAMMENFASSEN — z.B. 2× Bier ────────
  get productSummary(): { name: string; qty: number; totalCents: number }[] {
    const map = new Map<string, { name: string; qty: number; totalCents: number }>();
    for (const order of this.orders) {
      for (const item of order.items) {
        const existing = map.get(item.id);
        if (existing) {
          existing.qty += 1;
          existing.totalCents += item.priceCents;
        } else {
          map.set(item.id, { name: item.name, qty: 1, totalCents: item.priceCents });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }

  // ─── CSV EXPORTIEREN ───────────────────────────────
  exportCSV() {
    const lines: string[] = [];
    lines.push('POS Show - Kassenschicht Abschluss');
    lines.push(`Geöffnet;${this.formatDateTime(this.shift.openedAt)}`);
    lines.push(`Geschlossen;${this.formatDateTime(this.shift.closedAt!)}`);
    lines.push(`Gesamtumsatz;${this.formatEUR(this.shift.totalCents)}`);
    lines.push(`Anzahl Verkäufe;${this.shift.orderIds.length}`);
    lines.push('');
    lines.push('Artikel;Menge;Umsatz');
    for (const item of this.productSummary) {
      lines.push(`${item.name};${item.qty};${this.formatEUR(item.totalCents)}`);
    }
    lines.push('');
    lines.push('Einzelne Verkäufe');
    lines.push('Zeit;Artikel;Gesamt');
    for (const order of this.orders) {
      const items = order.items.map((i: any) => i.name).join(', ');
      lines.push(`${this.formatDateTime(order.timestamp)};${items};${this.formatEUR(order.totalCents)}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kassenschicht_${this.formatFileDate(this.shift.openedAt)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── PDF EXPORTIEREN ───────────────────────────────
  exportPDF() {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('POS Show - Kassenschicht Abschluss', 20, y);
    y += 12;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Geöffnet: ${this.formatDateTime(this.shift.openedAt)}`, 20, y);
    y += 7;
    doc.text(`Geschlossen: ${this.formatDateTime(this.shift.closedAt!)}`, 20, y);
    y += 12;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Gesamtumsatz: ${this.formatEUR(this.shift.totalCents)}`, 20, y);
    y += 8;
    doc.text(`Anzahl Verkäufe: ${this.shift.orderIds.length}`, 20, y);
    y += 14;

    doc.setFontSize(12);
    doc.text('Verkaufte Artikel:', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    for (const item of this.productSummary) {
      doc.text(`${item.qty}×  ${item.name}`, 24, y);
      doc.text(this.formatEUR(item.totalCents), 160, y);
      y += 7;
    }

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Einzelne Verkäufe:', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (const order of this.orders) {
      const items = order.items.map((i: any) => i.name).join(', ');
      const itemLines = doc.splitTextToSize(items, 100);
      doc.text(this.formatDateTime(order.timestamp), 24, y);
      doc.text(this.formatEUR(order.totalCents), 160, y);
      y += 5;
      doc.text(itemLines, 28, y);
      y += itemLines.length * 5 + 3;
      if (y > 270) { doc.addPage(); y = 20; }
    }

    doc.save(`kassenschicht_${this.formatFileDate(this.shift.openedAt)}.pdf`);
  }


// ─── EXCEL EXPORTIEREN ─────────────────────────────
exportExcel() {
  // ─── Hoja 1: Zusammenfassung ───────────────────
  const summary = [
    ['POS Show — Kassenschicht Abschluss'],
    [],
    ['Show', this.shift.showName ?? '—'],
    ['Geöffnet', this.formatDateTime(this.shift.openedAt)],
    ['Geschlossen', this.formatDateTime(this.shift.closedAt!)],
    ['Gesamtumsatz', this.shift.totalCents / 100],
    ['Anzahl Verkäufe', this.shift.orderIds.length],
    [],
    ['Artikel', 'Menge', 'Umsatz (€)'],
    ...this.productSummary.map(p => [p.name, p.qty, p.totalCents / 100]),
  ];

  // ─── Hoja 2: Einzelne Verkäufe ─────────────────
  const orders = [
    ['Zeit', 'Artikel', 'Gesamt (€)'],
    ...this.orders.map(o => [
      this.formatDateTime(o.timestamp),
      o.items.map((i: any) => i.name).join(', '),
      o.totalCents / 100,
    ]),
  ];

  // ─── Workbook erstellen ────────────────────────
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  const ws2 = XLSX.utils.aoa_to_sheet(orders);

  // ─── Spaltenbreiten setzen ─────────────────────
  ws1['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }];
  ws2['!cols'] = [{ wch: 22 }, { wch: 40 }, { wch: 15 }];

  XLSX.utils.book_append_sheet(wb, ws1, 'Zusammenfassung');
  XLSX.utils.book_append_sheet(wb, ws2, 'Verkäufe');

  // ─── Datei speichern ──────────────────────────
  XLSX.writeFile(wb, `kassenschicht_${this.shift.showName ?? 'export'}_${this.formatFileDate(this.shift.openedAt)}.xlsx`);
}

  // ─── DATUM FORMATIEREN — z.B. "18:32 • 05.03.2026" ─
  formatDateTime(timestamp: number): string {
    const d = new Date(timestamp);
    const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} • ${date}`;
  }

  // ─── DATEINAME FORMATIEREN ─────────────────────────
  formatFileDate(timestamp: number): string {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // ─── BETRAG FORMATIEREN — z.B. "€ 3,00" ───────────
  formatEUR(cents: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }
}
