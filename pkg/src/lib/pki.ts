import { access, rm } from "node:fs/promises";
import { exec as execCb, execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import os from "node:os";

const exec = promisify(execCb);
const execFile = promisify(execFileCb);

export interface EnsureCertificatesOptions {
  keyFile?: string;
  certFile?: string;
}

export const ensureCertificates = async (
  options: EnsureCertificatesOptions = {}
): Promise<{ keyPath: string; certPath: string }> => {
  const usingCustomCerts = !!(options.keyFile || options.certFile);
  const keyPath = resolve(process.cwd(), options.keyFile ?? "bascik-privkey.pem");
  const certPath = resolve(process.cwd(), options.certFile ?? "bascik-cert.pem");

  let certsPresent = false;
  try {
    await Promise.all([access(keyPath), access(certPath)]);
    certsPresent = true;
  } catch {
    certsPresent = false;
  }

  if (certsPresent) {
    return { keyPath, certPath };
  }

  if (usingCustomCerts) {
    throw new Error(
      "Custom TLS certificate files are configured but could not be found.\n" +
      `  keyFile:  ${keyPath}\n` +
      `  certFile: ${certPath}\n` +
      "Ensure both files exist before starting the server."
    );
  }

  const env = {
    ...process.env,
    PATH: [
      process.env.PATH,
      "/opt/homebrew/bin",
      "/usr/local/bin",
    ].filter(Boolean).join(":"),
  };

  // Try mkcert first
  try {
    const { stdout, stderr } = await execFile(
      "mkcert",
      ["-key-file", keyPath, "-cert-file", certPath, "localhost", "127.0.0.1", "::1"],
      { env }
    );
    if (stdout && stdout.trim()) console.log(stdout.trim());
    if (stderr && stderr.trim()) console.log(stderr.trim());
    console.log("SSL: generated trusted certs via mkcert");
    return { keyPath, certPath };
  } catch (mkcertErr) {
    console.log(`SSL: mkcert not found or failed (${(mkcertErr as Error).message?.split("\n")[0]}), falling back to openssl`);
  }

  try {
    if (os.platform() === "win32") {
      const pfxPath = resolve(process.cwd(), "bascik-cert.pfx").replace(/\\/g, "/");

      await exec(
        `powershell -Command "\
          $cert = Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Subject -eq 'CN=localhost' } | Select-Object -First 1; \
          if (-not $cert) { \
            $cert = New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation Cert:\\CurrentUser\\My -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(100) -TextExtension @('2.5.29.17={text}DNS=localhost,IP=127.0.0.1'); \
          }; \
          $pwd = ConvertTo-SecureString -String '' -Force -AsPlainText; \
          Export-PfxCertificate -Cert $cert -FilePath '${pfxPath}' -Password $pwd; \
        "`
      );

      await exec(
        `openssl pkcs12 -in "${pfxPath}" -nodes -nocerts -out "${keyPath}" -passin pass:`
      );

      await exec(
        `openssl pkcs12 -in "${pfxPath}" -nokeys -out "${certPath}" -passin pass:`
      );

      await rm(pfxPath, { force: true });
    } else {
      await execFile("openssl", [
        "req", "-x509", "-newkey", "rsa:2048",
        "-keyout", keyPath,
        "-out", certPath,
        "-days", "365",
        "-nodes",
        "-subj", "/CN=localhost",
      ]).catch(async () => {
        await exec(
          `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 36500 \
          -subj "/CN=localhost" \
          -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
          -keyout "${keyPath}" -out "${certPath}" 2>/dev/null`
        );
      });
    }
    console.log("Generated self-signed certificate for the development server");
    return { keyPath, certPath };
  } catch (err) {
    throw new Error(
      "Failed to generate self-signed certificate for the development server: " +
      (err instanceof Error ? err.message : String(err))
    );
  }
};

export const createSelfSignedCert = async (): Promise<void> => {
  await ensureCertificates();
};


