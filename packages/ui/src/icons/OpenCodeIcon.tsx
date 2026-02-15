type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const OpenCodeIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="OpenCode ZEN"
    className={`flex items-center justify-center rounded-md ${className || ''}`}
    style={{
      backgroundColor: '#131010',
      color: 'rgb(255, 255, 255)',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <svg width={width * 0.95} height={height * 0.95} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M320 224V352H192V224H320Z" fill="#5A5858"></path>
      <path fillRule="evenodd" clipRule="evenodd" d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z" fill="white"></path>
    </svg>
  </div>
);
