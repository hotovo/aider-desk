import geminiCliIcon from './gemini-cli.png';

type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const GeminiCliIcon = ({ width = 64, height = 64, className }: Props) => (
  <img src={geminiCliIcon} width={width} height={height} className={className} alt="Gemini CLI" />
);
