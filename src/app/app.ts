import { Component, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  private sw = inject(SwUpdate);

  updateAvailable = false;

  constructor() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateAvailable = true; // muestra banner
      });
  }

  reloadToUpdate() {
    window.location.reload();
  }

  dismissUpdate() {
    this.updateAvailable = false;
  }
}
