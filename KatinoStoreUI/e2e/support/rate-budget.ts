import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// The storefront API limits each client to 5 auth calls, 30 cart writes and 100 requests per minute.
// Every request the tests make (browser or Node) is recorded here, and helpers wait for room before
// acting, so the suite does not trip the limits by accident. Margins cover follow-up requests
// (refetches) that are not reserved up front.

export type BudgetKind = 'auth' | 'cartWrite' | 'any';

const WINDOW_MS = 61 * 1000;
const LIMITS: Record<BudgetKind, number> = { auth: 4, cartWrite: 24, any: 75 };
// Kept in a file outside the repository: a new worker (next project, a restart after a failed test) and
// the next run right after this one continue the same window. Old entries are pruned on every read.
const STORE = path.join(os.tmpdir(), 'katino-store-e2e-rate-budget.json');

function load(): Record<BudgetKind, number[]> {
  try {
    return JSON.parse(fs.readFileSync(STORE, 'utf-8'));
  } catch {
    return { auth: [], cartWrite: [], any: [] };
  }
}

let sent = load();

function save(): void {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(sent));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function classify(url: string, method: string): BudgetKind[] {
  if (!url.includes('/api/')) {
    return [];
  }

  const kinds: BudgetKind[] = ['any'];
  if (url.includes('/api/CustomerAuth/')) {
    kinds.push('auth');
  }
  if (url.includes('/api/Cart/items') && method !== 'GET') {
    kinds.push('cartWrite');
  }
  return kinds;
}

export function record(url: string, method: string): void {
  const now = Date.now();
  const kinds = classify(url, method);
  sent = load();
  for (const kind of kinds) {
    sent[kind].push(now);
  }
  if (kinds.length) {
    save();
  }
}

function prune(now: number): void {
  sent = load();
  for (const kind of Object.keys(sent) as BudgetKind[]) {
    sent[kind] = sent[kind].filter((t) => now - t < WINDOW_MS);
  }
}

// Waits until `need` more requests of each kind fit in the window.
export async function reserve(need: Partial<Record<BudgetKind, number>>): Promise<void> {
  for (;;) {
    const now = Date.now();
    prune(now);
    let wait = 0;
    for (const [kind, count] of Object.entries(need) as [BudgetKind, number][]) {
      const over = sent[kind].length + count - LIMITS[kind];
      if (over > 0) {
        wait = Math.max(wait, sent[kind][over - 1] + WINDOW_MS - now);
      }
    }
    if (wait <= 0) {
      return;
    }
    await sleep(wait + 50);
  }
}

// Waits until no request of this kind was sent in the last window (for the rate-limit tests).
export async function waitForQuietWindow(kind: BudgetKind): Promise<void> {
  prune(Date.now());
  const last = sent[kind][sent[kind].length - 1];
  if (last !== undefined) {
    await sleep(last + WINDOW_MS - Date.now() + 50);
  }
}
