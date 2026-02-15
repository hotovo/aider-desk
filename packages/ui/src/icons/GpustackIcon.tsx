import gpustackIcon from './gpustack.png';

type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const GpustackIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="GPUStack"
    className={`flex items-center justify-center rounded-md ${className || ''}`}
    style={{
      backgroundColor: 'white',
      boxShadow: 'rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset',
      color: 'rgb(255, 255, 255)',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <img src={gpustackIcon} width={width} height={height} className={className} alt="GPUStack" />
  </div>
);
