import { localizedNotFoundResponse } from "@/lib/localized-not-found-response";

export function GET() {
  return localizedNotFoundResponse("vi");
}
