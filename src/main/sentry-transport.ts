import * as Sentry from '@sentry/electron/main';
import Transport from 'winston-transport';

export class SentryTransport extends Transport {
  constructor(opts?) {
    super(opts);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (info.level === 'error') {
      Sentry.captureException(info);
    }

    callback();
  }
}
