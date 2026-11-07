import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

type ListState<T> = { status: 'loading' | 'error' } | { status: 'ready'; items: T[] };

export function loadContentList<T>(path: string) {
  return toSignal(
    inject(HttpClient)
      .get<T[]>(path)
      .pipe(
        map((items): ListState<T> => ({ status: 'ready', items })),
        catchError(() => of<ListState<T>>({ status: 'error' })),
      ),
    { initialValue: { status: 'loading' } as ListState<T> },
  );
}
