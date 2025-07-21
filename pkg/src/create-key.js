#!/usr/bin/env node
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const certPath = resolve(process.cwd(), 'localhost-cert.pem');
const keyPath = resolve(process.cwd(), 'localhost-privkey.pem');

if (existsSync(certPath) && existsSync(keyPath)) {
  process.exit(0);
}

try {
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=localhost' -keyout "${keyPath}" -out "${certPath}" 2>/dev/null`, { stdio: 'ignore' });
  console.log('Key pair generated.');
} catch (err) {
  console.error('Failed to generate key pair:', err);
  process.exit(1);
}