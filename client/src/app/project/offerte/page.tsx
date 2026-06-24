import { Suspense } from "react";
import { OffertePrint } from "@/components/offerte-print";

export default function OffertePage() {
  return (
    <Suspense>
      <OffertePrint />
    </Suspense>
  );
}
