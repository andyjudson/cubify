// Mask preset constants — ported from cubify-app/src/utils/maskPresets.ts
export const MASKS = {
  default: 'EDGES:------------,CORNERS:--------,CENTERS:------',
  cross:   'EDGES:----IIIIIIII,CORNERS:IIIIIIII,CENTERS:------',
  f2l:     'EDGES:----IIII----,CORNERS:----IIII,CENTERS:------',
  oll:     'EDGES:----OOOO----,CORNERS:----IIII,CENTERS:------',
  pll:     'EDGES:----OOOO----,CORNERS:--------,CENTERS:------',
};

// Infer mask from case type
export function maskForType(type) {
  return MASKS[type] ?? MASKS.default;
}
