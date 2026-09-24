import { db } from './api';
export type Totals = { visits: number; projectViews: number; downloadClicks: number; since: string | null };
let memorySession = '';
const recorded = new Set<string>();
export async function recordActivity(event: 'visit' | 'project' | 'download', target = '') {
  if (!db || ['localhost', '127.0.0.1'].includes(location.hostname) || location.hash.startsWith('#/admin') || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  let session = memorySession;
  try {
    session = sessionStorage.getItem('stash-visit') || session;
    if (!session) session = crypto.randomUUID();
    sessionStorage.setItem('stash-visit', session);
  } catch { session ||= crypto.randomUUID(); }
  memorySession = session;
  const key = new Date().toISOString().slice(0, 10) + event + target;
  if (recorded.has(key)) return;
  recorded.add(key);
  try {
    const { error } = await db.rpc('record_activity', { session_id: session, event, target });
    if (error) recorded.delete(key);
  } catch { recorded.delete(key); }
}
