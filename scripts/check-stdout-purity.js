#!/usr/bin/env node
/**
 * Verifies that the built server writes nothing to stdout at startup.
 *
 * This server speaks JSON-RPC over stdio. Anything else written to stdout — a
 * log line, a dependency's banner — corrupts the MCP message stream and breaks
 * the client. Two separate regressions of this kind have already happened:
 * a structured logger defaulting to console.log, and dotenv v17 printing an
 * "injected env" banner. Diagnostics belong on stderr.
 *
 * Run after `pnpm run build`.
 */

const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const ENTRY = path.join(__dirname, '..', 'dist', 'index.js');
const SETTLE_MS = 5000;

if (!existsSync(ENTRY)) {
  console.error(`✖ ${ENTRY} not found. Run "pnpm run build" first.`);
  process.exit(1);
}

console.error('🔍 Checking that startup leaves stdout clean...');

const child = spawn(process.execPath, [ENTRY], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    // Values only need to satisfy config validation; no network call is made.
    NODE_ENV: process.env.NODE_ENV || 'test',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'stdout-purity-check-id',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'stdout-purity-check-secret',
  },
});

const stdoutChunks = [];
child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));

let stderrBytes = 0;
child.stderr.on('data', (chunk) => {
  stderrBytes += chunk.length;
});

child.on('error', (error) => {
  console.error(`✖ Failed to spawn the server: ${error.message}`);
  process.exit(1);
});

let reported = false;

function report() {
  if (reported) return;
  reported = true;

  const stdout = Buffer.concat(stdoutChunks);

  if (stdout.length === 0) {
    console.error(`✅ stdout is clean (stderr received ${stderrBytes} bytes of diagnostics)`);
    process.exit(0);
  }

  console.error(`✖ ${stdout.length} bytes were written to stdout during startup:`);
  console.error('---');
  console.error(stdout.toString('utf8'));
  console.error('---');
  console.error('Route all diagnostics to stderr. stdout carries JSON-RPC only.');
  process.exit(1);
}

const timer = setTimeout(() => {
  child.kill('SIGTERM');
  report();
}, SETTLE_MS);

// The server may also exit on its own (for example if stdin closes immediately).
child.on('close', () => {
  clearTimeout(timer);
  report();
});
