import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground border-border',
        critical:
          'border-red-800 bg-red-950 text-red-400',
        high:
          'border-orange-800 bg-orange-950 text-orange-400',
        medium:
          'border-yellow-800 bg-yellow-950 text-yellow-400',
        low:
          'border-blue-800 bg-blue-950 text-blue-400',
        info:
          'border-zinc-700 bg-zinc-900 text-zinc-400',
        success:
          'border-green-800 bg-green-950 text-green-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
