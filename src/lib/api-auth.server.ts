export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export async function requireApiAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new ApiError("未登录或登录已过期", 401);
  }

  const token = auth.replace("Bearer ", "").trim();
  const { verifyToken, hasRole } = await import("@/lib/auth.server");
  let claims: { sub?: string; email?: string | null };
  try {
    claims = verifyToken(token);
  } catch {
    throw new ApiError("未登录或登录已过期", 401);
  }

  if (!claims.sub || !(await hasRole(claims.sub, "admin"))) {
    throw new ApiError("仅管理员可访问该接口", 403);
  }

  return { userId: claims.sub, email: claims.email ?? null };
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "服务器处理失败";
  return Response.json({ error: message }, { status: 500 });
}
