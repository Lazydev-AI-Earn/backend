import { ZodError } from "zod";
import { HttpError } from "./errors.js";

export function validate(schema, source = "body") {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors
          .map((issue) => `${issue.path.join(".") || source}: ${issue.message}`)
          .join("; ");
        return next(new HttpError(400, message, "Bad Request"));
      }
      return next(error);
    }
  };
}
