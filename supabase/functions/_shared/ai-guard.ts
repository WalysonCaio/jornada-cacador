export type GuardResult = {
  allowed: boolean;
  queued?: boolean;
  code?: string;
  job_id?: string;
  limit?: number;
  blocked_until?: string;
  resets_at?: string;
};

export async function claimAiRequest(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  kind: "analysis" | "assistant",
  documentId?: string,
  requestHash?: string,
): Promise<GuardResult> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_ai_request`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_kind: kind,
      p_document_id: documentId || null,
      p_request_hash: requestHash || null,
    }),
  });
  if (!response.ok) throw new Error(`AI_GUARD_${response.status}`);
  return await response.json();
}

export async function finishAiRequest(
  supabaseUrl: string,
  serviceKey: string,
  jobId: string | undefined,
  provider: string,
  status = "ready",
  errorCode?: string,
) {
  if (!jobId) return;
  await fetch(`${supabaseUrl}/rest/v1/rpc/finish_ai_request`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_job_id: jobId,
      p_provider: provider,
      p_status: status,
      p_error_code: errorCode || null,
    }),
  });
}

export function guardResponse(guard: GuardResult) {
  if (guard.queued) return {
    status: 409,
    body: {
      error: "Outra análise já está em andamento. Este arquivo entrou na fila e será o próximo.",
      code: "QUEUED",
      queued: true,
      job_id: guard.job_id,
    },
  };
  if (guard.code === "DAILY_LIMIT") return {
    status: 429,
    body: {
      error: `Você atingiu o limite diário de ${guard.limit} solicitações. O limite protege a cota gratuita e será renovado amanhã.`,
      code: "DAILY_LIMIT",
      limit: guard.limit,
      resets_at: guard.resets_at,
    },
  };
  return {
    status: 429,
    body: {
      error: "Muitas solicitações foram feitas em pouco tempo. O acesso à IA foi pausado temporariamente para proteger sua conta.",
      code: "TEMP_BLOCK",
      blocked_until: guard.blocked_until,
    },
  };
}
