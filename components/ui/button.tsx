import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:     "bg-amber-700 text-amber-100 hover:bg-amber-600 border border-amber-500",
        destructive: "bg-red-800 text-red-100 hover:bg-red-700 border border-red-600",
        outline:     "border border-stone-500 bg-stone-700 text-stone-200 hover:bg-stone-600",
        secondary:   "bg-stone-700 text-stone-200 hover:bg-stone-600 border border-stone-600",
        ghost:       "hover:bg-stone-700 text-stone-300 hover:text-stone-100",
        link:        "text-amber-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 rounded px-3 text-xs",
        lg:      "h-10 rounded px-8",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
