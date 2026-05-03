export function getMask(method, group, mask) {
  if (method === 'oll') {
    return mask === 'edge' ? 'oll-cross-dim' : 'oll-face-dim';
  }
  if (method === 'pll') {
    const g = (group ?? '').toLowerCase();
    if (mask === 'corner' || g.includes('corner')) return 'pll-corn-dim';
    if (g.includes('edge'))                        return 'pll-edge-dim';
    return 'pll-face-dim';
  }
  if (method === 'f2l')   return 'f2l-dim';
  if (method === 'cross') return 'cross-dim';
  return 'full';
}
