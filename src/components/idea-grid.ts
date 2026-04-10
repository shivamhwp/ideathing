export const IDEA_CARD_MIN_WIDTH_PX = 288;
export const NON_THEO_IDEA_CARD_MIN_WIDTH_PX = 240;
export const KANBAN_COMPACT_WIDTH_PX = 928;
export const KANBAN_COLUMN_GAP_PX = 12;
export const THEO_QUEUE_GAP_PX = 16;
export const IDEA_CARD_GRID_TEMPLATE = `repeat(auto-fit, minmax(min(100%, ${IDEA_CARD_MIN_WIDTH_PX}px), 1fr))`;
export const NON_THEO_IDEA_CARD_GRID_TEMPLATE = `repeat(auto-fit, minmax(min(100%, ${NON_THEO_IDEA_CARD_MIN_WIDTH_PX}px), ${NON_THEO_IDEA_CARD_MIN_WIDTH_PX}px))`;

export const getAutoFitColumnCount = (
  width: number,
  gap: number,
  itemWidth = IDEA_CARD_MIN_WIDTH_PX,
) => Math.max(1, Math.floor((width + gap) / (itemWidth + gap)));
