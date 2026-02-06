import { Injectable } from '@angular/core';
import { Product } from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly PRODUCTS_KEY = 'pos_products_v1';

  private products: Product[] = [
    { id: 'coke', name: 'Coca-Cola', priceCents: 300 },
    { id: 'fanta', name: 'Fanta', priceCents: 300 },
    { id: 'beer', name: 'Bier', priceCents: 450 },
    { id: 'empanada', name: 'Empanada', priceCents: 500 },
    { id: 'candy', name: 'Bonbon', priceCents: 100 },
  ];

  constructor() {
    this.load();
  }

  getAll(): Product[] {
    return [...this.products];
  }

  setAll(next: Product[]) {
    this.products = next;
    this.save();
  }

  add(product: Product) {
    this.products = [product, ...this.products];
    this.save();
  }

  update(updated: Product) {
    this.products = this.products.map((p) =>
      p.id === updated.id ? updated : p
    );
    this.save();
  }

  remove(productId: string) {
    this.products = this.products.filter((p) => p.id !== productId);
    this.save();
  }

  generateId(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return `${base || 'product'}-${crypto.randomUUID().slice(0, 6)}`;
  }

  private load() {
    const raw = localStorage.getItem(this.PRODUCTS_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Product[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.products = parsed;
      }
    } catch {
      // ignore
    }
  }

  private save() {
    localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(this.products));
  }
}