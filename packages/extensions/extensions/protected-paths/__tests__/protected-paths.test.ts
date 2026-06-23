import { describe, it, expect } from 'vitest';

import { checkReadable, checkWritable } from '../index';

describe('checkReadable — secret basename patterns', () => {
  it('blocks .env files', () => {
    expect(checkReadable('/project/.env').ok).toBe(false);
    expect(checkReadable('/project/.env.production').ok).toBe(false);
    expect(checkReadable('/project/.env.local').ok).toBe(false);
  });

  it('blocks .env with trailing dot (Windows)', () => {
    expect(checkReadable('/project/.env.').ok).toBe(false);
    expect(checkReadable('/project/.env ').ok).toBe(false);
  });

  it('blocks .env with NTFS alternate data stream', () => {
    expect(checkReadable('/project/.env:$DATA').ok).toBe(false);
    expect(checkReadable('/project/.env:stream').ok).toBe(false);
  });

  it('blocks .pem files', () => {
    expect(checkReadable('/project/cert.pem').ok).toBe(false);
    expect(checkReadable('/project/key.pem').ok).toBe(false);
  });

  it('blocks .key files', () => {
    expect(checkReadable('/project/private.key').ok).toBe(false);
  });

  it('blocks .p12 and .pfx files', () => {
    expect(checkReadable('/project/cert.p12').ok).toBe(false);
    expect(checkReadable('/project/cert.pfx').ok).toBe(false);
  });

  it('blocks .asc and .gpg files', () => {
    expect(checkReadable('/project/key.asc').ok).toBe(false);
    expect(checkReadable('/project/key.gpg').ok).toBe(false);
  });

  it('blocks .keystore and .jks files', () => {
    expect(checkReadable('/project/keystore.jks').ok).toBe(false);
    expect(checkReadable('/project/keystore.keystore').ok).toBe(false);
  });

  it('blocks id_rsa and variants', () => {
    expect(checkReadable('/home/user/.ssh/id_rsa').ok).toBe(false);
    expect(checkReadable('/home/user/id_rsa').ok).toBe(false);
    expect(checkReadable('/home/user/id_ed25519').ok).toBe(false);
    expect(checkReadable('/home/user/id_ecdsa').ok).toBe(false);
    expect(checkReadable('/home/user/id_dsa').ok).toBe(false);
    expect(checkReadable('/home/user/id_rsa.pub').ok).toBe(false);
    expect(checkReadable('/home/user/id_rsa.bak').ok).toBe(false);
    expect(checkReadable('/home/user/id_rsa_old').ok).toBe(false);
  });

  it('blocks known_hosts and authorized_keys', () => {
    expect(checkReadable('/home/user/.ssh/known_hosts').ok).toBe(false);
    expect(checkReadable('/home/user/.ssh/authorized_keys').ok).toBe(false);
  });

  it('blocks htpasswd', () => {
    expect(checkReadable('/etc/apache2/htpasswd').ok).toBe(false);
  });

  it('blocks .netrc and _netrc', () => {
    expect(checkReadable('/home/user/.netrc').ok).toBe(false);
    expect(checkReadable('/home/user/_netrc').ok).toBe(false);
  });

  it('blocks credentials file', () => {
    expect(checkReadable('/home/user/.aws/credentials').ok).toBe(false);
  });

  it('blocks .pgpass, .npmrc, .pypirc', () => {
    expect(checkReadable('/home/user/.pgpass').ok).toBe(false);
    expect(checkReadable('/home/user/.npmrc').ok).toBe(false);
    expect(checkReadable('/home/user/.pypirc').ok).toBe(false);
  });

  it('blocks secrets.* files', () => {
    expect(checkReadable('/project/secrets.json').ok).toBe(false);
    expect(checkReadable('/project/secrets.yaml').ok).toBe(false);
    expect(checkReadable('/project/secrets.yml').ok).toBe(false);
    expect(checkReadable('/project/secrets.toml').ok).toBe(false);
    expect(checkReadable('/project/secrets.env').ok).toBe(false);
    expect(checkReadable('/project/secret.json').ok).toBe(false);
  });

  it('blocks GCP service account JSON', () => {
    expect(checkReadable('/project/service-account-key.json').ok).toBe(false);
    expect(checkReadable('/project/service_account.json').ok).toBe(false);
    expect(checkReadable('/project/serviceAccount-1234.json').ok).toBe(false);
  });

  it('does not block normal files', () => {
    expect(checkReadable('/project/src/index.ts').ok).toBe(true);
    expect(checkReadable('/project/package.json').ok).toBe(true);
    expect(checkReadable('/project/README.md').ok).toBe(true);
  });

  it('does not block files that look like but are not secret patterns', () => {
    expect(checkReadable('/project/.environment').ok).toBe(true);
    expect(checkReadable('/project/keys.ts').ok).toBe(true);
    expect(checkReadable('/project/.envoy').ok).toBe(true);
  });
});

