import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
        default: "border-transparent bg-zinc-950 text-white",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
        outline: "border-zinc-200 text-zinc-700",
        red: "border-red-200 bg-red-50 text-red-700",
        violet: "border-violet-200 bg-violet-50 text-violet-800",
        zinc: "border-zinc-200 bg-zinc-100 text-zinc-700",
      },
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} data-slot="badge" {...props} />;
}

export { Badge, badgeVariants };
