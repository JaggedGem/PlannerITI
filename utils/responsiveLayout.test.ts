import { getResponsiveLayout, getWeekLayout } from './responsiveLayout';

describe('responsive schedule geometry', () => {
  it.each([
    [320, 568],
    [390, 844],
    [756, 390],
    [768, 1024],
    [1024, 768],
    [834, 1194],
    [1194, 834],
    [1366, 1024],
  ])('fits every weekday and recovery day in a %i by %i safe area', (width, height) => {
    for (const dayCount of [5, 6, 7]) {
      const layout = getWeekLayout(width, height, dayCount);
      const lastDayRight = layout.timeColumnWidth + dayCount * layout.dayColumnWidth;
      expect(lastDayRight + 16).toBeCloseTo(width);
      expect(layout.dayColumnWidth).toBeGreaterThan(0);
      expect(layout.gridWidth).toBeCloseTo(dayCount * layout.dayColumnWidth);
    }
  });

  it('keeps phone portrait density and increases detail on tall tablets', () => {
    expect(getWeekLayout(390, 844, 5)).toMatchObject({
      hourHeight: 65,
      hasDetailedCards: false,
    });
    expect(getWeekLayout(834, 1194, 7)).toMatchObject({
      hourHeight: 80,
      hasDetailedCards: true,
    });
    expect(getWeekLayout(756, 390, 5).hourHeight).toBe(65);
  });

  it('keeps portrait stacked and moves the date picker aside in landscape', () => {
    expect(getResponsiveLayout(390, 844).hasDaySidebar).toBe(false);
    expect(getResponsiveLayout(834, 1194).hasDaySidebar).toBe(false);
    expect(getResponsiveLayout(667, 375).hasDaySidebar).toBe(true);
    expect(getResponsiveLayout(756, 390).hasDaySidebar).toBe(true);
    expect(getResponsiveLayout(1194, 834).daySidebarWidth).toBe(300);
    expect(getResponsiveLayout(600, 390).hasDaySidebar).toBe(false);
  });

  it('falls back to one column for large text within the bounded page', () => {
    expect(getResponsiveLayout(834, 1194).hasTwoColumns).toBe(true);
    expect(getResponsiveLayout(834, 1194, 1.2).hasTwoColumns).toBe(false);
    expect(getResponsiveLayout(1366, 1024, 1.5)).toMatchObject({
      hasDaySidebar: false,
      hasTwoColumns: false,
    });
    expect(getWeekLayout(756, 390, 7, 1.5).hasDetailedCards).toBe(false);
  });
});
