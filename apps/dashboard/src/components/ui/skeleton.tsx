import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-muted relative overflow-hidden',
        'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:animate-shimmer before:bg-[length:200%_100%]',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
