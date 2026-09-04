import type { Metadata } from "next";
import FixedCostManager from "../../components/fixed-cost-manager";

export const metadata: Metadata = {
  title: "借金 | kakeibo",
  description: "借金を登録・編集します。",
};

export default function DebtsPage() {
  return <FixedCostManager kind="debts" />;
}
