import { ChangeDetectionStrategy, Component } from '@angular/core';
import { loadContentList } from '../../content-list';

interface Report {
  readonly id: string;
  readonly year: number;
  readonly pdfUrl: string;
}

@Component({
  selector: 'app-reports-page',
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  protected readonly content = loadContentList<Report>('/api/reports');
}
