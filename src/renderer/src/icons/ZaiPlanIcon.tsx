type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const ZaiPlanIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="Z.ai"
    className={`flex items-center justify-center ${className || ''}`}
    style={{
      backgroundColor: 'rgb(0, 0, 0)',
      borderRadius: '50%',
      boxShadow: 'rgba(255, 255, 255, 0.1) 0px 0px 0px 1px inset',
      color: 'rgb(255, 255, 255)',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <svg
      fill="currentColor"
      fillRule="evenodd"
      viewBox="0 0 24 24"
      width={width * 0.584}
      height={height * 0.584}
      xmlns="http://www.w3.org/2000/svg"
      style={{ flex: '0 0 auto', lineHeight: 1 }}
    >
      <title>Z.ai</title>
      <path d="M12.105 2L9.927 4.953H.653L2.83 2h9.276zM23.254 19.048L21.078 22h-9.242l2.174-2.952h9.244zM24 2L9.264 22H0L14.736 2H24z"></path>
    </svg>
  </div>
);
