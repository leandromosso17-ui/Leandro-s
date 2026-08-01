/**
 * Medimo data access layer.
 *
 * `schema.ts`   row + enum types, mirroring the Postgres schema 1:1
 * `mappers.ts`  row <-> app type translation (lib/types.ts)
 * `queries.ts`  product-shaped queries and writes (dashboard, senior, scan, refills)
 *
 * Screens should import from here, never build raw queries inline.
 */
export * from './mappers';
export * from './queries';
export * from './schema';
