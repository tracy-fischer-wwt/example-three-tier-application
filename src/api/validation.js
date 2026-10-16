const MAX_TITLE_LENGTH = 200;
const MAX_ID = 2147483647; // Postgres "serial" (int4) upper bound

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Validate a task title. Returns { value } (trimmed) or { error, status }.
 */
function validateTitle(title) {
  if (typeof title !== 'string') {
    return { status: 400, error: 'title must be a string' };
  }
  const trimmed = title.trim();
  if (!trimmed) {
    return { status: 400, error: 'title is required' };
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return {
      status: 422,
      error: `title must be at most ${MAX_TITLE_LENGTH} characters`,
    };
  }
  return { value: trimmed };
}

/**
 * Validate a route :id parameter. Returns { value } or { error, status }.
 */
function validateId(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return { status: 400, error: 'id must be a positive integer' };
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_ID) {
    return { status: 400, error: 'id must be a positive integer' };
  }
  return { value: id };
}

/**
 * Validate the body of POST /tasks. Returns { value: { title } } or { error, status }.
 */
function validateCreateBody(body) {
  if (!isPlainObject(body)) {
    return { status: 400, error: 'request body must be a JSON object' };
  }
  if (body.title === undefined || body.title === null) {
    return { status: 400, error: 'title is required' };
  }
  const title = validateTitle(body.title);
  if (title.error) return title;
  return { value: { title: title.value } };
}

/**
 * Validate the body of PATCH /tasks/:id. Returns
 * { value: { completed?, title? } } or { error, status }.
 */
function validateUpdateBody(body) {
  if (!isPlainObject(body)) {
    return { status: 400, error: 'request body must be a JSON object' };
  }
  const value = {};
  if (body.completed !== undefined) {
    if (typeof body.completed !== 'boolean') {
      return { status: 400, error: 'completed must be a boolean' };
    }
    value.completed = body.completed;
  }
  if (body.title !== undefined) {
    const title = validateTitle(body.title);
    if (title.error) return title;
    value.title = title.value;
  }
  if (Object.keys(value).length === 0) {
    return { status: 400, error: 'provide at least one of: completed, title' };
  }
  return { value };
}

module.exports = {
  MAX_TITLE_LENGTH,
  validateTitle,
  validateId,
  validateCreateBody,
  validateUpdateBody,
};
