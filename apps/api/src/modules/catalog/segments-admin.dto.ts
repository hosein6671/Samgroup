import { MaxLength, MinLength, IsString, Matches } from "class-validator";

/**
 * ADR-026: the admin supplies a name only. The slug is derived server-side
 * (`segments-admin.service.ts`'s `slugifyName`), never taken from the request — see that ADR's
 * "Alternatives Considered" for why this deliberately differs from `BlogReferenceCreate`, which
 * takes a client-supplied slug.
 */
export class SegmentCreate {
  @IsString() @MinLength(1) @MaxLength(60) @Matches(/\S/) name!: string;
}
