import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTests, isPrivateAddress, assertPublicTarget } from '../src/index.mjs';

test('tenant spec code cannot read the runner token', async () => {
  process.env.RUNNER_SERVICE_TOKEN = 'secret-should-not-leak';
  const [r] = await runTests({ reruns: 1, tests: [{ name: 'env', spec_path: 'env.spec.ts', spec_content:
    "import {test,expect} from '@playwright/test'; test('no token', () => expect(process.env.RUNNER_SERVICE_TOKEN).toBeUndefined());" }] });
  assert.equal(r.status, 'passed');
});

test('private and metadata addresses are refused', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
  delete process.env.RUNNER_ALLOW_PRIVATE_TARGETS;
  await assert.rejects(assertPublicTarget('http://169.254.169.254/latest/meta-data'), /private/);
  await assert.rejects(assertPublicTarget('http://localhost:8080'), /private/);
  await assert.rejects(assertPublicTarget('file:///etc/passwd'), /http/);
});
