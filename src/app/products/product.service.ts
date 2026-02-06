import { Injectable } from '@angular/core';
import { Product, Category } from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly PRODUCTS_KEY = 'pos_products_v1';

  private products: Product[] = [
    { id: 'coke', name: 'Coca-Cola', priceCents: 300, category: 'bebidas', usageCount: 0 },
    { id: 'fanta', name: 'Fanta', priceCents: 300, category: 'bebidas', usageCount: 0 },
    { id: 'beer', name: 'Bier', priceCents: 450, category: 'bebidas', usageCount: 0 },
    { id: 'empanada', name: 'Empanada', priceCents: 500, category: 'comida', usageCount: 0 },
    { id: 'candy', name: 'Bonbon', priceCents: 100, category: 'otros', usageCount: 0 },
  ];

  constructor() {
    this.load();
  }

  getAll(): Product[] {
    // devuelve copia para evitar mutaciones accidentales
    return this.products.map((p) => ({ ...p }));
  }

  setAll(next: Product[]) {
    this.products = (next ?? []).map((p) => this.normalize(p));
    this.save();
  }

  add(product: Product) {
    this.products = [this.normalize(product), ...this.products];
    this.save();
  }

  update(updated: Product) {
    const normalized = this.normalize(updated);
    this.products = this.products.map((p) => (p.id === normalized.id ? normalized : p));
    this.save();
  }

  remove(productId: string) {
    this.products = this.products.filter((p) => p.id !== productId);
    this.save();
  }

  // ✅ Para “ordenar por uso”: llámalo cuando se venda/use un producto
  incrementUsage(productId: string, by: number = 1) {
  const inc = Number.isFinite(by) ? Math.max(1, Math.floor(by)) : 1;

  this.products = this.products.map((p) => {
    if (p.id !== productId) return p;
    const current = p.usageCount ?? 0;
    return { ...p, usageCount: Math.max(0, current + inc) };
  });

  this.save();
}


  generateId(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 6)
        : Math.random().toString(16).slice(2, 8);

    return `${base || 'product'}-${suffix}`;
  }

  private load() {
    const raw = localStorage.getItem(this.PRODUCTS_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as any;
      if (Array.isArray(parsed) && parsed.length > 0) {
        // ✅ Migración / normalización
        this.products = parsed.map((p) => this.normalize(p));
        // Guarda ya migrado (añade category/usageCount si faltaban)
        this.save();
      }
    } catch {
      // ignore
    }
  }

  private save() {
    localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(this.products));
  }

  private normalize(input: any): Product {
    const id = String(input?.id ?? '').trim();
    const name = String(input?.name ?? '').trim();
    const priceCents = Number(input?.priceCents ?? 0);

    const category = this.normalizeCategory(input?.category);
    const usageCountRaw = Number(input?.usageCount ?? 0);

    return {
      id,
      name,
      priceCents: Number.isFinite(priceCents) ? Math.max(0, Math.round(priceCents)) : 0,
      category,
      usageCount: Number.isFinite(usageCountRaw) ? Math.max(0, Math.floor(usageCountRaw)) : 0,
    };
  }

  private normalizeCategory(value: any): Category {
    if (value === 'bebidas' || value === 'comida' || value === 'otros') return value;
    return 'otros';
  }
}

