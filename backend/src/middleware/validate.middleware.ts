import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

interface ValidateSchemas {
  body?: ZodSchema
  query?: ZodSchema
  params?: ZodSchema
}

export const validate = (schemas: ValidateSchemas) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body)
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query)
        Object.assign(req.query, parsed)
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params)
        Object.assign(req.params, parsed)
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
