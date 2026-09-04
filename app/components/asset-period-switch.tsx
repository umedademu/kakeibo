"use client";

import Link from "next/link";
import { assetPeriodOptions, type AssetPeriodDays } from "../lib/asset-period";

type AssetPeriodButtonsProps = {
  days: AssetPeriodDays;
  label: string;
  onChange: (days: AssetPeriodDays) => void;
};

type AssetPeriodLinksProps = {
  basePath: string;
  days: AssetPeriodDays;
  label: string;
};

export function AssetPeriodButtons({ days, label, onChange }: AssetPeriodButtonsProps) {
  return (
    <div className="asset-period-switch" role="group" aria-label={label}>
      {assetPeriodOptions.map((option) => (
        <button
          className={days === option ? "asset-period-option is-active" : "asset-period-option"}
          type="button"
          aria-pressed={days === option}
          key={option}
          onClick={() => onChange(option)}
        >
          {option}日
        </button>
      ))}
    </div>
  );
}

export function AssetPeriodLinks({ basePath, days, label }: AssetPeriodLinksProps) {
  return (
    <div className="asset-period-switch" role="group" aria-label={label}>
      {assetPeriodOptions.map((option) => (
        <Link
          className={days === option ? "asset-period-option is-active" : "asset-period-option"}
          href={`${basePath}?days=${option}`}
          aria-current={days === option ? "page" : undefined}
          key={option}
        >
          {option}日
        </Link>
      ))}
    </div>
  );
}
