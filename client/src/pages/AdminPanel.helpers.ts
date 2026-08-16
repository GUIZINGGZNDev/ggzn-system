export type AdminRule = { id: string; text: string; enabled: boolean };
export type AdminAutoReply = { trigger: string; response: string; enabled: boolean };

export function replaceRule(rules: AdminRule[], id: string, text: string): AdminRule[] {
  return rules.map((rule) => rule.id === id ? { ...rule, text } : rule);
}

export function toggleRule(rules: AdminRule[], id: string): AdminRule[] {
  return rules.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule);
}

export function toggleAutoReply(replies: AdminAutoReply[], trigger: string): AdminAutoReply[] {
  return replies.map((reply) => reply.trigger === trigger ? { ...reply, enabled: !reply.enabled } : reply);
}

export function removeAutoReply(replies: AdminAutoReply[], trigger: string): AdminAutoReply[] {
  return replies.filter((reply) => reply.trigger !== trigger);
}
