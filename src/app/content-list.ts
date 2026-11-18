import { HttpClient } from '@angular/common/http';
import { inject, makeStateKey, REQUEST_CONTEXT, RESPONSE_INIT, TransferState } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, tap } from 'rxjs';
import type { SiteRequestContext } from './seo';

type ListState<T> = { status: 'loading' | 'error' } | { status: 'ready'; items: T[] };

export function loadContentList<T>(path: string) {
  const http = inject(HttpClient);
  const context = inject(REQUEST_CONTEXT) as SiteRequestContext | null;
  const response = inject(RESPONSE_INIT);
  const transferState = inject(TransferState);
  const key = makeStateKey<T[]>(`content:${path}`);

  const cached = transferState.get(key, null);
  transferState.remove(key);
  const url = context ? new URL(path, context.apiOrigin).href : path;
  const items$ = cached
    ? of(cached)
    : http.get<T[]>(url, { transferCache: false, timeout: 5000 }).pipe(
        tap((items) => {
          if (context) {
            transferState.set(key, items);
          }
        }),
        catchError(() => {
          if (response) {
            response.status = 503;
          }
          return of(null);
        }),
      );

  return toSignal(
    items$.pipe(
      map((items): ListState<T> => (items ? { status: 'ready', items } : { status: 'error' })),
    ),
    { initialValue: { status: 'loading' } as ListState<T> },
  );
}
