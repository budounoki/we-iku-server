export function requireSessionSecret(env) {
  const secret = env?.SESSION_SECRET;

  if (typeof secret !== "string" || secret.trim() === "") {
    throw new Error("Session secret is required.");
  }

  return secret;
}