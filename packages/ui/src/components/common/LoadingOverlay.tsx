import { AnimatePresence, motion } from 'framer-motion';
import { CgSpinner } from 'react-icons/cg';
import { clsx } from 'clsx';

type Props = {
  message: string;
  spinnerSize?: 'sm' | 'md' | 'lg';
  animateOpacity?: boolean;
};

export const LoadingOverlay = ({ message, spinnerSize = 'md', animateOpacity = false }: Props) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  if (animateOpacity) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-bg-primary to-bg-primary-light z-40"
        >
          <CgSpinner className={clsx('animate-spin', sizeClasses[spinnerSize])} />
          <div className="mt-2 text-xs text-center text-text-primary">{message}</div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-bg-primary to-bg-primary-light z-40">
      <CgSpinner className={clsx('animate-spin', sizeClasses[spinnerSize])} />
      <div className="mt-2 text-xs text-center text-text-primary">{message}</div>
    </div>
  );
};
