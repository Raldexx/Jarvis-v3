import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
  actions?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, wide, className, actions }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/25 backdrop-blur-md" onClick={onClose} />

          {/* Box */}
          <motion.div
            className={cn(
              'relative bg-white dark:bg-[#1c1c1e] rounded-3xl p-5 shadow-2xl z-10',
              wide ? 'w-[560px]' : 'w-[340px]',
              'max-h-[85vh] flex flex-col',
              className
            )}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold tracking-[0.14em] text-black/30 dark:text-white/30">
                  {title}
                </span>
                {actions}
              </div>
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-full bg-black/05 dark:bg-white/08 flex items-center justify-center text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 min-h-0">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
