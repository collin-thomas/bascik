import { existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import os from 'node:os';

export const createSelfSignedCert = () => {
  const certPath = resolve(process.cwd(), 'bascik-cert.pem');
  const keyPath = resolve(process.cwd(), 'bascik-privkey.pem');

  if (existsSync(certPath) && existsSync(keyPath)) {
    return;
  }

  try {
    if (os.platform() === 'win32') {
      const pfxPath = resolve(process.cwd(), 'bascik-cert.pfx').replace(/\\/g, '/');

      execSync(
        `powershell -Command "\
          $cert = Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Subject -eq 'CN=localhost' } | Select-Object -First 1; \
          if (-not $cert) { \
            $cert = New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation Cert:\\CurrentUser\\My -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(100) -TextExtension @('2.5.29.17={text}DNS=localhost,IP=127.0.0.1'); \
          }; \
          Export-PfxCertificate -Cert $cert -FilePath '${pfxPath}' -Password (ConvertTo-SecureString -String '' -Force -AsPlainText) \
        "`,
        { stdio: 'inherit' }
      );

      // Extract private key
      execSync(
        `openssl pkcs12 -in "${pfxPath}" -nodes -nocerts -out "${keyPath}" -passin pass:`,
        { stdio: 'ignore' }
      );

      // Extract certificate
      execSync(
        `openssl pkcs12 -in "${pfxPath}" -nokeys -out "${certPath}" -passin pass:`,
        { stdio: 'ignore' }
      );

      // Clean up PFX
      rmSync(pfxPath, { force: true });
    } else {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 36500 \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
        -keyout "${keyPath}" -out "${certPath}" 2>/dev/null`,
        { stdio: 'ignore' }
      );
    }
    console.log('Generated self-signed certificate for the development server');
  } catch (err) {
    console.error('Failed to generate self-signed certificate for the development server', err);
    process.exit(1);
  }
};
