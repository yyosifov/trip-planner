import { BadRequestException, Logger, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

export class ZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(private schema: ZodSchema) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      this.logger.warn(
        `Validation failed — issues: ${JSON.stringify(result.error.issues)} | value keys: ${
          value && typeof value === "object" ? Object.keys(value).join(", ") : typeof value
        }`,
      );
      throw new BadRequestException(result.error.format());
    }
    return result.data;
  }
}
