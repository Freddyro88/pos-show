import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProductService } from './product.service';
import { Product } from './product.model';
import { SidebarComponent } from '../shared/sidebar.component';

type Category = 'bebidas' | 'comida' | 'otros';
type SortMode = 'name-asc' | 'name-desc' | 'usage-desc' | 'usage-asc';
type AdminProduct = Product & { category?: Category; usageCount?: number; };

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  template: `
    <!-- PIN Modal -->
    <div class="overlay" *ngIf="!isAdmin">
      <div class="dialog">
        <h3 class="dialog-title">🔒 Admin — Produkte</h3>
        <p class="dialog-text">Bitte PIN eingeben um fortzufahren.</p>
        <input class="form-input" type="password" [(ngModel)]="pinInput"
          placeholder="PIN" (keyup.enter)="enterAdmin()" style="margin-bottom:1rem" />
        <div class="dialog-actions">
          <button class="btn-confirm" (click)="enterAdmin()">Entsperren</button>
        </div>
      </div>
    </div>

    <div class="app-shell" *ngIf="isAdmin">
      <app-sidebar />

      <div class="main-area">

        <!-- Topbar -->
        <div class="topbar">
          <span class="topbar-title">Produktverwaltung</span>
          <div class="topbar-actions">
            <span class="topbar-badge">{{ visibleProducts.length }} Produkte</span>
            <button class="topbar-btn topbar-btn-danger" (click)="exitAdmin()">🔒 Sperren</button>
          </div>
        </div>

        <div class="page-content">

          <!-- Neues Produkt -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Neues Produkt hinzufügen</span>
            </div>
            <div class="card-body">
              <div class="form-row-4">
                <div>
                  <label class="form-label">Produktname</label>
                  <input class="form-input" [(ngModel)]="newName" placeholder="z.B. Cola" />
                </div>
                <div>
                  <label class="form-label">Preis (€)</label>
                  <input class="form-input" [(ngModel)]="newPriceEUR"
                    placeholder="3,00" inputmode="decimal" />
                </div>
                <div>
                  <label class="form-label">Kategorie</label>
                  <select class="form-select" [(ngModel)]="newCategory">
                    @for (c of categories; track c.value) {
                      <option [ngValue]="c.value">{{ c.label }}</option>
                    }
                  </select>
                </div>
                <div style="display:flex;align-items:flex-end">
                  <button class="btn-add" (click)="addProduct()" [disabled]="!canAddProduct">
                    + Produkt hinzufügen
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Filter + Suche -->
          <div class="card">
            <div class="card-body" style="padding:9px 13px">
              <div class="filter-row">
                <input class="form-input" style="max-width:220px"
                  [(ngModel)]="search" placeholder="🔍 Suche..." />
                <select class="form-select" style="max-width:160px" [(ngModel)]="categoryFilter">
                  <option value="all">Alle Kategorien</option>
                  @for (c of categories; track c.value) {
                    <option [value]="c.value">{{ c.label }}</option>
                  }
                </select>
                <select class="form-select" style="max-width:170px" [(ngModel)]="sortMode">
                  <option value="name-asc">Name A → Z</option>
                  <option value="name-desc">Name Z → A</option>
                  <option value="usage-desc">Meist genutzt</option>
                  <option value="usage-asc">Wenig genutzt</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Produktliste -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Produktliste</span>
              <span class="chip-blue">{{ visibleProducts.length }} Einträge</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Produktname</th>
                  <th>Preis</th>
                  <th>Kategorie</th>
                  <th>Nutzung</th>
                  <th style="text-align:right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                @for (p of visibleProducts; track p.id) {
                  <tr>
                    <td>
                      <input class="form-input" style="max-width:200px"
                        [(ngModel)]="p.name"
                        (ngModelChange)="validateProduct(p)" />
                      <div *ngIf="errorsById[''+p.id]?.name"
                        style="color:var(--red);font-size:10px;margin-top:2px">
                        {{ errorsById[''+p.id]?.name }}
                      </div>
                    </td>
                    <td>
                      <input class="form-input" style="max-width:90px;text-align:right"
                        [ngModel]="priceInputById[''+p.id] || ((p.priceCents||0)/100).toFixed(2).replace('.',',')"
                        (ngModelChange)="onPriceInput(p, $event)"
                        (blur)="onPriceBlur(p); validateProduct(p)"
                        inputmode="decimal" placeholder="0,00" />
                      <div *ngIf="errorsById[''+p.id]?.price"
                        style="color:var(--red);font-size:10px;margin-top:2px">
                        {{ errorsById[''+p.id]?.price }}
                      </div>
                    </td>
                    <td>
                      <select class="form-select" style="max-width:130px"
                        [(ngModel)]="p.category" (change)="validateProduct(p)">
                        <option [ngValue]="undefined">— Kategorie —</option>
                        @for (c of categories; track c.value) {
                          <option [ngValue]="c.value">{{ c.label }}</option>
                        }
                      </select>
                    </td>
                    <td>
                      <span class="chip-gray" *ngIf="p.usageCount">{{ p.usageCount }}×</span>
                      <span style="color:var(--text-light);font-size:11px" *ngIf="!p.usageCount">—</span>
                    </td>
                    <td style="text-align:right">
                      <button class="btn-add"
                        style="margin-right:6px;font-size:11px;padding:5px 10px"
                        (click)="updateProduct(p)"
                        [disabled]="hasErrors(p)">
                        ✓ Speichern
                      </button>
                      <button
                        style="background:transparent;border:1px solid rgba(229,57,53,0.3);color:var(--red);font-size:11px;padding:5px 10px;border-radius:5px;cursor:pointer;font-family:var(--font)"
                        (click)="removeProduct(p)">
                        ✕ Löschen
                      </button>
                    </td>
                  </tr>
                }
                <tr *ngIf="visibleProducts.length === 0">
                  <td colspan="5" style="color:var(--text-light);font-style:italic;padding:1rem">
                    Keine Produkte gefunden
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`:host { display:block; }
    .form-row-4 { display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:10px; align-items:end; }
    .filter-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  `]
})
export class AdminProductsComponent {

  isAdmin = false;
  pinInput = '';
  private readonly ADMIN_PIN = '1234';

  readonly Math = Math;
  readonly Number = Number;

  newName = '';
  newPriceEUR = '';
  newCategory: Category = 'otros';

  products: AdminProduct[] = [];

  categories: Array<{ value: Category; label: string }> = [
    { value: 'bebidas', label: 'Bebidas' },
    { value: 'comida', label: 'Comida' },
    { value: 'otros', label: 'Otros' },
  ];

  categoryFilter: Category | 'all' = 'all';
  search = '';
  sortMode: SortMode = 'name-asc';
  priceInputById: Record<string, string> = {};
  errorsById: Record<string, { name?: string; price?: string; category?: string }> = {};

  constructor(private productService: ProductService) {
    this.refresh();
  }

  enterAdmin() {
    if (this.pinInput === this.ADMIN_PIN) { this.isAdmin = true; this.pinInput = ''; }
    else { alert('Falsche PIN'); }
  }

  exitAdmin() { this.isAdmin = false; }

  refresh() {
    this.products = this.productService.getAll() as AdminProduct[];
    for (const p of this.products) {
      const id = this.idOf(p);
      if (!(id in this.priceInputById)) {
        this.priceInputById[id] = this.formatCentsToMoney(p.priceCents ?? 0);
      }
    }
  }

  get visibleProducts(): AdminProduct[] {
    const q = this.search.trim().toLowerCase();
    const filtered = [...(this.products ?? [])].filter(p => {
      const byCat = this.categoryFilter === 'all' ? true : p.category === this.categoryFilter;
      const bySearch = !q ? true : (p.name ?? '').toLowerCase().includes(q);
      return byCat && bySearch;
    });
    const byName = (a: AdminProduct, b: AdminProduct) => (a.name ?? '').localeCompare(b.name ?? '', 'de-AT');
    const byUsage = (a: AdminProduct, b: AdminProduct) => (a.usageCount ?? 0) - (b.usageCount ?? 0);
    switch (this.sortMode) {
      case 'name-asc':  return filtered.sort(byName);
      case 'name-desc': return filtered.sort((a, b) => -byName(a, b));
      case 'usage-asc': return filtered.sort(byUsage);
      case 'usage-desc':return filtered.sort((a, b) => -byUsage(a, b));
      default: return filtered;
    }
  }

  get canAddProduct(): boolean {
    const cents = this.parseMoneyToCents(this.newPriceEUR);
    return this.newName.trim().length > 0 && cents !== null && cents > 0;
  }

  addProduct() {
    const name = this.newName.trim();
    const cents = this.parseMoneyToCents(this.newPriceEUR);
    if (!name || cents === null || cents <= 0) return;
    this.productService.add({ id: this.productService.generateId(name), name, priceCents: cents, category: this.newCategory, usageCount: 0 });
    this.newName = ''; this.newPriceEUR = ''; this.newCategory = 'otros';
    this.refresh();
  }

  updateProduct(p: AdminProduct) {
    if (!this.validateProduct(p)) return;
    this.productService.update(p);
    this.refresh();
  }

  removeProduct(p: AdminProduct) {
    const name = (p.name ?? '').trim() || 'dieses Produkt';
    if (!window.confirm(`Sicher löschen: "${name}"?`)) return;
    this.productService.remove(p.id);
    this.refresh();
  }

  validateProduct(p: AdminProduct): boolean {
    const id = this.idOf(p);
    const errs: { name?: string; price?: string } = {};
    if (!(p.name ?? '').trim()) errs.name = 'Name darf nicht leer sein.';
    if (!Number.isFinite(p.priceCents) || (p.priceCents as number) <= 0) errs.price = 'Preis ungültig.';
    this.errorsById[id] = errs;
    return Object.keys(errs).length === 0;
  }

  hasErrors(p: AdminProduct): boolean {
    const errs = this.errorsById[this.idOf(p)];
    return !!errs && Object.keys(errs).length > 0;
  }

  onPriceInput(p: AdminProduct, raw: any) {
    const id = this.idOf(p);
    this.priceInputById[id] = String(raw ?? '');
    const cents = this.parseMoneyToCents(this.priceInputById[id]);
    if (cents === null) { this.errorsById[id] = { ...(this.errorsById[id] ?? {}), price: 'Preis ungültig.' }; return; }
    p.priceCents = cents;
    const { price, ...rest } = this.errorsById[id] ?? {};
    this.errorsById[id] = rest;
  }

  onPriceBlur(p: AdminProduct) {
    this.priceInputById[this.idOf(p)] = this.formatCentsToMoney(p.priceCents ?? 0);
  }

  formatEUR(cents: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100);
  }

  private formatCentsToMoney(cents: number): string {
    return ((cents ?? 0) / 100).toFixed(2).replace('.', ',');
  }

  private parseMoneyToCents(input: string): number | null {
    let s = (input ?? '').trim().replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    if (!s || !/^\d+(\.\d{0,2})?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  private idOf(p: AdminProduct): string { return String(p.id); }
}
