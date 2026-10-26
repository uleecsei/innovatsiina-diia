import { ChangeDetectionStrategy, Component } from '@angular/core';

interface Specialist {
  readonly name: string;
  readonly skill: string;
  readonly email: string;
}

@Component({
  selector: 'app-services-page',
  templateUrl: './services.page.html',
  styleUrl: './services.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesPage {
  protected readonly specialists: readonly Specialist[] = [
    {
      name: 'Свиридюк Ольга',
      skill: 'Тренерка з ораторського мистецтва',
      email: 'svyrydiuko@gmail.com',
    },
    {
      name: 'Шевчук Наталя',
      skill: 'Майстриня з виготовлення прикрас з бісеру',
      email: 'shevchuknataa@gmail.com',
    },
    {
      name: 'Ковальчук Катерина',
      skill: 'Кар’єрна консультантка та менторка',
      email: 'ukr.action@gmail.com',
    },
  ];
}
