import { NextResponse, type NextRequest } from "next/server";
import { SHELL_COOKIE } from "@/lib/flags";

/** Opt this browser in or out of the QAShift 2.0 workspace shell. */
export function GET(req: NextRequest) {
  const on = req.nextUrl.searchParams.get("on") !== "0";
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  if (on) res.cookies.set(SHELL_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax", httpOnly: true, secure: req.nextUrl.protocol === "https:" });
  else res.cookies.delete(SHELL_COOKIE);
  return res;
}
