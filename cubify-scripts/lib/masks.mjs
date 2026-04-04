// Mask orbit strings — keyed by method + optional mask field value from JSON
export const MASKS = {
  default:     'EDGES:------------,CORNERS:--------,CENTERS:------',
  cross:       'EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------',
  f2l:         'EDGES:----IIII----,CORNERS:----IIII,CENTERS:-----I',
  oll_1look:   'EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------', // 1-look OLL: show all top edges + corners
  oll_2look:   'EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------', // 2-look OLL edge stage: hide corners
  pll_corner:  'EDGES:----OOOO----,CORNERS:--------,CENTERS:------', // corner-swap PLL: highlight edges as reference
};

// Resolve orbit string from case method + explicit mask field value (from JSON)
// OLL masking rule:
//   no mask field (default) → 1-look: show all top edges + corners
//   mask: 'edge'            → 2-look edge stage: hide corners so only edge orientation is shown
export function maskForCase(method, mask) {
  if (method === 'oll') {
    return mask === 'edge' ? MASKS.oll_2look : MASKS.oll_1look;
  }
  if (method === 'pll') {
    return mask === 'corner' ? MASKS.pll_corner : MASKS.default;
  }
  if (method === 'f2l') return MASKS.f2l;
  if (method === 'cross') return MASKS.cross;
  return MASKS.default;
}
