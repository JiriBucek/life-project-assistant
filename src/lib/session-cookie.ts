/**
 * The session cookie's name, and nothing else.
 *
 * This lives apart from session.ts on purpose. Proxy runs in the Edge runtime,
 * where Prisma cannot load — importing the full session module there would pull
 * the database client into the edge bundle and crash the server on boot. Proxy
 * only ever needs to know what the cookie is called, so that one string lives
 * in a module with no dependencies at all.
 */
export const SESSION_COOKIE = "luma_session";
