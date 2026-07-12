type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const ClinePassIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="ClinePass"
    className={`flex items-center justify-center rounded-full ${className || ''}`}
    style={{
      background: '#353d45',
      color: 'rgb(255, 255, 255)',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <svg fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" width={width * 0.6} height={height * 0.6} xmlns="http://www.w3.org/2000/svg">
      <title>ClinePass</title>
      <path d="M17.035 3.991c2.75 0 4.98 2.24 4.98 5.003v1.667l1.45 2.896a1.01 1.01 0 0 1-.002.909l-1.448 2.864v1.668c0 2.762-2.23 5.002-4.98 5.002H7.074c-2.751 0-4.98-2.24-4.98-5.002V17.33l-1.48-2.855a1.01 1.01 0 0 1-.003-.927l1.482-2.887V8.994c0-2.763 2.23-5.003 4.98-5.003zM8.265 9.6a2.274 2.274 0 0 0-2.274 2.274v4.042a2.274 2.274 0 0 0 4.547 0v-4.042A2.274 2.274 0 0 0 8.265 9.6m7.326 0a2.274 2.274 0 0 0-2.274 2.274v4.042a2.274 2.274 0 1 0 4.548 0v-4.042A2.274 2.274 0 0 0 15.59 9.6z" />
      <path d="M12.054 5.558a2.779 2.779 0 1 0 0-5.558 2.779 2.779 0 0 0 0 5.558" />
    </svg>
  </div>
);