describe('checkReadable — protected directories', () => {
  it('blocks .ssh directory and descendants', () => {
    expect(checkReadable('/home/user/.ssh').ok).toBe(false);
    expect(checkReadable('/home/user/.ssh/config').ok).toBe(false);
    expect(checkReadable('/home/user/.ssh/id_rsa').ok).toBe(false);
  });

  it('blocks .gnupg directory', () => {
    expect(checkReadable('/home/user/.gnupg/gpg.conf').ok).toBe(false);
  });

  it('blocks .aws directory', () => {
    expect(checkReadable('/home/user/.aws/config').ok).toBe(false);
    expect(checkReadable('/home/user/.aws/credentials').ok).toBe(false);
  });

  it('blocks .azure directory', () => {
    expect(checkReadable('/home/user/.azure/azureProfile.json').ok).toBe(false);
  });

  it('blocks .kube directory', () => {
    expect(checkReadable('/home/user/.kube/config').ok).toBe(false);
  });

  it('blocks .docker directory', () => {
    expect(checkReadable('/home/user/.docker/config.json').ok).toBe(false);
  });

  it('blocks .git directory', () => {
    expect(checkReadable('/project/.git/config').ok).toBe(false);
    expect(checkReadable('/project/.git/HEAD').ok).toBe(false);
  });

  it('blocks .config/gh directory', () => {
    expect(checkReadable('/home/user/.config/gh/hosts.yml').ok).toBe(false);
  });

  it('blocks .config/gcloud directory', () => {
    expect(checkReadable('/home/user/.config/gcloud/credentials.db').ok).toBe(false);
  });

  it('blocks system directories', () => {
    expect(checkReadable('/etc/passwd').ok).toBe(false);
    expect(checkReadable('/etc/hosts').ok).toBe(false);
    expect(checkReadable('/proc/self/environ').ok).toBe(false);
    expect(checkReadable('/sys/kernel/hostname').ok).toBe(false);
    expect(checkReadable('/var/db/some-file').ok).toBe(false);
    expect(checkReadable('/var/root/.bashrc').ok).toBe(false);
  });

  it('blocks macOS private directories', () => {
    expect(checkReadable('/private/etc/passwd').ok).toBe(false);
    expect(checkReadable('/private/var/db/some-file').ok).toBe(false);
  });

  it('blocks node_modules', () => {
    expect(checkReadable('/project/node_modules/package/index.js').ok).toBe(false);
    expect(checkReadable('node_modules/lodash/lodash.js').ok).toBe(false);
  });

  it('does not block sibling of protected directory', () => {
    expect(checkReadable('/home/user/.sshx/file').ok).toBe(true);
  });

  it('does not block regular project directories', () => {
    expect(checkReadable('/project/src/utils/helper.ts').ok).toBe(true);
    expect(checkReadable('/project/dist/bundle.js').ok).toBe(true);
  });
});

describe('checkReadable — edge cases', () => {
  it('rejects empty paths', () => {
    expect(checkReadable('').ok).toBe(false);
  });

  it('rejects paths with control bytes', () => {
    expect(checkReadable('/project/\x00evil').ok).toBe(false);
    expect(checkReadable('/project/file\nname').ok).toBe(false);
  });

  it('handles Windows drive prefixes', () => {
    expect(checkReadable('C:\\Users\\me\\.ssh\\id_rsa').ok).toBe(false);
    expect(checkReadable('D:/project/.env').ok).toBe(false);
  });

  it('handles backslash paths', () => {
    expect(checkReadable('C:\\Users\\me\\.aws\\credentials').ok).toBe(false);
  });

  it('handles case-insensitive matching', () => {
    expect(checkReadable('/home/user/.SSH/config').ok).toBe(false);
    expect(checkReadable('/home/user/.AWS/credentials').ok).toBe(false);
    expect(checkReadable('/project/.ENV').ok).toBe(false);
    expect(checkReadable('/project/KEY.PEM').ok).toBe(false);
  });
});

describe('checkWritable', () => {
  it('inherits all read restrictions', () => {
    expect(checkWritable('/project/.env').ok).toBe(false);
    expect(checkWritable('/home/user/.ssh/id_rsa').ok).toBe(false);
    expect(checkWritable('/etc/passwd').ok).toBe(false);
  });

  it('additionally blocks writes to system directories', () => {
    expect(checkWritable('/usr/bin/malicious').ok).toBe(false);
    expect(checkWritable('/usr/sbin/test').ok).toBe(false);
    expect(checkWritable('/bin/evil').ok).toBe(false);
    expect(checkWritable('/sbin/test').ok).toBe(false);
    expect(checkWritable('/boot/vmlinuz').ok).toBe(false);
  });

  it('blocks writes to macOS system directories', () => {
    expect(checkWritable('/System/Library/test').ok).toBe(false);
    expect(checkWritable('/Library/Keychains/db').ok).toBe(false);
    expect(checkWritable('/Library/LaunchAgents/evil.plist').ok).toBe(false);
    expect(checkWritable('/Library/LaunchDaemons/evil.plist').ok).toBe(false);
  });

  it('blocks writes to Windows system directories', () => {
    expect(checkWritable('C:/Windows/System32/evil.exe').ok).toBe(false);
    expect(checkWritable('C:/Program Files/evil/evil.exe').ok).toBe(false);
    expect(checkWritable('C:/Program Files (x86)/evil/evil.exe').ok).toBe(false);
    expect(checkWritable('C:/ProgramData/evil/config').ok).toBe(false);
  });

  it('allows writes to normal project files', () => {
    expect(checkWritable('/project/src/index.ts').ok).toBe(true);
    expect(checkWritable('/project/package.json').ok).toBe(true);
  });
});
