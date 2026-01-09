type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const LitellmIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="LiteLLM"
    className={`flex items-center justify-center rounded-md ${className || ''}`}
    style={{
      backgroundColor: 'rgb(255, 255, 255)',
      boxShadow: 'rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset',
      color: 'rgb(0, 0, 0)',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <div style={{ fontSize: `${width * 0.6}px`, lineHeight: 1 }}>🚅</div>
  </div>
);
