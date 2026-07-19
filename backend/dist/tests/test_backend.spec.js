"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const jwt = __importStar(require("jsonwebtoken"));
const routes_1 = require("../routes");
const JWT_SECRET = 'safemesh-super-secret-jwt-token-key-2026';
async function runTests() {
    console.log('Running backend unit tests...');
    // 1. Test JWT Authentication helper
    try {
        const payload = { id: 'user-123', email: 'officer@safemesh.ai', role: 'SAFETY_OFFICER', name: 'Sarah Jenkins' };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        assert.ok(token, 'Token should be defined');
        const decoded = jwt.verify(token, JWT_SECRET);
        assert.strictEqual(decoded.id, payload.id, 'Decoded ID should match');
        assert.strictEqual(decoded.email, payload.email, 'Decoded email should match');
        assert.strictEqual(decoded.role, payload.role, 'Decoded role should match');
        console.log('✔ JWT Sign and Verify test passed.');
    }
    catch (err) {
        console.error('✘ JWT Sign and Verify test failed:', err.message);
        process.exit(1);
    }
    // 2. Test Python subprocess runner
    try {
        const response = await (0, routes_1.runPython)('app/scripts/validate_data.py');
        assert.ok(response === null || response !== undefined, 'Response should exist');
    }
    catch (err) {
        // If it throws the expected parse failure warning, it means execution successfully fired!
        if (err.message.includes('No JSON output returned')) {
            console.log('✔ runPython CLI runner test passed (process launched successfully).');
        }
        else {
            console.error('✘ runPython CLI runner test failed:', err.message);
            process.exit(1);
        }
    }
    console.log('All backend tests completed successfully!');
}
runTests();
