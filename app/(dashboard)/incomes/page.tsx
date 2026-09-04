import type { Metadata } from "next";
import FixedCostManager from "../../components/fixed-cost-manager";

export const metadata: Metadata = {
  title: "収入 | kakeibo",
  description: "毎月の収入を登録・編集します。",
};

export default function IncomesPage() {
  return <FixedCostManager kind="incomes" />;
}
