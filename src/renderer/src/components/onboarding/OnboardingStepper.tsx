import { HiCheck } from 'react-icons/hi';
import clsx from 'clsx';

type Step = {
  title: string;
};

type Props = {
  steps: Step[];
  currentStep: number;
};

export const OnboardingStepper = ({ steps, currentStep }: Props) => {
  return (
    <div className="flex items-start justify-between w-full max-w-2xl mx-auto">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        const isFuture = stepNumber > currentStep;

        return (
          <div key={index} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors', {
                  'bg-info text-text-primary': isCurrent,
                  'bg-success text-text-primary': isCompleted,
                  'bg-bg-tertiary text-text-muted-light': isFuture,
                })}
              >
                {isCompleted ? <HiCheck className="w-4 h-4" /> : <span>{stepNumber}</span>}
              </div>

              {/* Step Title */}
              <span
                className={clsx('mt-2 text-xs font-medium text-center max-w-20', {
                  'text-info-lighter': isCurrent,
                  'text-success-light': isCompleted,
                  'text-text-muted': isFuture,
                })}
              >
                {step.title}
              </span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={clsx('flex-1 h-0.5 mx-4 transition-colors', {
                  'bg-success': stepNumber < currentStep,
                  'bg-bg-tertiary': stepNumber >= currentStep,
                })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
