import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

/**
 * The origin serving the current request. Link previews must carry absolute
 * URLs, and the host is never hardcoded, so previews keep working on whatever
 * domain the app is deployed to.
 */
export const requestOrigin = createIsomorphicFn()
  .client(() => window.location.origin)
  .server(() => getRequestUrl().origin);
