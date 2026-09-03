import { createHmac, timingSafeEqual } from "node:crypto";

export const sessionCookieName = "kakeibo_session";

function getConfiguredPassword() {
  return process.env.KAKEIBO_LOGIN_PASSWORD ?? "";
}

function getSessionSecret() {
  return process.env.KAKEIBO_SESSION_SECRET ?? "";
}

export function isAuthenticationConfigured() {
  return Boolean(getConfiguredPassword() && getSessionSecret());
}

export function passwordMatches(password: string) {
  const expected = Buffer.from(getConfiguredPassword());
  const actual = Buffer.from(password);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionValue() {
  return createHmac("sha256", getSessionSecret())
    .update(`kakeibo:${getConfiguredPassword()}`)
    .digest("hex");
}

export function isAuthenticated(value: string | undefined) {
  if (!isAuthenticationConfigured() || !value) {
    return false;
  }

  const expected = Buffer.from(createSessionValue());
  const actual = Buffer.from(value);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
