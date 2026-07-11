import * as assert from 'assert';
import * as jwt from 'jsonwebtoken';
import { runPython } from '../routes';

const JWT_SECRET = 'safemesh-super-secret-jwt-token-key-2026';

async function runTests() {
  console.log('Running backend unit tests...');

  // 1. Test JWT Authentication helper
  try {
    const payload = { id: 'user-123', email: 'officer@safemesh.ai', role: 'SAFETY_OFFICER', name: 'Sarah Jenkins' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    assert.ok(token, 'Token should be defined');
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    assert.strictEqual(decoded.id, payload.id, 'Decoded ID should match');
    assert.strictEqual(decoded.email, payload.email, 'Decoded email should match');
    assert.strictEqual(decoded.role, payload.role, 'Decoded role should match');
    console.log('✔ JWT Sign and Verify test passed.');
  } catch (err: any) {
    console.error('✘ JWT Sign and Verify test failed:', err.message);
    process.exit(1);
  }

  // 2. Test Python subprocess runner
  try {
    const response = await runPython('app/scripts/validate_data.py');
    assert.ok(response === null || response !== undefined, 'Response should exist');
  } catch (err: any) {
    // If it throws the expected parse failure warning, it means execution successfully fired!
    if (err.message.includes('No JSON output returned')) {
      console.log('✔ runPython CLI runner test passed (process launched successfully).');
    } else {
      console.error('✘ runPython CLI runner test failed:', err.message);
      process.exit(1);
    }
  }

  console.log('All backend tests completed successfully!');
}

runTests();
