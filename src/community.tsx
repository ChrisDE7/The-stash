import { useEffect, useState } from 'react';
import { Eye, Download, Star, MessageSquare, ArrowUpRight } from 'lucide-react';
import { db, query } from './api';
import type { Settings } from './types';
import type { Totals } from './activity';

export function Metrics({ totals, reviews }: { totals: Totals | null; reviews: number }) {
  return <div className="community-metrics">
    {[['Site visits', totals?.visits, Eye], ['Project views', totals?.projectViews, Eye], ['Download clicks', totals?.downloadClicks, Download], ['Reviews', reviews, MessageSquare]].map(([label, value, Icon]) => {
      const Symbol = Icon as typeof Eye;
      return <div className="community-metric" key={String(label)}><Symbol size={20} aria-hidden="true" /><strong>{typeof value === 'number' ? value.toLocaleString() : '—'}</strong><span>{String(label)}</span></div>;
    })}
  </div>;
}
export function Community({ settings }: { settings: Settings }) {
  const [totals, setTotals] = useState<Totals | null>(null);
  useEffect(() => {
    let active = true;
    const read = () => { if (db) void query(db.rpc('activity_totals')).then(v => { if (active) setTotals(v); }).catch(() => {}); };
    read();
    const timer = setInterval(read, 30000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const reviews = settings.reviews || [];
  const average = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : null;
  return <section className="community" aria-labelledby="community-title">
    <div className="section-heading"><div><span className="eyebrow">Around the stash</span><h2 id="community-title">Small details. Real feedback.</h2><p className="muted">A look at the activity and the people behind it.</p></div></div>
    <Metrics totals={totals} reviews={reviews.length} />
    <details className="count-note"><summary>About these counts</summary><p>Visits count browser sessions per UTC day, not unique people. Project views and download clicks count once per item per session each UTC day. Download clicks do not confirm completed downloads or purchases. Counts began with this feature and are estimates; blockers, privacy preferences, and automated traffic can affect them. A random session identifier is used for counting. No names or contact information are collected by this counter.</p></details>
    <div className="reviews-heading"><h3>Customer reviews</h3>{average && <span><Star size={16} aria-hidden="true" /> {average} / 5 · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>}</div>
    {reviews.length ? <><p className="muted">Customer feedback shared by Chris. Purchases are not independently verified.</p><div className="review-grid">{reviews.map(r => <article className="review-card" key={r.id}><div className="review-rating" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div><blockquote>{r.text}</blockquote><div className="review-person"><span className="review-avatar" aria-hidden="true">{r.name.slice(0,1).toUpperCase()}</span><div><strong>{r.name}</strong><span>Item: {r.product}</span></div></div></article>)}</div></> : <div className="reviews-empty"><MessageSquare size={28} aria-hidden="true" /><div><h3>The first story is still to come.</h3><p>Customer reviews will appear here as feedback comes in.</p></div><a className="button" href="#/about">Share your experience <ArrowUpRight size={16} /></a></div>}
  </section>;
}

