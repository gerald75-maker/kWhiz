import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createUserDataBackup,
    validateUserDataBackup,
    restoreUserDataBackup
} from '../src/ui/data-backup.js';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        dump: () => Object.fromEntries(values)
    };
}

test('createUserDataBackup exports only requested keys', () => {
    const storage = memoryStorage({ a: '1', b: '2', cache: 'ignore' });
    const backup = createUserDataBackup(storage, ['a', 'b'], new Date('2026-07-27T12:00:00Z'));
    assert.equal(backup.format, 'kwhiz-user-data');
    assert.equal(backup.version, 1);
    assert.deepEqual(backup.data, { a: '1', b: '2' });
});

test('validateUserDataBackup rejects unknown format', () => {
    assert.throws(() => validateUserDataBackup({ format: 'other', version: 1, data: {} }, ['a']));
});

test('restoreUserDataBackup replaces allowed settings only', () => {
    const storage = memoryStorage({ a: 'old', b: 'old', cache: 'keep' });
    const backup = { format: 'kwhiz-user-data', version: 1, data: { a: 'new', rogue: 'x' } };
    const count = restoreUserDataBackup(storage, backup, ['a', 'b']);
    assert.equal(count, 1);
    assert.deepEqual(storage.dump(), { a: 'new', cache: 'keep' });
});
