type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const AtlasCloudIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="Atlas Cloud"
    className={`flex items-center justify-center rounded-md ${className || ''}`}
    style={{
      backgroundColor: '#6366F1',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <svg viewBox="0 0 24 24" width={width * 0.6} height={height * 0.6} fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Atlas Cloud</title>
      <path
        d="M20.2,18.01L12,0.47,3.8,18.01l-2.58,5.52c1.62,-1.05,3.39,-1.86,5.26,-2.41,1.76,-0.51,3.61,-0.79,5.52,-0.79,0.98,0,1.95,0.08,2.9,0.22l-1.86,-4.3c-0.53,-0.1,-2.87,-0.1,-4.59,0.3l3.56,-8.28,5.52,12.85c0.01,0,0.02,0.01,0.03,0.01,1.86,0.55,3.62,1.36,5.23,2.4l-2.58,-5.52Z"
        fill="white"
      />
    </svg>
  </div>
);
