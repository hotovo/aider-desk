type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const OpenCodeGoIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="OpenCode Go"
    className={`flex items-center justify-center rounded-md ${className || ''}`}
    style={{
      backgroundColor: '#131010',
      color: 'rgb(255, 255, 255)',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <svg width={width * 0.75} height={width * 0.75 * (30 / 54)} viewBox="0 0 54 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 30H0V0H24V6H6V24H18V18H12V12H24V30Z" fill="currentColor"></path>
      <path d="M12 18H18V24H6V12H12V18Z" fill="currentColor" fillOpacity="0.2"></path>
      <path d="M48 12V24H36V12H48Z" fill="currentColor" fillOpacity="0.2"></path>
      <path d="M54 30H30V0H54V30ZM36 24H48V6H36V24Z" fill="currentColor"></path>
    </svg>
  </div>
);
