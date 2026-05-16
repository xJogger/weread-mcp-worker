export function requireEnv(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment secret: ${name}`);
  }
  return value;
}

export function getSkillVersion(env: Pick<Env, "WEREAD_SKILL_VERSION">): string {
  return env.WEREAD_SKILL_VERSION?.trim() || "1.0.3";
}

export function getGatewayUrl(env: Pick<Env, "WEREAD_GATEWAY_URL">): string {
  return env.WEREAD_GATEWAY_URL?.trim() || "https://i.weread.qq.com/api/agent/gateway";
}
