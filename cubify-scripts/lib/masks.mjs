// Mask orbit strings — keyed by method + optional mask field value from JSON
export const MASKS = {
  default:     'EDGES:------------,CORNERS:--------,CENTERS:------',
  cross:       'EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------',
  f2l:         'EDGES:----IIII----,CORNERS:----IIII,CENTERS:------',
  oll_edge:    'EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------', // cross not yet formed: hide top corners
  oll_corner:  'EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------', // cross formed: show top corners
  pll_corner:  'EDGES:----OOOO----,CORNERS:--------,CENTERS:------', // corner-swap PLL: highlight edges as reference
};

// Resolve orbit string from case method + explicit mask field value (from JSON)
// mask: 'edge' | 'corner' | undefined
export function maskForCase(method, mask) {
  if (method === 'oll') {
    return mask === 'edge' ? MASKS.oll_edge : MASKS.oll_corner;
  }
  if (method === 'pll') {
    return mask === 'corner' ? MASKS.pll_corner : MASKS.default;
  }
  if (method === 'f2l') return MASKS.f2l;
  if (method === 'cross') return MASKS.cross;
  return MASKS.default;
}
