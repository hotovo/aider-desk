import requestyIcon from './requesty.png';

type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const RequestyIcon = ({ width = 64, height = 64, className }: Props) => (
  <img src={requestyIcon} width={width} height={height} className={className} alt="Requesty" />
);
