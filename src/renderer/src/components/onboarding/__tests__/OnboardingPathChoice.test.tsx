import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OnboardingPathChoice } from '../OnboardingPathChoice';

describe('OnboardingPathChoice', () => {
  const mockOnSelectPath = vi.fn();

  const defaultProps = {
    selectedPath: null,
    onSelectPath: mockOnSelectPath,
  };

  const getCard = (titleKey: string) => screen.getByText(titleKey).closest('button') as HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render both path options', () => {
    render(<OnboardingPathChoice {...defaultProps} />);

    expect(screen.getByText('onboarding.choice.agent.title')).toBeInTheDocument();
    expect(screen.getByText('onboarding.choice.aider.title')).toBeInTheDocument();
  });

  it('should render the title and description', () => {
    render(<OnboardingPathChoice {...defaultProps} />);

    expect(screen.getByText('onboarding.choice.title')).toBeInTheDocument();
    expect(screen.getByText('onboarding.choice.description')).toBeInTheDocument();
  });

  it('should show the recommended badge only on the agent option', () => {
    render(<OnboardingPathChoice {...defaultProps} />);

    expect(screen.getAllByText('onboarding.choice.recommended')).toHaveLength(1);
    expect(getCard('onboarding.choice.agent.title')).toContainElement(screen.getByText('onboarding.choice.recommended'));
  });

  it('should display the default mode label for each path', () => {
    render(<OnboardingPathChoice {...defaultProps} />);

    expect(screen.getByText('onboarding.choice.agent.modeLabel')).toBeInTheDocument();
    expect(screen.getByText('onboarding.choice.aider.modeLabel')).toBeInTheDocument();
  });

  it('should call onSelectPath with agent when the agent card is clicked', () => {
    render(<OnboardingPathChoice {...defaultProps} />);

    fireEvent.click(getCard('onboarding.choice.agent.title'));

    expect(mockOnSelectPath).toHaveBeenCalledTimes(1);
    expect(mockOnSelectPath).toHaveBeenCalledWith('agent');
  });

  it('should call onSelectPath with aider when the aider card is clicked', () => {
    render(<OnboardingPathChoice {...defaultProps} />);

    fireEvent.click(getCard('onboarding.choice.aider.title'));

    expect(mockOnSelectPath).toHaveBeenCalledTimes(1);
    expect(mockOnSelectPath).toHaveBeenCalledWith('aider');
  });

  it('should highlight the selected path', () => {
    render(<OnboardingPathChoice {...defaultProps} selectedPath="agent" />);

    expect(getCard('onboarding.choice.agent.title')).toHaveClass('border-info-light-emphasis');
    expect(getCard('onboarding.choice.aider.title')).not.toHaveClass('border-info-light-emphasis');
  });

  it('should not highlight any path when nothing is selected', () => {
    render(<OnboardingPathChoice {...defaultProps} />);

    expect(getCard('onboarding.choice.agent.title')).not.toHaveClass('border-info-light-emphasis');
    expect(getCard('onboarding.choice.aider.title')).not.toHaveClass('border-info-light-emphasis');
  });
});
