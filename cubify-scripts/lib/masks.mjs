// Mask orbit strings — keyed by method + optional mask field value from JSON
export const MASKS = {
  default:     'EDGES:------------,CORNERS:--------,CENTERS:------',
  cross:       'EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------',
  f2l:         'EDGES:----IIII----,CORNERS:----IIII,CENTERS:-----I',
  oll_1look:   'EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------', // 1-look OLL: show all top edges + corners
  oll_2look:   'EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------', // 2-look OLL edge stage: hide corners
  pll_1look:   'EDGES:------------,CORNERS:--------,CENTERS:------', // 1-look PLL: show everything (same as default)
  pll_2look:   'EDGES:----OOOO----,CORNERS:--------,CENTERS:------', // 2-look PLL corner stage: hide top edges
};

// Resolve orbit string from case method + explicit mask field value (from JSON)
// OLL masking rule:
//   no mask field (default) → 1-look: show all top edges + corners
//   mask: 'edge'            → 2-look edge stage: hide corners so only edge orientation is shown
// PLL masking rule:
//   no mask field (default) → 1-look: show everything
//   mask: 'corner'          → 2-look corner stage: hide top edges so only corner permutation is shown
export function maskForCase(method, mask) {
  if (method === 'oll') {
    return mask === 'edge' ? MASKS.oll_2look : MASKS.oll_1look;
  }
  if (method === 'pll') {
    return mask === 'corner' ? MASKS.pll_2look : MASKS.pll_1look;
  }
  if (method === 'f2l') return MASKS.f2l;
  if (method === 'cross') return MASKS.cross;
  return MASKS.default;
}
