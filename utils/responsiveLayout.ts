export const CONTENT_MAX_WIDTH = 960;
export const FORM_MAX_WIDTH = 720;

export function getResponsiveLayout(width: number, height: number, fontScale = 1) {
  const isCompactHeight = height < 500;
  const isLandscape = width > height;
  const hasTwoColumns = Math.min(width, CONTENT_MAX_WIDTH) >= 760 * Math.max(1, fontScale);

  return {
    isCompactHeight,
    isLandscape,
    hasTwoColumns,
    hasDaySidebar: isLandscape && width >= 640 && fontScale <= 1.3,
    daySidebarWidth: width >= 1000 ? 300 : 240,
  };
}

/** Both the day headings and the time grid must use the same safe-area width. */
export function getWeekLayout(width: number, height: number, dayCount: number, fontScale = 1) {
  const isExpanded = width >= 600;
  const timeColumnWidth = isExpanded ? 44 : 30;
  const gridWidth = Math.max(0, width - timeColumnWidth - 16);
  const dayColumnWidth = gridWidth / Math.max(1, dayCount);
  const hasDetailedCards = dayColumnWidth >= 100 * Math.max(1, fontScale);

  return {
    timeColumnWidth,
    gridWidth,
    dayColumnWidth,
    hasDetailedCards,
    // Preserve the phone timetable density; tall tablets can show more of each subject.
    hourHeight: hasDetailedCards && height >= 700 ? 80 : 65,
  };
}
