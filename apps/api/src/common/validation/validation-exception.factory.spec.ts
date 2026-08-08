import { IsEmail, IsInt, IsNotEmpty, ValidateNested, validateSync } from "class-validator";
import { Type } from "class-transformer";

import { ErrorCode } from "../http/error-code";
import { validationExceptionFactory } from "./validation-exception.factory";

class Address {
  @IsNotEmpty()
  city!: string;
}

class Contact {
  @IsEmail()
  email!: string;

  @IsInt()
  age!: number;

  @ValidateNested()
  @Type(() => Address)
  address!: Address;
}

function errorsFor(contact: Partial<Contact>): ReturnType<typeof validateSync> {
  return validateSync(Object.assign(new Contact(), { address: new Address() }, contact));
}

describe("validationExceptionFactory", () => {
  it("reports VALIDATION_ERROR with a 400", () => {
    const exception = validationExceptionFactory(errorsFor({}));

    expect(exception.getStatus()).toBe(400);
    expect(exception.code).toBe(ErrorCode.ValidationError);
  });

  it("names every failing field", () => {
    const exception = validationExceptionFactory(errorsFor({ email: "not-an-email" }));
    const fields = exception.details?.map((detail) => detail.field) ?? [];

    expect(fields).toContain("email");
    expect(fields).toContain("age");
  });

  it("builds a dotted path for a nested field", () => {
    const exception = validationExceptionFactory(errorsFor({ email: "a@b.com", age: 30 }));

    expect(exception.details).toEqual([
      { field: "address.city", issue: expect.stringContaining("should not be empty") },
    ]);
  });

  it("omits details entirely when there is nothing field-level to report", () => {
    expect(validationExceptionFactory([]).details).toBeUndefined();
  });
});
