import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
export type Identity = {
  tenantId: string;
  ownerId: string;
  role: "writer" | "reader";
};
export type AuthRequest = Request & { identity: Identity };
const identities = new Map<string, Identity>([
  ["alice-demo", { tenantId: "tenant-a", ownerId: "alice", role: "writer" }],
  ["bob-demo", { tenantId: "tenant-b", ownerId: "bob", role: "writer" }],
  [
    "alice-readonly-demo",
    { tenantId: "tenant-a", ownerId: "alice", role: "reader" },
  ],
]);
@Injectable()
export class IdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const value = req.headers.authorization;
    const identity = value?.startsWith("Bearer ")
      ? identities.get(value.slice(7))
      : undefined;
    if (!identity) throw new UnauthorizedException();
    if (req.method !== "GET" && identity.role !== "writer")
      throw new ForbiddenException();
    req.identity = identity;
    return true;
  }
}
