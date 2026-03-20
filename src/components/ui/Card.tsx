import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  clickable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover, clickable, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-3.5',
        hover && 'transition-all duration-150',
        clickable && 'cursor-pointer hover:-translate-y-px hover:shadow-md active:scale-[0.99]',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const SectionLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('text-[9px] font-bold tracking-[0.12em] uppercase text-black/30 dark:text-white/30 mb-3', className)}>
    {children}
  </div>
);
