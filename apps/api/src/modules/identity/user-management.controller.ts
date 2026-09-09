import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsEmail, IsIn, IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";
import { UserRole, UserStatus } from "../../prisma/generated/client";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Roles } from "./decorators/roles.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { UserManagementService } from "./user-management.service";
import type { ManagedUser } from "./user-management.service";
import type { AuthenticatedUser } from "./authenticated-user";

export class CreateUserDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(12) @MaxLength(1024) password!: string;
  @IsIn(["admin", "content_manager", "sales_expert", "customer"]) role!: string;
}
export class UpdateUserDto {
  @IsIn(["admin", "content_manager", "sales_expert", "customer"]) role!: string;
  @IsIn(["active", "disabled"]) status!: string;
  @IsInt() @Min(0) revision!: number;
}
@Controller("admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UserManagementController {
  constructor(private readonly users: UserManagementService) {}
  @Get(":id")
  @Header("Cache-Control", "no-store")
  get(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<Omit<ManagedUser, "role" | "status"> & { role: string; status: string }> {
    return this.users.get(id).then(wireUser);
  }
  @Post()
  @Header("Cache-Control", "no-store")
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: CreateUserDto,
  ): Promise<Omit<ManagedUser, "role" | "status"> & { role: string; status: string }> {
    return this.users
      .create(actor.id, { ...input, role: input.role.toUpperCase() as UserRole })
      .then(wireUser);
  }
  @Patch(":id")
  @Header("Cache-Control", "no-store")
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: UpdateUserDto,
  ): Promise<Omit<ManagedUser, "role" | "status"> & { role: string; status: string }> {
    return this.users
      .update(actor.id, id, {
        ...input,
        role: input.role.toUpperCase() as UserRole,
        status: input.status.toUpperCase() as UserStatus,
      })
      .then(wireUser);
  }
}

function wireUser(
  user: ManagedUser,
): Omit<ManagedUser, "role" | "status"> & { role: string; status: string } {
  return { ...user, role: user.role.toLowerCase(), status: user.status.toLowerCase() };
}
