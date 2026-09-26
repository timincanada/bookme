import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "type-action inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-forest text-on-forest hover:bg-forest-hover shadow-soft",
        secondary:
          "bg-sage-3 text-forest hover:bg-sage",
        outline:
          "border border-line bg-card text-ink hover:bg-paper-2",
        ghost: "text-ink hover:bg-paper-2",
        link: "text-forest underline-offset-4 hover:underline font-medium px-0",
      },
      size: {
        sm: "h-9 px-3.5 text-sm rounded-full",
        md: "h-11 px-5 text-sm rounded-full",
        lg: "h-12 px-6 text-base rounded-full",
        xl: "h-14 px-7 text-base rounded-full",
        field: "h-12 px-5 text-base rounded-xl w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
