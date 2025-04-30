import bunyan from "bunyan";

export const createLogger = (name: string): bunyan => {
  return bunyan.createLogger({
    name,
    level: "info",
    streams: [
      {
        level: "info",
        stream: process.stdout
      },
      {
        level: "error",
        path: "error.log"
      }
    ],
    serializers: {
      err: bunyan.stdSerializers.err
    }
  });
};

// Create default logger instances
export const appLogger = createLogger("contact-us-api");
export const dbLogger = createLogger("database");
export const mailLogger = createLogger("mailer");
export const middlewareLogger = createLogger("middleware");