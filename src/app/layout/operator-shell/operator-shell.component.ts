import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-operator-shell',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './operator-shell.component.html',
  styleUrl: './operator-shell.component.scss',
})
export class OperatorShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
