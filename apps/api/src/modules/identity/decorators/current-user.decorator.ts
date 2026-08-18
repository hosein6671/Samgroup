import { ExecutionContext, createParamDecorator } from "@nestjs/common";

import { AUTHENTICATED_USER } from "../authenticated-user";

import type { AuthenticatedUser, RequestWithUser } from "../authenticated-user";

/**
 * The authenticated caller, for a handler that runs behind `JwtAuthGuard`.
 *
 * The value is the one the guard read from `sam_platform` on this request — never a token claim,
 * and never anything the client sent. It is keyed by a symbol rather than by `request.user`, so no
 * middleware or library can put a value where this decorator would find it.
 *
 * **Throws rather than returning `undefined`** when no guard has run. A handler that forgot
 * `@UseGuards(JwtAuthGuard)` would otherwise receive `undefined` and, in the usual shape
 * (`user.role === …`), fail closed by accident on some branches and open on others. Failing at the
 * first request is louder and cannot be misread.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request[AUTHENTICATED_USER];

    if (user === undefined) {
      throw new Error(
        "@CurrentUser() was used on a handler that is not behind JwtAuthGuard — no authenticated " +
          "user is attached to this request.",
      );
    }

    return user;
  },
);
