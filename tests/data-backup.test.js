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

test('restoreUserDataBackup restores a complete backup', () => {
    const storage = memoryStorage({ a: 'old-a', b: 'old-b', cache: 'keep' });
    const backup = { format: 'kwhiz-user-data', version: 1, data: { a: 'new-a', b: 'new-b' } };
    const count = restoreUserDataBackup(storage, backup, ['a', 'b']);
    assert.equal(count, 2);
    assert.deepEqual(storage.dump(), { a: 'new-a', b: 'new-b', cache: 'keep' });
});

test('restoreUserDataBackup preserves allowed settings absent from a partial backup', () => {
    const storage = memoryStorage({ a: 'old-a', b: 'old-b', cache: 'keep' });
    const backup = { format: 'kwhiz-user-data', version: 1, data: { a: 'new-a' } };
    const count = restoreUserDataBackup(storage, backup, ['a', 'b']);
    assert.equal(count, 1);
    assert.deepEqual(storage.dump(), { a: 'new-a', b: 'old-b', cache: 'keep' });
});

test('restoreUserDataBackup rolls back every change when a write fails', () => {
    const storage = memoryStorage({ a: 'old-a', b: 'old-b', cache: 'keep' });
    const setItem = storage.setItem;
    let failurePending = true;
    storage.setItem = (key, value) => {
        if (key === 'b' && failurePending) {
            failurePending = false;
            throw new Error('simulated write failure');
        }
        setItem(key, value);
    };
    const backup = { format: 'kwhiz-user-data', version: 1, data: { a: 'new-a', c: 'new-c', b: 'new-b' } };

    assert.throws(
        () => restoreUserDataBackup(storage, backup, ['a', 'b', 'c']),
        /simulated write failure/
    );
    assert.deepEqual(storage.dump(), { a: 'old-a', b: 'old-b', cache: 'keep' });
});

test('restoreUserDataBackup ignores unauthorized keys', () => {
    const storage = memoryStorage({ a: 'old-a', rogue: 'keep', cache: 'keep' });
    const backup = { format: 'kwhiz-user-data', version: 1, data: { a: 'new-a', rogue: 'replace' } };
    const count = restoreUserDataBackup(storage, backup, ['a']);
    assert.equal(count, 1);
    assert.deepEqual(storage.dump(), { a: 'new-a', rogue: 'keep', cache: 'keep' });
});
