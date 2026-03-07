type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const AnthropicCompatibleIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="Anthropic Compatible"
    className={`flex items-center justify-center rounded-full ${className || ''}`}
    style={{
      backgroundColor: 'rgb(100, 100, 125)',
      boxShadow: 'rgba(255, 255, 255, 0.1) 0px 0px 0px 1px inset',
      color: 'rgb(255, 255, 255)',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" width={width * 0.7} height={height * 0.7} xmlns="http://www.w3.org/2000/svg">
      <title>Anthropic</title>
      <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"></path>
    </svg>
  </div>
);
