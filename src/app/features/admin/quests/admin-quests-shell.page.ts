import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-quests-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './admin-quests-shell.page.html',
  styleUrl: './admin-quests-shell.page.scss',
})
export class AdminQuestsShellPage {
  private readonly router = inject(Router);

  get isListActive(): boolean {
    return this.normalizedUrl() === '/admin/quests';
  }

  get isMapActive(): boolean {
    return this.normalizedUrl() === '/admin/quests/map';
  }

  goToList(): void {
    void this.router.navigateByUrl('/admin/quests');
  }

  goToMap(): void {
    void this.router.navigateByUrl('/admin/quests/map');
  }

  onCreateClick(): void {
    void this.router.navigateByUrl('/admin/quests/new');
  }

  private normalizedUrl(): string {
    return this.router.url.split('?')[0].split('#')[0].replace(/\/$/, '');
  }
}
