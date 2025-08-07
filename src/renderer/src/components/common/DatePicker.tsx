import { forwardRef, ReactNode } from 'react';
import ReactDatePicker, { type DatePickerProps } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaCalendarAlt } from 'react-icons/fa';
import clsx from 'clsx';

import { Input } from './Input';

import './DatePicker.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomInput = forwardRef<HTMLInputElement, any>((props, ref) => {
  return <Input {...props} ref={ref} />;
});

CustomInput.displayName = 'CustomInput';

type Props = DatePickerProps & {
  label?: ReactNode;
};

export const DatePicker = ({ label, className, ...props }: Props) => {
  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      <ReactDatePicker
        className={clsx('min-h-[40px]', className)}
        {...props}
        showIcon
        icon={<FaCalendarAlt className="absolute top-1/2 -translate-y-1/2 left-0 text-text-secondary" />}
        customInput={<CustomInput />}
      />
    </div>
  );
};
