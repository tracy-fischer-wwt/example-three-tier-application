const MAX_TITLE_LENGTH = 200;
const MAX_ID = 2147483647; // max value of a Postgres `serial` (int4)

class ValidationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Returns the trimmed title, or throws a ValidationError.
function validateTitle(title) {
  if (typeof title !== 'string' || !title.trim()) {
    throw new ValidationError(400, 'title is required and must be a non-empty string');
  }
  const trimmed = title.trim();
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(422, `title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  return trimmed;
}

// Returns the id as a number, or throws a ValidationError.
function validateId(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    throw new ValidationError(400, 'id must be a positive integer');
  }
  const id = Number(raw);
  if (id < 1 || id > MAX_ID) {
    throw new ValidationError(400, 'id must be a positive integer');
  }
  return id;
}

function requireBody(body) {
  if (!isPlainObject(body)) {
    throw new ValidationError(400, 'request body must be a JSON object');
  }
  return body;
}

function validateCreateTask(body) {
  const { title } = requireBody(body);
  return { title: validateTitle(title) };
}

// Returns { completed?: boolean, title?: string }; at least one field is present.
function validateUpdateTask(body) {
  const { completed, title } = requireBody(body);
  const result = {};
  if (completed !== undefined) {
    if (typeof completed !== 'boolean') {
      throw new ValidationError(400, 'completed must be a boolean');
    }
    result.completed = completed;
  }
  if (title !== undefined) {
    result.title = validateTitle(title);
  }
  if (Object.keys(result).length === 0) {
    throw new ValidationError(400, 'provide at least one of: completed, title');
  }
  return result;
}

module.exports = {
  MAX_TITLE_LENGTH,
  ValidationError,
  validateId,
  validateTitle,
  validateCreateTask,
  validateUpdateTask,
};
