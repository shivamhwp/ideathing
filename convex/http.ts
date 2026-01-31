import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const getSignature = (request: Request) =>
  request.headers.get("notion-signature") ??
  request.headers.get("notion-webhook-signature") ??
  request.headers.get("x-notion-signature");

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const computeHmacSha256 = async (secret: string, message: string): Promise<string> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return bytesToHex(new Uint8Array(signature));
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const isValidSignature = async (
  signature: string,
  secret: string,
  body: string
): Promise<boolean> => {
  const computed = await computeHmacSha256(secret, body);
  const computedWithPrefix = `sha256=${computed}`;
  return timingSafeEqual(signature, computedWithPrefix);
};

http.route({
  path: "/notion/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = getSignature(request);
    const secret = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;

    if (secret) {
      if (!signature || !(await isValidSignature(signature, secret, body))) {
        return new Response("Invalid signature", { status: 401 });
      }
    }

    let payload: {
      type?: string;
      entity?: { id?: string; type?: string };
      verification_token?: string;
    };

    try {
      payload = JSON.parse(body);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (payload.verification_token) {
      console.log("Notion webhook verification token:", payload.verification_token);
      return new Response("ok", { status: 200 });
    }

    console.log("Webhook received:", payload.type, payload.entity?.id);

    const pageId = payload.entity?.type === "page" ? payload.entity?.id : undefined;
    if (pageId) {
      await ctx.scheduler.runAfter(0, internal.notion.syncIdeaFromNotionPage, {
        notionPageId: pageId,
      });
    }

    return new Response("ok", { status: 200 });
  }),
});

export default http;
