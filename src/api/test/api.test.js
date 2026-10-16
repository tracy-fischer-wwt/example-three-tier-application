const { test, beforeEach, before, after } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../db');
const app = require('../index');

let server;
let base;
let queries;

// Stub the pool so tests need no database.
beforeEach(() => {
  queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith('SELECT * FROM tasks WHERE')) {
      return params[0] === 1
        ? { rows: [{ id: 1, title: 'old', completed: false }] }
        : { rows: [] };
    }
    if (sql.startsWith('INSERT')) return { rows: [{ id: 2, title: params[0], completed: false }] };
    if (sql.startsWith('UPDATE')) {
      return { rows: [{ id: params[2], completed: params[0], title: params[1] }] };
    }
    return { rows: [] };
  };
});

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function send(method, path, body, raw) {
  return fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
}

test('POST /tasks creates a task with trimmed title', async () => {
  const res = await send('POST', '/tasks', { title: '  hello  ' });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).title, 'hello');
});

for (const [name, body] of [
  ['missing title', {}],
  ['non-string title', { title: 123 }],
  ['blank title', { title: '   ' }],
  ['array body', []],
  ['null body', null],
]) {
  test(`POST /tasks rejects ${name} with 400`, async () => {
    const res = await send('POST', '/tasks', body);
    assert.equal(res.status, 400);
    assert.equal(queries.length, 0);
  });
}

test('POST /tasks rejects invalid JSON with 400', async () => {
  const res = await send('POST', '/tasks', undefined, '{bad');
  assert.equal(res.status, 400);
});

test('POST /tasks rejects missing body with 400', async () => {
  const res = await fetch(base + '/tasks', { method: 'POST' });
  assert.equal(res.status, 400);
});

test('POST /tasks accepts 200 chars, rejects 201 with 422', async () => {
  assert.equal((await send('POST', '/tasks', { title: 'a'.repeat(200) })).status, 201);
  assert.equal((await send('POST', '/tasks', { title: 'a'.repeat(201) })).status, 422);
});

test('PATCH /tasks/:id updates completed', async () => {
  const res = await send('PATCH', '/tasks/1', { completed: true });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.completed, true);
  assert.equal(json.title, 'old');
});

for (const id of ['abc', '0', '-1', '1.5', '1abc', '99999999999']) {
  test(`PATCH /tasks/${id} rejects invalid id with 400`, async () => {
    const res = await send('PATCH', `/tasks/${id}`, { completed: true });
    assert.equal(res.status, 400);
    assert.equal(queries.length, 0);
  });
}

for (const [name, body, status] of [
  ['non-boolean completed', { completed: 'yes' }, 400],
  ['non-string title', { title: 5 }, 400],
  ['blank title', { title: ' ' }, 400],
  ['too-long title', { title: 'a'.repeat(201) }, 422],
  ['empty object', {}, 400],
  ['array body', [], 400],
]) {
  test(`PATCH /tasks/1 rejects ${name} with ${status}`, async () => {
    const res = await send('PATCH', '/tasks/1', body);
    assert.equal(res.status, status);
    assert.equal(queries.length, 0);
  });
}

test('PATCH /tasks/:id returns 404 for unknown id', async () => {
  const res = await send('PATCH', '/tasks/42', { completed: true });
  assert.equal(res.status, 404);
});
