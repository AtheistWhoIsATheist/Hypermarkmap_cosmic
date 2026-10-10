import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Test data never touches the user database or calls a paid provider.
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'hypermark-tests-'));
delete process.env.OPENROUTER_API_KEY;
