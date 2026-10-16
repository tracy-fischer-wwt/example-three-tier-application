const express = require('express');
const db = require('./db');
const {
  validateId,
  validateCreateBody,
  validateUpdateBody,
} = require('./validation');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// GET /tasks — list all tasks
app.get('/tasks', async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM tasks ORDER BY created_at ASC');
  res.json(rows);
});

// POST /tasks — create a task
app.post('/tasks', async (req, res) => {
  const parsed = validateCreateBody(req.body);
  if (parsed.error) return res.status(parsed.status).json({ error: parsed.error });

  const { rows } = await db.query(
    'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
    [parsed.value.title]
  );
  res.status(201).json(rows[0]);
});

// PATCH /tasks/:id — update a task (complete/uncomplete or rename)
app.patch('/tasks/:id', async (req, res) => {
  const idResult = validateId(req.params.id);
  if (idResult.error) return res.status(idResult.status).json({ error: idResult.error });
  const id = idResult.value;

  const parsed = validateUpdateBody(req.body);
  if (parsed.error) return res.status(parsed.status).json({ error: parsed.error });

  const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const current = rows[0];
  const newCompleted = parsed.value.completed !== undefined ? parsed.value.completed : current.completed;
  const newTitle = parsed.value.title !== undefined ? parsed.value.title : current.title;

  const { rows: updated } = await db.query(
    'UPDATE tasks SET completed = $1, title = $2 WHERE id = $3 RETURNING *',
    [newCompleted, newTitle, id]
  );
  res.json(updated[0]);
});

// Error handler — return JSON instead of Express's default HTML page
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

module.exports = app;
