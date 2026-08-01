/**
 * Medimo palette as plain hex values.
 *
 * Use Uniwind `className` tokens (bg-ink, text-gold, ...) for styling.
 * These constants exist for native color props that cannot parse oklch:
 * navigation tints, StatusBar, lucide icon `color`, svg paint props.
 */
export const palette = {
  cadetGrey: '#93A3AE',
  karat: '#DFC684',
  goldenMean: '#C59E3A',
  indigoCloth: '#214D72',
  incrementalBlue: '#113253',
  cream: '#FAF7F1',
  white: '#FFFFFF',
  sage: '#4F8A6E',
  clay: '#A65A3C',
  inkTint: '#E3E9EF',
  cadetSoft: '#F1F3F5',
  goldTint: '#FAF3E1',
  sageTint: '#EEF6F1',
  clayTint: '#F8EEEA',
} as const;

export const statusColor = {
  upcoming: palette.cadetGrey,
  due: palette.incrementalBlue,
  taken: palette.sage,
  late: palette.goldenMean,
  missed: palette.clay,
  skipped: palette.cadetGrey,
} as const;

/** Tint pairs used by pill graphics so each medicine reads as a distinct object. */
export const pillColors = {
  blue: { body: '#2E5F8A', cap: '#1B4266', text: palette.white },
  gold: { body: '#DFC684', cap: '#C59E3A', text: '#4A3A12' },
  cream: { body: '#F6EFE2', cap: '#E4D6B8', text: '#5A4A25' },
  sage: { body: '#7FAF97', cap: '#4F8A6E', text: '#12301F' },
  slate: { body: '#B4C1CB', cap: '#93A3AE', text: '#22313C' },
  clay: { body: '#D79877', cap: '#A65A3C', text: '#3A1D11' },
} as const;

export type PillColorKey = keyof typeof pillColors;

export const pillColorKeys: PillColorKey[] = ['blue', 'gold', 'cream', 'sage', 'slate', 'clay'];
