import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from './product.service';
import { Product } from './product.model';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-products.component.html',
})
export class AdminProductsComponent {
  // Simple admin gate (later: better auth)
  isAdmin = false;
  pinInput = '';
  private readonly ADMIN_PIN = '1234';

  // Form fields
  newName = '';
  newPriceEUR = '';

  // Data
  products: Product[] = [];

  constructor(private productService: ProductService) {
    this.refresh();
  }

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

  refresh() {
    this.products = this.productService.getAll();
  }

  addProduct() {
    const name = this.newName.trim();
    const price = this.parseEUR(this.newPriceEUR);

    if (!name) return alert('Name fehlt');
    if (price <= 0) return alert('Preis ungültig');

    const product: Product = {
      id: this.productService.generateId(name),
      name,
      priceCents: price,
    };

    this.productService.add(product);
    this.newName = '';
    this.newPriceEUR = '';
    this.refresh();
  }

  updateProduct(p: Product) {
    this.productService.update(p);
    this.refresh();
  }

  removeProduct(p: Product) {
    const ok = confirm(`Löschen: ${p.name}?`);
    if (!ok) return;

    this.productService.remove(p.id);
    this.refresh();
  }

  formatEUR(cents: number): string {
    return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }

  // Accepts "3", "3.5", "3,5", "€ 3,50"
  private parseEUR(input: string): number {
    const cleaned = input.replace(/[€\s]/g, '').replace(',', '.');
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }
}