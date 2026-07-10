type SlackApiResponse = { ok: boolean; error?: string; channel?: { id: string }; ts?: string };

function getBotToken(): string | null {
  return process.env.SLACK_BOT_TOKEN ?? null;
}

async function callSlackApi<T extends SlackApiResponse>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getBotToken();
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T;
  if (!json.ok) {
    throw new Error(`Slack ${method} failed: ${json.error ?? res.status}`);
  }
  return json;
}

async function callSlackFormApi<T extends SlackApiResponse>(
  method: string,
  payload: Record<string, string>,
): Promise<T> {
  const token = getBotToken();
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");

  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value) form.set(key, value);
  }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json()) as T;
  if (!json.ok) {
    throw new Error(`Slack ${method} failed: ${json.error ?? res.status}`);
  }
  return json;
}

export async function openDmChannel(userId: string): Promise<string> {
  const json = await callSlackApi<{ ok: boolean; channel?: { id: string }; error?: string }>(
    "conversations.open",
    { users: userId },
  );
  if (!json.channel?.id) throw new Error("Slack conversations.open returned no channel");
  return json.channel.id;
}

export async function postChannelMessage(
  channel: string,
  text: string,
): Promise<string | undefined> {
  if (!getBotToken()) return undefined;
  const json = await callSlackApi<{ ok: boolean; ts?: string; error?: string }>(
    "chat.postMessage",
    { channel, text },
  );
  return json.ts;
}

export async function openDmAndPost(
  userIds: string[],
  text: string,
): Promise<void> {
  if (!getBotToken()) return;
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const userId of unique) {
    const channel = await openDmChannel(userId);
    await postChannelMessage(channel, text);
  }
}

function sanitizePdfFileName(fileName: string): string {
  let name = fileName.trim() || "panel-export.pdf";
  name = name.replace(/[^\w.\-()+ ]+/g, "_");
  if (!/\.pdf$/i.test(name)) name += ".pdf";
  return name;
}

export async function uploadPdfToChannel(
  channelId: string,
  pdfBytes: Uint8Array,
  fileName: string,
  initialComment?: string,
): Promise<string | undefined> {
  if (!getBotToken()) return undefined;
  const safeName = sanitizePdfFileName(fileName);

  const getUrlJson = await callSlackFormApi<{
    ok: boolean;
    upload_url?: string;
    file_id?: string;
    error?: string;
  }>("files.getUploadURLExternal", {
    filename: safeName,
    length: String(pdfBytes.length),
  });

  if (!getUrlJson.upload_url || !getUrlJson.file_id) {
    throw new Error("Slack files.getUploadURLExternal returned no upload_url");
  }

  const uploadForm = new FormData();
  uploadForm.append(
    "file",
    new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" }),
    safeName,
  );
  uploadForm.append("filename", safeName);

  const uploadRes = await fetch(getUrlJson.upload_url, {
    method: "POST",
    body: uploadForm,
  });
  if (!uploadRes.ok) {
    throw new Error(`Slack external file upload failed: HTTP ${uploadRes.status}`);
  }

  const completePayload: Record<string, string> = {
    files: JSON.stringify([{ id: getUrlJson.file_id, title: safeName }]),
    channel_id: channelId,
  };
  if (initialComment?.trim()) {
    completePayload.initial_comment = initialComment.trim();
  }

  const completeJson = await callSlackFormApi<{
    ok: boolean;
    files?: { id: string }[];
    error?: string;
  }>("files.completeUploadExternal", completePayload);

  return completeJson.files?.[0]?.id ?? getUrlJson.file_id;
}

export async function uploadPdfToUsers(
  userIds: string[],
  pdfBytes: Uint8Array,
  fileName: string,
  initialComment?: string,
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const userId of unique) {
    const channel = await openDmChannel(userId);
    await uploadPdfToChannel(channel, pdfBytes, fileName, initialComment);
  }
}
