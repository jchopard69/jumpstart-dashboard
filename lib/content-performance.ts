import { median, reviewPostViews, type ReviewPost } from './monthly-review';

export type ContentPerformance = {
  kind: 'top' | 'low' | 'typical' | 'recent' | 'insufficient' | 'missing';
  baseline: number | null;
  difference: number | null;
  peers: number;
};

/** Compare measured views within one account and format; no reach/views substitution. */
export function assessContentPerformance(posts: ReviewPost[], now = Date.now()): Map<string, ContentPerformance> {
  const mature = (post: ReviewPost) => Number.isFinite(Date.parse(post.date)) && now - Date.parse(post.date) >= 7 * 86400000;
  const groups = new Map<string, ReviewPost[]>();
  const key = (p: ReviewPost) => `${p.platform}:${p.accountId}:${p.format}`;
  for (const post of posts) {
    if (post.accountId && mature(post) && reviewPostViews(post) != null) groups.set(key(post), [...(groups.get(key(post)) ?? []), post]);
  }
  return new Map(posts.map((post): [string, ContentPerformance] => {
    const views = reviewPostViews(post);
    const peers = (groups.get(key(post)) ?? []).filter(peer => peer.id !== post.id);
    const empty = { baseline: null, difference: null, peers: peers.length };
    if (views == null) return [post.id, { ...empty, kind: 'missing' }];
    if (!Number.isFinite(Date.parse(post.date))) return [post.id, { ...empty, kind: 'insufficient' }];
    if (!mature(post)) return [post.id, { ...empty, kind: 'recent' }];
    if (!post.accountId || peers.length < 3) return [post.id, { ...empty, kind: 'insufficient' }];
    const baseline = median(peers.map(peer => reviewPostViews(peer)!))!;
    if (baseline <= 0) return [post.id, { ...empty, baseline, kind: 'insufficient' }];
    const difference = (views / baseline - 1) * 100;
    const kind = difference >= 50 ? 'top' : difference <= -33 ? 'low' : 'typical';
    return [post.id, { kind, baseline, difference, peers: peers.length }];
  }));
}
