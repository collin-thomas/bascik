#!/usr/bin/env node
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

export const createSelfSignedCert = () => {
  const certPath = resolve(process.cwd(), 'localhost-cert.pem');
  const keyPath = resolve(process.cwd(), 'localhost-privkey.pem');

  if (existsSync(certPath) && existsSync(keyPath)) {
    return;
  }

  try {
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout "${keyPath}" -out "${certPath}" 2>/dev/null`, { stdio: 'ignore' });
    console.log('Generated Self-signed Cert');
  } catch (err) {
    console.error('Failed to generate Self-signed Cert', err);
    process.exit(1);
  }
}