import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-reports-page',
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  protected readonly years: readonly number[] = [2025, 2026, 2027, 2028, 2029, 2030];
}
