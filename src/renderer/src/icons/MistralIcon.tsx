type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const MistralIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="Mistral"
    className={`flex items-center justify-center rounded-full ${className || ''}`}
    style={{
      backgroundColor: 'rgb(250, 82, 15)',
      color: 'rgb(255, 255, 255)',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" width={width * 0.75} height={height * 0.75} xmlns="http://www.w3.org/2000/svg">
      <title>Mistral</title>
      <path
        d="M3.428 3.4h3.429v3.428h3.429v3.429h-.002 3.431V6.828h3.427V3.4h3.43v13.714H24v3.429H13.714v-3.428h-3.428v-3.429h-3.43v3.428h3.43v3.429H0v-3.429h3.428V3.4zm10.286 13.715h3.428v-3.429h-3.427v3.429z"
        clipRule="evenodd"
      />
    </svg>
  </div>
);
