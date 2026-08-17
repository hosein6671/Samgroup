/* Payload's REST API, mounted as a route of this application — see the note in ../../layout.tsx.
 *
 * The only intended caller is NestJS's Content module, server-to-server, authenticated with a
 * service API key (API_CONTRACT_FINAL.md §4). `apps/web` and the browser never reach it, and no
 * verb below is anonymously usable: the Users and Pages collections both refuse an unauthenticated
 * request (src/access.ts).
 *
 * GraphQL is disabled in the config, so no graphql route file exists here.
 */
import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
} from "@payloadcms/next/routes";

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const OPTIONS = REST_OPTIONS(config);
