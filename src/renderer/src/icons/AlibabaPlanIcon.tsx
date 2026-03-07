type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const AlibabaPlanIcon = ({ width = 64, height = 64, className }: Props) => (
  <div
    aria-label="Alibaba Coding Plan"
    className={`flex items-center justify-center rounded-md ${className || ''}`}
    style={{
      backgroundColor: 'white',
      height: `${height}px`,
      width: `${width}px`,
    }}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width={0.8 * width} height={0.8 * height} viewBox="0 0 21 21">
      <path d="M16.93 28.29v19.55l16.93-9.78z" className="cls-3" fill="#1c54e3" strokeWidth={0} transform="translate(1.164 .025)scale(.27545)" />
      <path
        d="M64.71 16.77s-.02-.02-.03-.02L50.8 8.73 16.93 28.29l16.93 9.78L64.64 20.3l.05-.03a2.014 2.014 0 0 0 .02-3.49z"
        className="cls-1"
        fill="#aa9aff"
        strokeWidth={0}
        transform="translate(1.164 .025)scale(.27545)"
      />
      <path
        d="M65.71 39.54c-.37 0-.71.1-1 .27 0 0-.02 0-.03.01L50.8 47.84l16.02 9.25h.02c.56-.96.89-2.09.89-3.3V41.56c0-1.11-.9-2.02-2.02-2.02"
        className="cls-6"
        fill="#00ead1"
        strokeWidth={0}
        transform="translate(1.164 .025)scale(.27545)"
      />
      <path
        d="M66.82 57.09 50.8 47.84 16.94 67.39l13.55 7.82s.05.02.07.04c.98.57 2.11.89 3.32.89s2.34-.33 3.32-.89c.02-.01.05-.02.07-.04l27.09-15.64s.02-.01.03-.02a6.65 6.65 0 0 0 2.46-2.45h-.02z"
        className="cls-5"
        fill="#00cec9"
        strokeWidth={0}
        transform="translate(1.164 .025)scale(.27545)"
      />
      <path
        d="m33.86 38.06-16.93 9.78-4.58 2.64L.91 57.09H.89c.55.96 1.32 1.76 2.25 2.34l.25.14.05.03.06.04 13.43 7.75 33.86-19.55z"
        className="cls-6"
        fill="#00ead1"
        strokeWidth={0}
        transform="translate(1.164 .025)scale(.27545)"
      />
      <path
        d="M37.25.91c-.32-.19-.66-.34-1-.47-.06-.02-.12-.05-.18-.07-.03-.01-.06-.02-.1-.03a6.7 6.7 0 0 0-2.12-.35c-.74 0-1.45.12-2.12.35-.03.01-.06.02-.1.03-.06.02-.12.04-.18.07-.34.13-.67.28-1 .47L3.39 16.56s-.01 0-.02.01a6.7 6.7 0 0 0-2.48 2.45h.02l16.02 9.26L50.8 8.74z"
        className="cls-2"
        fill="#7347ff"
        strokeWidth={0}
        transform="translate(1.164 .025)scale(.27545)"
      />
      <path
        d="M.91 19.03H.89c-.56.96-.89 2.09-.89 3.3v31.46c0 1.2.32 2.33.89 3.31h.02l16.02-9.26V28.29z"
        className="cls-4"
        fill="#0423da"
        strokeWidth={0}
        transform="translate(1.164 .025)scale(.27545)"
      />
    </svg>
  </div>
);
