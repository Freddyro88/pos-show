export type Category = 'bebidas' | 'comida' | 'otros';

export interface Product {
  id: string;
  name: string;
  priceCents: number;

  // UX Admin
  category?: Category;
  usageCount?: number;
}
