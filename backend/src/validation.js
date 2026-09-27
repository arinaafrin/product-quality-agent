const { z } = require('zod');
const MAX_RECORDS = 5000;

const validateBodySchema = z.object({
  records: z
    .array(z.record(z.string(), z.unknown()))
    .max(MAX_RECORDS, `records cannot exceed ${MAX_RECORDS} items per request`),
  jobId: z.string().uuid().optional(),
});

const askBodySchema = z.object({
  question: z.string().trim().min(1, 'question cannot be empty').max(2000, 'question is too long (max 2000 characters)'),
});

/**
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Request body failed validation.',
        issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBodySchema, askBodySchema, validateBody, MAX_RECORDS };
