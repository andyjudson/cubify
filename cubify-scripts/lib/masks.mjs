// Mask orbit strings — keyed by method + optional mask field value from JSON
export const MASKS = {
  default:      'EDGES:------------,CORNERS:--------,CENTERS:------',  // all pieces visible — no masking
  cross_white:  'EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------',  // U-layer edges shown (placement); all corners hidden
  cross_yellow: 'EDGES:IIIIOOOOIIII,CORNERS:IIIIIIII,CENTERS:------',  // D-layer edge orientation stickers (O) only; all corners hidden
  f2l:          'EDGES:----IIII----,CORNERS:----IIII,CENTERS:-----I',  // U+middle edges + U corners shown; D edges+corners hidden; B center hidden
  oll_1look:    'EDGES:----OOOO----,CORNERS:----OOOO,CENTERS:------',  // D-layer edge+corner orientation (O); U+middle pieces fully shown
  oll_2look:    'EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------',  // D-layer edge orientation only; D corners hidden
  pll_1look:    'EDGES:------------,CORNERS:--------,CENTERS:------',  // all pieces visible — full colour for permutation recognition
  pll_2look:    'EDGES:----OOOO----,CORNERS:--------,CENTERS:------',  // D-layer edge orientation only; all corners fully shown
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
  if (method === 'cross') return MASKS.cross_white;
  return MASKS.default;
}
