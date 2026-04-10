import { join } from "node:path";
import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";

export interface AppOptions
  extends FastifyServerOptions,
    Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
  logger: true
};

declare module "fastify" {
  interface FastifyInstance {
    config: {
      // this should be the same as the confKey in options
      // specify your typing here
      PUPPETEER_EXECUTABLE_PATH: string,
      STATIC_SITE_DIR: string;
      SITE_URL: string;
      EXECUTE_JOB_ON_START: boolean;
      DATABASE_URL: string | undefined;
      CACHE_TTL_SECONDS: number;
    };
    renderUrl: (relativeUrl: string) => Promise<string>;
  }
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Place here your custom code!
  void fastify.register(import("@fastify/env"), {
    dotenv: true,
    schema: {
      type: "object",
      required: ["PUPPETEER_EXECUTABLE_PATH", "STATIC_SITE_DIR", "SITE_URL"],
      properties: {
        PUPPETEER_EXECUTABLE_PATH: {
          type: "string",
        },
        SITE_URL: {
          type: "string"
        },
        STATIC_SITE_DIR: {
          type: "string"
        },
        EXECUTE_JOB_ON_START: {
          type: "boolean"
        },
        DATABASE_URL: {
          type: "string"
        },
        CACHE_TTL_SECONDS: {
          type: "number",
          default: 43200
        }
      },
    },
  });

  // Add a hook to capture User-Agent on each request
  fastify.addHook('onRequest', async (request, reply) => {
    const userAgent = request.headers['user-agent'] || 'unknown';
    request.log.info({ userAgent }, 'Incoming request with User-Agent');
  })

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: opts,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  // eslint-disable-next-line no-void
  void fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
  });
};

export default app;
export { app, options };
