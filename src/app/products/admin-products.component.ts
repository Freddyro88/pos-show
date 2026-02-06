import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from './product.service';
import { Product } from './product.model';

type Category = 'bebidas' | 'comida' | 'otros';
type SortMode = 'name-asc' | 'name-desc' | 'usage-desc' | 'usage-asc';

// Extiende tu Product sin obligarte a tocar el modelo ahora
type AdminProduct = Product & {
  category?: Category;
  usageCount?: number; // si no existe en tu data, queda en 0 y el sort por uso no tendrá efecto
};

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-products.component.html',
})
export class AdminProductsComponent {
  // ===== Admin gate =====
  isAdmin = false;
  pinInput = '';
  private readonly ADMIN_PIN = '1234';

  // Si AÚN tienes Math/Number en el template, esto evita el error TS2339
  readonly Math = Math;
  readonly Number = Number;

  // ===== Form fields (nuevo producto) =====
  newName = '';
  newPriceEUR = '';
  newCategory: Category = 'otros';

  // ===== Data =====
  products: AdminProduct[] = [];

  // ===== UX Admin: filtros / orden =====
  categories: Array<{ value: Category; label: string }> = [
    { value: 'bebidas', label: 'Bebidas' },
    { value: 'comida', label: 'Comida' },
    { value: 'otros', label: 'Otros' },
  ];

  categoryFilter: Category | 'all' = 'all';
  search = '';
  sortMode: SortMode = 'name-asc';

  // ===== UX Admin: edición precio como string + errores por producto =====
  priceInputById: Record<string, string> = {};
  errorsById: Record<string, { name?: string; price?: string; category?: string }> = {};

  constructor(private productService: ProductService) {
    this.refresh();
  }

  // ===== Admin gate =====
  enterAdmin() {
    if (this.pinInput === this.ADMIN_PIN) {
      this.isAdmin = true;
      this.pinInput = '';
    } else {
      alert('Falsche PIN');
    }
  }

  exitAdmin() {
    this.isAdmin = false;
  }

  // ===== Data load =====
  refresh() {
    // el service devuelve Product[], lo tratamos como AdminProduct[] sin romper
    this.products = this.productService.getAll() as AdminProduct[];

    // inicializa inputs de precio para edición cómoda
    for (const p of this.products) {
      const id = this.idOf(p);
      if (!(id in this.priceInputById)) {
        this.priceInputById[id] = this.formatCentsToMoney(p.priceCents ?? 0);
      }
    }
  }

  // ===== Listado visible (filtrado + ordenado) =====
  get visibleProducts(): AdminProduct[] {
    const list = [...(this.products ?? [])];

    const q = this.search.trim().toLowerCase();
    const filtered = list.filter((p) => {
      const byCat = this.categoryFilter === 'all' ? true : p.category === this.categoryFilter;
      const bySearch = !q ? true : (p.name ?? '').toLowerCase().includes(q);
      return byCat && bySearch;
    });

    const byName = (a: AdminProduct, b: AdminProduct) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'de-AT');

    const byUsage = (a: AdminProduct, b: AdminProduct) =>
      (a.usageCount ?? 0) - (b.usageCount ?? 0);

