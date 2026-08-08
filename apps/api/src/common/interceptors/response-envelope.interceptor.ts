import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import type { ApiSuccessResponse } from "../http/api-response.types";
import { isResponseWithMeta } from "../http/with-meta";

/**
 * Wraps every successful handler return in the `{data, meta}` envelope
 * (API_DESIGN.md §Request/Response Envelope), so no controller composes it by hand and no
 * endpoint can quietly answer in a different shape.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor<
  unknown,
  ApiSuccessResponse<unknown>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(
      map((payload) => {
        if (isResponseWithMeta(payload)) {
          return { data: payload.data, meta: payload.meta };
        }

        // A void handler must still answer with the contracted key present, so `undefined`
        // becomes an explicit null rather than a `data`-less body.
        return { data: payload ?? null, meta: {} };
      }),
    );
  }
}
