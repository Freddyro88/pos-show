import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar">
      <div class="sidebar-logo">
        <span class="sidebar-logo-icon">🛒</span>
        <span class="sidebar-logo-text">POS Show</span>
      </div>

      <nav class="sidebar-nav">
        <div class="sidebar-section-label">Kasse</div>
        <a class="sidebar-item" routerLink="/pos" routerLinkActive="active">
          <span class="sidebar-item-icon">🖥️</span> Kassensystem
        </a>

        <div class="sidebar-section-label">Verwaltung</div>
        <a class="sidebar-item" routerLink="/dashboard" routerLinkActive="active">
          <span class="sidebar-item-icon">📊</span> Dashboard
        </a>
        <a class="sidebar-item" routerLink="/admin" routerLinkActive="active">
          <span class="sidebar-item-icon">📦</span> Produkte
        </a>
        <a class="sidebar-item" routerLink="/shows" routerLinkActive="active">
          <span class="sidebar-item-icon">🎭</span> Shows
        </a>
        <a class="sidebar-item" routerLink="/users" routerLinkActive="active">
          <span class="sidebar-item-icon">👤</span> Benutzer
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-status">
          <div class="sidebar-status-dot"></div>
          Offline-Modus
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {}
