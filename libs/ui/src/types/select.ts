/**
 * A single option passed to VSelect.
 * vue-multiselect accepts any object — the `label` and `trackBy` props on
 * VSelect specify which fields to use for display and identity respectively.
 *
 * Consumers can intersect this type to add their own fields:
 *   type CountryOption = SelectOption & { code: string; flag: string }
 */
export type SelectOption = Record<string, unknown>;
