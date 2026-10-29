import { resolveStreamingConfig, StreamingConfig } from '@common/streaming';

import { DisableStreaming } from './DisableStreaming';
import { RequireStreaming } from './RequireStreaming';

type Props = {
  value: StreamingConfig;
  onChange: (value: Required<StreamingConfig>) => void;
};

export const StreamingSettings = ({ value, onChange }: Props) => {
  const resolved = resolveStreamingConfig(value);

  const handleDisableStreamingChange = (disableStreaming: boolean) => {
    onChange({ disableStreaming, requireStreaming: disableStreaming ? false : resolved.requireStreaming });
  };

  const handleRequireStreamingChange = (requireStreaming: boolean) => {
    onChange({ requireStreaming, disableStreaming: requireStreaming ? false : resolved.disableStreaming });
  };

  return (
    <div className="space-y-2">
      <DisableStreaming checked={resolved.disableStreaming} onChange={handleDisableStreamingChange} />
      <RequireStreaming checked={resolved.requireStreaming} onChange={handleRequireStreamingChange} />
    </div>
  );
};
