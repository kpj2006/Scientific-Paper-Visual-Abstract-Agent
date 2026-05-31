import pino from "pino";
import { env } from "../config/env.js";

const loggerOptions =
  env.NODE_ENV === "development"
    ? {
        level: env.LOG_LEVEL,
        transport: {
          target: "pino-pretty",
          options: { colorize: true, singleLine: true }
        }
      }
    : {
        level: env.LOG_LEVEL
      };

export const logger = pino(loggerOptions);