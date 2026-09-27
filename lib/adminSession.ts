import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/adminAuth";

/** Server components: the verified admin session token from the HttpOnly cookie, or null. */
export function adminSessionTokenFromCookies() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value || "";
  return token && verifyAdminToken(`Bearer ${token}`) ? token : null;
}
