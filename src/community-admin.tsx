import { useEffect, useState } from 'react';
import { db, query, setSettings } from './api';
import { Field } from './ui';
import { Metrics } from './community';
import type { Settings, Review } from './types';
import type { Totals } from './activity';

type Activity = { totals: Totals; days: {day: string; visits: number; project_views: number; download_clicks: number}[] };
export function CommunityAdmin({ settings, onSaved }: { settings: Settings; onSaved: () => Promise<void> }) {
  const [reviews, setReviews] = useState<Review[]>(settings.reviews || []);
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityError, setActivityError] = useState(false);
  useEffect(() => { void query(db!.rpc('owner_activity')).then(setActivity).catch(() => setActivityError(true)); }, []);
  useEffect(() => { window.dispatchEvent(new CustomEvent('stash-dirty', {detail: dirty})); return () => { window.dispatchEvent(new CustomEvent('stash-dirty', {detail: false})); }; }, [dirty]);
  useEffect(() => { const stop = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue=''; } }; window.addEventListener('beforeunload', stop); return () => window.removeEventListener('beforeunload', stop); }, [dirty]);
  function change(next: Review[]) { setReviews(next); setDirty(true); setMessage(''); }
  function update(id: string, patch: Partial<Review>) { change(reviews.map(r => r.id === id ? {...r, ...patch} : r)); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const clean = reviews.map(r => ({...r, name:r.name.trim(), product:r.product.trim(), text:r.text.trim()}));
      if (clean.some(r => !r.name || !r.product || !r.text || !Number.isInteger(r.rating) || r.rating<1 || r.rating>5)) throw Error('Complete every review before publishing.');
      // Fetch current settings to preserve edits made in another dashboard tab.
      const latest = await query(db!.from('site_settings').select('content').eq('id',1).single());
      await setSettings({...latest.content, reviews:clean});
      setReviews(clean); setDirty(false); await onSaved(); setMessage('Reviews published to the homepage.');
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Could not save reviews.'); }
    finally { setBusy(false); }
  }
  return <div className="stack">
    <section className="panel"><h2>Activity</h2><Metrics totals={activity?.totals || null} reviews={(settings.reviews || []).length}/><p className="muted">Session-based estimates since tracking began. Download clicks are not completed downloads or sales. Purchases will remain hidden until a checkout can verify them. Privacy opt-outs are respected.</p>{activityError && <p role="status">Activity is temporarily unavailable. Reopen this section to retry.</p>}{activity?.days.length ? <div className="activity-table"><table><caption>Last 30 days · UTC · days with activity</caption><thead><tr><th>Date</th><th>Visits</th><th>Project views</th><th>Download clicks</th></tr></thead><tbody>{activity.days.map(d=><tr key={d.day}><td>{d.day}</td><td>{d.visits}</td><td>{d.project_views}</td><td>{d.download_clicks}</td></tr>)}</tbody></table></div> : <p>No activity recorded yet.</p>}</section>
    <form className="panel stack" onSubmit={save}><h2>Customer reviews</h2><p className="muted">Add real feedback you have permission to share. Use the customer’s chosen display name and the item they reviewed. Reviews are public after you publish; no verified-purchase badge is added.</p>
    {reviews.map((r,i)=><fieldset className="review-edit" key={r.id} disabled={busy}><legend>Review {i+1}</legend><Field label="Customer display name"><input required maxLength={80} value={r.name} onChange={e=>update(r.id,{name:e.target.value})}/></Field><Field label="Map or plugin reviewed"><input required maxLength={160} value={r.product} onChange={e=>update(r.id,{product:e.target.value})}/></Field><Field label="Customer’s rating"><select value={r.rating} onChange={e=>update(r.id,{rating:Number(e.target.value)})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} {n===1?'star':'stars'}</option>)}</select></Field><Field label="Customer’s review"><textarea required maxLength={2000} rows={4} value={r.text} onChange={e=>update(r.id,{text:e.target.value})}/></Field><button type="button" onClick={()=>change(reviews.filter(x=>x.id!==r.id))}>Remove from list</button></fieldset>)}
    <div className="actions"><button type="button" disabled={busy || reviews.length>=30} onClick={()=>change([...reviews,{id:crypto.randomUUID(),name:'',product:'',text:'',rating:5}])}>Add customer review</button><button className="primary" disabled={busy || !dirty}>{busy?'Publishing…':'Publish reviews'}</button></div>{message && <p role="status">{message}</p>}</form>
  </div>;
}
