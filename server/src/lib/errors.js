// One error shape for the whole API:
//   { "error": { "code": "NOT_FOUND", "message": "Fayl topilmadi", "details": … } }
// `message` is user-facing Uzbek text; `code` is stable for the frontend to switch on.

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message = 'Sörov notöğri', details) => new AppError(400, 'BAD_REQUEST', message, details)
export const unauthorized = (message = 'Tizimga kiring') => new AppError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = 'Bu amal uçun ruxsat yöq') => new AppError(403, 'FORBIDDEN', message)
export const notFound = (message = 'Topilmadi') => new AppError(404, 'NOT_FOUND', message)
export const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details)
export const tooLarge = (message) => new AppError(413, 'FILE_TOO_LARGE', message)
export const unsupported = (message, details) => new AppError(415, 'UNSUPPORTED_FILE', message, details)
export const quotaExceeded = (message, details) => new AppError(429, 'QUOTA_EXCEEDED', message, details)

/** Errors thrown inside tools — carried across the worker boundary by code. */
export class ToolError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export function errorHandler(err, req, reply) {
  if (err instanceof AppError) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } })
  }
  // Fastify schema validation
  if (err.validation) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Maʼlumotlar notöğri', details: err.validation.map((v) => ({ path: v.instancePath, message: v.message })) },
    })
  }
  if (err.code === 'FST_REQ_FILE_TOO_LARGE' || err.code === 'FST_FILES_LIMIT') {
    return reply.status(413).send({ error: { code: 'FILE_TOO_LARGE', message: 'Fayl hajmi hisobingiz çegarasidan katta' } })
  }
  if (err.code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
    return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'Fayl multipart/form-data körinişida yuborilişi kerak' } })
  }
  if (err.statusCode === 429) {
    return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Juda köp sörov — birozdan keyin urinib köring' } })
  }
  if (err.statusCode && err.statusCode < 500) {
    return reply.status(err.statusCode).send({ error: { code: err.code ?? 'BAD_REQUEST', message: err.message } })
  }
  req.log.error({ err }, 'unhandled error')
  return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Serverda kutilmagan xatolik. Birozdan keyin qayta urinib köring.' } })
}
