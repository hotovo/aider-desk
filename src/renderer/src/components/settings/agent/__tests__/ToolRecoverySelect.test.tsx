import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolRecoveryMode } from '@common/types';

import { ToolRecoverySelect } from '../ToolRecoverySelect';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('ToolRecoverySelect', () => {
  it('offers all policies and reports the selected recovery mode', () => {
    const onChange = vi.fn();
    render(<ToolRecoverySelect value={ToolRecoveryMode.Forget} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'tool.recovery.forget' }));
    expect(screen.getByText('tool.recovery.notify')).toBeInTheDocument();
    fireEvent.click(screen.getByText('tool.recovery.safe'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(ToolRecoveryMode.Safe);
  });

  it('displays the current policy', () => {
    render(<ToolRecoverySelect value={ToolRecoveryMode.Notify} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'tool.recovery.notify' })).toBeInTheDocument();
  });
});
