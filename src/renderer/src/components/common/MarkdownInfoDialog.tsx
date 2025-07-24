import ReactMarkdown from 'react-markdown';

import { BaseDialog } from '@/components/common/BaseDialog';

type Props = {
  title: string;
  text: string;
  onClose: () => void;
};

export const MarkdownInfoDialog = ({ title, text, onClose }: Props) => {
  return (
    <BaseDialog title={title} onClose={onClose} width={640} closeOnEscape={true}>
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </BaseDialog>
  );
};
