export const assetPeriodOptions = [30, 90] as const;

export type AssetPeriodDays = (typeof assetPeriodOptions)[number];

export function parseAssetPeriod(value: string | null | undefined): AssetPeriodDays {
  return value === "90" ? 90 : 30;
}
