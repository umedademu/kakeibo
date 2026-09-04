import type { Metadata } from "next";
import FixedCostManager from "../../components/fixed-cost-manager";

export const metadata: Metadata = {
  title: "固定費 | kakeibo",
  description: "毎月の固定費を登録・編集します。",
};

export default function FixedCostsPage() {
  return <FixedCostManager />;
}
