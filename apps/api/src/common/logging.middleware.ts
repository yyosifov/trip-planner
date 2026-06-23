import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on("finish", () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      const color = statusCode >= 500 ? "\x1b[31m" : statusCode >= 400 ? "\x1b[33m" : "\x1b[32m";
      this.logger.log(`${color}${method} ${originalUrl} ${statusCode}\x1b[0m +${ms}ms`);
    });

    next();
  }
}
