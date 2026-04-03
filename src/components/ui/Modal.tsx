import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThemeConfig {
  cardBg: string; cardBorder: string; textPrimary: string; textMuted: string; accent?: string;
}
interface ModalProps {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; wide?: boolean; className?: string;
  actions?: React.ReactNode; tc?: ThemeConfig | null;
}

export function Modal({ open, onClose, title, children, wide, className, actions, tc }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15}}
          onClick={e => e.target === e.currentTarget && onClose()}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={onClose} />
          <motion.div
            className={cn('relative rounded-3xl p-5 shadow-2xl z-10 max-h-[88vh] flex flex-col overflow-hidden',
              wide ? 'w-[580px]' : 'w-[360px]',
              !tc && 'bg-white dark:bg-[#1c1c1e]',
              className)}
            style={tc ? { background: tc.cardBg, borderColor: tc.cardBorder, border: `1px solid ${tc.cardBorder}`, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } : undefined}
            initial={{opacity:0,scale:0.95,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:8}}
            transition={{duration:0.18,ease:[0.34,1.56,0.64,1]}}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold tracking-[0.14em]"
                  style={tc?{color:tc.textMuted}:{}}
                ><span className={!tc?'text-black/30 dark:text-white/30':''}>{title}</span></span>
                {actions}
              </div>
              <button onClick={onClose}
                style={tc?{background:'rgba(255,255,255,0.10)',color:tc.textMuted}:undefined}
                className={cn('w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                  !tc&&'bg-black/05 dark:bg-white/08 text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/15')}>
                <X size={12}/>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
