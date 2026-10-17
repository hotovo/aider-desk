import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { parseMessageContent } from '../utils';

vi.mock('@/components/common/CodeBlock', () => ({
  CodeBlock: ({ children }: { children: string }) => <pre data-testid="code-block">{children}</pre>,
}));

const renderMessage = (content: string, renderMarkdown = true) => render(<>{parseMessageContent('', content, [], renderMarkdown)}</>);

describe('LaTeX rendering in messages', () => {
  it('renders inline formulas with accessible MathML and surrounding text', () => {
    const { container } = renderMessage('The formula $E = mc^2$ is famous.');

    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(container.querySelector('math')).not.toBeNull();
    expect(container.querySelector('annotation')?.textContent).toBe('E = mc^2');
    expect(container.querySelector('.katex-display')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('The formula');
    expect(container).toHaveTextContent('is famous.');
  });

  it('renders multiline display formulas', () => {
    const { container } = renderMessage('Before\n\n$$\n\\frac{a}{b} + \\sqrt{c}\n$$\n\nAfter');

    expect(container.querySelector('.katex-display')).toBeInTheDocument();
    expect(container.querySelector('annotation')).toHaveTextContent('\\frac{a}{b} + \\sqrt{c}');
    expect(container).toHaveTextContent('Before');
    expect(container).toHaveTextContent('After');
  });

  it('leaves formulas in inline and fenced code untouched', () => {
    const { container, getByTestId } = renderMessage('Use `$x^2$` literally.\n\n```latex\n$$x^2$$\n```');

    expect(container.querySelector('.katex')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('$x^2$');
    expect(getByTestId('code-block')).toHaveTextContent('$$x^2$$');
  });

  it('preserves the original formulas when Markdown rendering is disabled', () => {
    const content = 'Inline $x^2$\n\n$$\n\\frac{a}{b}\n$$';
    const { container } = renderMessage(content, false);

    expect(container.querySelector('.katex')).not.toBeInTheDocument();
    expect(container.textContent).toBe(content);
  });

  it('shows invalid LaTeX without crashing or hiding the rest of the message', () => {
    const { container } = renderMessage('Before $\\frac{a}$ after.');

    expect(container.querySelector('.katex-error')).toBeInTheDocument();
    expect(container).toHaveTextContent('\\frac{a}');
    expect(container).toHaveTextContent('after.');
  });

  it('handles incomplete formulas during streaming', () => {
    const { container } = renderMessage('Still generating $\\frac{a}');

    expect(container).toHaveTextContent('Still generating $\\frac{a}');
    expect(container.querySelector('.katex')).not.toBeInTheDocument();
  });

  it('keeps escaped dollar signs and ordinary currency as text', () => {
    const { container } = renderMessage('The price is \\$5.00, not \\$10.00. A single price is $20.');

    expect(container.querySelector('.katex')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('The price is $5.00, not $10.00. A single price is $20.');
  });

  it('does not allow trusted HTML commands in formulas', () => {
    const { container } = renderMessage('$\\href{javascript:alert(1)}{click}$');

    expect(container.querySelector('a')).not.toBeInTheDocument();
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });

  it('renders formulas alongside existing GFM tables and formatting', () => {
    const { container } = renderMessage('**Formula**\n\n| Name | Value |\n| --- | --- |\n| Square | $x^2$ |');

    expect(container.querySelector('strong')).toHaveTextContent('Formula');
    expect(container.querySelector('table .katex')).toBeInTheDocument();
  });
});
