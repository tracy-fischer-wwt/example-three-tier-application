const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Stub the db module before the app loads.
const calls = [];
let rowsFor = () => [];
const dbPath = require.resolve('./db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: rowsFor(sql, params) };
    },
  },
};

const app = require('./index');

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => {
  calls.length = 0;
  rowsFor = () => [];
});

const send = (method, path, body, raw) =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });

test('POST /tasks rejects invalid bodies without touching the db', async () => {
  const cases = [
    [undefined, 400],
    [{}, 400],
    [{ title: null }, 400],
    [{ title: 123 }, 400],
    [{ title: '   ' }, 400],
    [{ title: 'x'.repeat(201) }, 422],
    [[], 400],
  ];
  for (const [body, status] of cases) {
    const res = await send('POST', '/tasks', body);
    assert.equal(res.status, status, JSON.stringify(body));
    assert.ok((await res.json()).error);
  }
  assert.equal(calls.length, 0);
});

test('POST /tasks rejects malformed JSON with 400 JSON error', async () => {
  const res = await send('POST', '/tasks', undefined, '{bad');
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Malformed JSON body' });
});

test('POST /tasks accepts a trimmed title of 200 chars', async () => {
  const title = 'x'.repeat(200);
  rowsFor = (_sql, params) => [{ id: 1, title: params[0], completed: false }];
  const res = await send('POST', '/tasks', { title: `  ${title}  ` });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).title, title);
});

test('PATCH /tasks/:id rejects invalid ids', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '1e3', '99999999999']) {
    const res = await send('PATCH', `/tasks/${id}`, { completed: true });
    assert.equal(res.status, 400, id);
  }
  assert.equal(calls.length, 0);
});

test('PATCH /tasks/:id rejects invalid bodies', async () => {
  const cases = [
    [undefined, 400],
    [{}, 400],
    [{ completed: 'yes' }, 400],
    [{ completed: 1 }, 400],
    [{ title: 5 }, 400],
    [{ title: '' }, 400],
    [{ title: 'x'.repeat(201) }, 422],
  ];
  for (const [body, status] of cases) {
    const res = await send('PATCH', '/tasks/1', body);
    assert.equal(res.status, status, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
});

test('PATCH /tasks/:id returns 404 for unknown task', async () => {
  const res = await send('PATCH', '/tasks/42', { completed: true });
  assert.equal(res.status, 404);
});

test('PATCH /tasks/:id updates with validated values', async () => {
  const current = { id: 1, title: 'old', completed: false };
  rowsFor = (sql, params) =>
    sql.startsWith('SELECT')
      ? [current]
      : [{ id: 1, completed: params[0], title: params[1] }];
  const res = await send('PATCH', '/tasks/1', { completed: true });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: 1, completed: true, title: 'old' });
});
