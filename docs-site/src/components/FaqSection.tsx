import { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDownIcon } from './Icons';
import styles from './FaqSection.module.css';

type FaqItem = {
  question: string;
  answer: string;
};

const FAQS: FaqItem[] = [
  {
    question: 'How does AiderDesk relate to Aider?',
    answer:
      'AiderDesk brings a visual desktop studio, multi-agent orchestration, Git worktree task isolation, a TypeScript extension system, and a headless REST/WebSocket server to Aider’s world-class code-editing foundation.',
  },
  {
    question: 'How do Git Worktrees prevent my code from breaking?',
    answer:
      'Each task executes in its own dedicated Git worktree directory on a separate branch. The agent can build, refactor, and run test suites without touching your active editor, working tree, or uncommitted files. You review changes and merge with one click.',
  },
  {
    question: 'Do I need a paid subscription or account?',
    answer:
      'No. AiderDesk is 100% free and open source. There are zero subscription tiers or token markups. You connect your own API keys (Anthropic, OpenAI, Gemini, etc.) directly or use local models via Ollama for free.',
  },
  {
    question: 'Can I run AiderDesk completely offline?',
    answer:
      'Yes. Point AiderDesk to a local model runner such as Ollama, LM Studio, or vLLM running on localhost. In local mode, zero telemetry or source code ever leaves your computer.',
  },
  {
    question: 'Can I use AiderDesk in headless mode or on remote servers?',
    answer:
      'Yes. Install globally with `npm i -g @aiderdesk/aiderdesk` and launch `aiderdesk`, or use our official Docker image `ghcr.io/magiksoft/aider-desk`. You can access the complete interface through your web browser or automate tasks over HTTP/WebSocket from CI/CD.',
  },
  {
    question: 'How does MCP (Model Context Protocol) work in AiderDesk?',
    answer:
      'AiderDesk functions both as an MCP client (connecting your agents to external database, search, and API tools) and as an MCP server (allowing Cursor, Claude Desktop, or custom IDEs to dispatch coding tasks to AiderDesk).',
  },
];

type Props = {
  className?: string;
};

export const FaqSection = ({ className }: Props) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className={clsx(styles.section, className)}>
      <div className={styles.header}>
        <div className={styles.sectionBadge}>Frequently Asked Questions</div>
        <h2 className={styles.heading}>Frequently Asked Questions</h2>
        <p className={styles.subheading}>
          Everything you need to know about AiderDesk architecture, pricing, and isolation.
        </p>
      </div>

      <div className={styles.faqList}>
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={faq.question}
              className={clsx(styles.faqItem, isOpen && styles.faqItemOpen)}
            >
              <button
                type="button"
                className={styles.questionButton}
                onClick={() => handleToggle(index)}
                aria-expanded={isOpen}
              >
                <span className={styles.questionText}>{faq.question}</span>
                <ChevronDownIcon
                  size={18}
                  className={clsx(styles.chevron, isOpen && styles.chevronRotated)}
                />
              </button>
              {isOpen && (
                <div className={styles.answerWrapper}>
                  <p className={styles.answerText}>{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
