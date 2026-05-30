import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-amber-700 text-amber-100 border border-amber-600",
        secondary:   "bg-stone-600 text-stone-200 border border-stone-500",
        destructive: "bg-red-800 text-red-100 border border-red-700",
        outline:     "border border-stone-500 text-stone-300",
        gold:        "bg-amber-900 text-amber-200 border border-amber-700",
        attention:   "bg-purple-900 text-purple-200 border border-purple-700",
        threat:      "bg-red-900 text-red-200 border border-red-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
