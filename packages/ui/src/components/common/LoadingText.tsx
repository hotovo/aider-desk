import { ReactNode } from 'react';

import { useTypingAnimation } from '@/hooks/useTypingAnimation';

type Props = {
  label: string;
  typingSpeed?: number;
  pauseDuration?: number;
  icon?: ReactNode;
  className?: string;
};

export const LoadingText = ({ label, typingSpeed = 80, pauseDuration = 2000, icon, className = '' }: Props) => {
  const displayedText = useTypingAnimation(label, typingSpeed, pauseDuration);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {icon}
      <span className="text-text-secondary">{displayedText || <span>&nbsp;</span>}</span>
    </div>
  );
};
