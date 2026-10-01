export const assetPeriodOptions = [30, 90, 180, 360] as const;

export type AssetPeriodDays = (typeof assetPeriodOptions)[number];

export function parseAssetPeriod(value: string | null | undefined): AssetPeriodDays {
  return assetPeriodOptions.find((days) => value === String(days)) ?? 30;
}
