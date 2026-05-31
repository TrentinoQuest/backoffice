import { Component, inject, OnInit } from '@angular/core';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';

/**
 * Pagina impostazioni admin — stub (implementazione completa in Piano 3).
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [],
  template: `<div style="padding:28px">
    <h1 style="font-family:var(--tq-font-display);font-size:28px;color:var(--tq-text)">
      Impostazioni
    </h1>
  </div>`,
})
export class SettingsPage implements OnInit {
  private readonly breadcrumb = inject(BreadcrumbService);
  ngOnInit(): void {
    this.breadcrumb.set('Impostazioni');
  }
}
