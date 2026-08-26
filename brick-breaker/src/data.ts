export type BlockRow = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const LAYOUT = {
  marginTop: 0.05, // 5% space at the top for UI
  marginLeft: 0.02, // 2% padding on the left
  marginRight: 0.02, // 2% padding on the right
  gap: 0.01, // 1% gap between blocks
  rowHeight: 0.05, // Each row is 5% of the screen height
};

// 0 = Empty
// 1 = Normal
// 2 = Drop Status
// 3 = Strong Strong
// 4 = Indestructible
export const level1: BlockRow[] = [
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], // Row 1: Wall of Indestructible
  [1, 1, 3, 3, 1, 1, 3, 3, 1, 1], // Row 2: Gaps
  [1, 2, 1, 1, 2, 1, 1, 2, 1, 1], // Row 3: Mixed with drops (2)
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 4: Full normal
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0], // Row 5: Pattern
];