    switch (this.sortMode) {
      case 'name-asc':
        return filtered.sort(byName);
      case 'name-desc':
        return filtered.sort((a, b) => -byName(a, b));
      case 'usage-asc':
        return filtered.sort(byUsage);
      case 'usage-desc':
        return filtered.sort((a, b) => -byUsage(a, b));
      default:
        return filtered;
    }
  }

  trackByProduct = (_: number, p: AdminProduct) => this.idOf(p);

  // ===== CRUD: Add =====
  addProduct() {
    const name = this.newName.trim();
    const cents = this.parseMoneyToCents(this.newPriceEUR);

    if (!name) {
      alert('Name fehlt');
      return;
    }
    if (cents === null || cents <= 0) {
      alert('Preis ungültig');
      return;
    }

    const product: AdminProduct = {
      id: this.productService.generateId(name),
      name,
      priceCents: cents,
      category: this.newCategory,
      usageCount: 0,
    };

    this.productService.add(product); // AdminProduct es asignable a Product
    this.newName = '';
    this.newPriceEUR = '';
    this.newCategory = 'otros';
    this.refresh();
  }

  // ===== CRUD: Update (con validación) =====
  updateProduct(p: AdminProduct) {
    if (!this.validateProduct(p)) return;

    this.productService.update(p);
    this.refresh();
  }

  // ===== CRUD: Remove (con confirmación) =====
  removeProduct(p: AdminProduct) {
    const ok = confirm(`Löschen: ${p.name ?? ''}?`);
    if (!ok) return;

    this.productService.remove(p.id);
    this.refresh();
  }

  // Alternativa si quieres el texto “más seguro”
  confirmDelete(p: AdminProduct) {
    const name = (p.name ?? '').trim() || 'dieses Produkt';
    const ok = window.confirm(`Sicher löschen: ${name}? Diese Aktion kann nicht rückgängig gemacht werden.`);
    if (!ok) return;
    this.productService.remove(p.id);
    this.refresh();
  }

  // ===== Validación básica =====
  validateProduct(p: AdminProduct): boolean {
    const id = this.idOf(p);

    const name = (p.name ?? '').trim();
    const price = p.priceCents;

    const errs: { name?: string; price?: string; category?: string } = {};

    if (!name) errs.name = 'Name darf nicht leer sein.';
    if (!Number.isFinite(price) || (price as number) <= 0) errs.price = 'Preis ungültig (muss > 0 sein).';
    if (p.category && !['bebidas', 'comida', 'otros'].includes(p.category)) errs.category = 'Kategorie ungültig.';

    this.errorsById[id] = errs;
    return Object.keys(errs).length === 0;
  }

  hasErrors(p: AdminProduct): boolean {
    const id = this.idOf(p);
    const errs = this.errorsById[id];
    return !!errs && Object.keys(errs).length > 0;
  }

  // ===== Precio: input UX (evita Math/Number en HTML) =====
  onPriceInput(p: AdminProduct, raw: any) {
    const id = this.idOf(p);
    this.priceInputById[id] = String(raw ?? '');

    const cents = this.parseMoneyToCents(this.priceInputById[id]);
    if (cents === null) {
      this.errorsById[id] = { ...(this.errorsById[id] ?? {}), price: 'Preis ungültig.' };
      return;
    }

    p.priceCents = cents;

    // Limpia error de precio si ahora es válido
    const prev = this.errorsById[id] ?? {};
    const { price, ...rest } = prev;
    this.errorsById[id] = rest;

    this.validateProduct(p);
  }

  onPriceBlur(p: AdminProduct) {
    const id = this.idOf(p);
    this.priceInputById[id] = this.formatCentsToMoney(p.priceCents ?? 0);
  }

  // ===== Formatos =====
  formatEUR(cents: number): string {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR',
    }).format((cents ?? 0) / 100);
  }

  // Para input (sin símbolo €, más simple de editar)
  private formatCentsToMoney(cents: number): string {
    const v = (cents ?? 0) / 100;
    return v.toFixed(2).replace('.', ',');
  }

  // Acepta: "3", "3.5", "3,5", "€ 3,50", "1.234,56"
  private parseMoneyToCents(input: string): number | null {
    let s = (input ?? '').trim();
    if (!s) return null;

    s = s.replace(/[€\s]/g, ''); // quita € y espacios
    s = s.replace(/\./g, '');    // quita separador de miles (europeo)
    s = s.replace(',', '.');     // decimal coma -> punto

    // número con hasta 2 decimales
    if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;

    const n = Number(s);
    if (!Number.isFinite(n)) return null;

    return Math.round(n * 100);
  }

  private idOf(p: AdminProduct): string {
    return String(p.id);
  }
}
