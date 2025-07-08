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
                  'bg-blue-600 text-white': isCurrent,
                  'bg-green-600 text-white': isCompleted,
                  'bg-neutral-700 text-neutral-400': isFuture,
                })}
              >
                {isCompleted ? <HiCheck className="w-4 h-4" /> : <span>{stepNumber}</span>}
              </div>

              {/* Step Title */}
              <span
                className={clsx('mt-2 text-xs font-medium text-center max-w-20', {
                  'text-blue-400': isCurrent,
                  'text-green-400': isCompleted,
                  'text-neutral-500': isFuture,
                })}
              >
                {step.title}
              </span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={clsx('flex-1 h-0.5 mx-4 transition-colors', {
                  'bg-green-600': stepNumber < currentStep,
                  'bg-neutral-700': stepNumber >= currentStep,
                })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
