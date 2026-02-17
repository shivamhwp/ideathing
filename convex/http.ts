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
    ["sign"],
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
  body: string,
): Promise<boolean> => {
  const computed = await computeHmacSha256(secret, body);
  const computedWithPrefix = `sha256=${computed}`;
  return timingSafeEqual(signature, computedWithPrefix);
};

const normalizeNotionId = (id: string): string => id.replace(/-/g, "");

type WebhookPayload = {
  type?: string;
  entity?: { id?: string; type?: string };
  data?: {
    parent?: { id?: string; type?: string };
    updated_blocks?: Array<{ id?: string; type?: string }>;
  };
  authors?: Array<{ type?: string; id?: string }>;
  workspace_id?: string;
  verification_token?: string;
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

    let payload: WebhookPayload;
    console.log(body);
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (payload.verification_token) {
      return new Response("ok", { status: 200 });
    }

    const eventType = payload.type;
    const entityType = payload.entity?.type;
    const entityId = payload.entity?.id;
    const parentId = payload.data?.parent?.id;
    const parentType = payload.data?.parent?.type;
    const workspaceId = payload.workspace_id;

    if (eventType?.startsWith("database.") || eventType?.startsWith("data_source.")) {
      const dataSourceId = entityId;
      if (dataSourceId) {
        await ctx.scheduler.runAfter(0, internal.notion.actions.syncFromDataSource, {
          dataSourceId,
          workspaceId,
          eventType,
        });
      }
      return new Response("ok", { status: 200 });
    }

    if (entityType !== "page" || !entityId) {
      return new Response("ok", { status: 200 });
    }

    const pageId = entityId;
    const normalizedPageId = normalizeNotionId(pageId);

    let idea = await ctx.runQuery(internal.notion.queries.getIdeaByNotionPageId, {
      notionPageId: pageId,
    });

    if (!idea) {
      idea = await ctx.runQuery(internal.notion.queries.getIdeaByNotionPageId, {
        notionPageId: normalizedPageId,
      });
    }
    if (idea) {
      const mode = await ctx.runQuery(internal.mode.queries.getModeForScopeInternal, {
        organizationId: idea.organizationId,
        userId: idea.userId,
      });
      if (mode !== "theo") {
        return new Response("ok", { status: 200 });
      }
    }

    switch (eventType) {
      case "page.properties_updated":
      case "page.content_updated":
      case "page.moved":
        if (idea) {
          await ctx.scheduler.runAfter(0, internal.notion.actions.syncIdeaFromNotionPage, {
            notionPageId: pageId,
            ideaId: idea._id,
            organizationId: idea.organizationId,
          });
        } else if (parentId && parentType === "database") {
          await ctx.scheduler.runAfter(0, internal.notion.actions.createIdeaFromNotionPage, {
            notionPageId: pageId,
            databaseId: parentId,
          });
        }
        break;

      case "page.created":
        if (idea) {
          await ctx.scheduler.runAfter(0, internal.notion.actions.syncIdeaFromNotionPage, {
            notionPageId: pageId,
            ideaId: idea._id,
            organizationId: idea.organizationId,
          });
        } else if (parentId && parentType === "database") {
          await ctx.scheduler.runAfter(0, internal.notion.actions.createIdeaFromNotionPage, {
            notionPageId: pageId,
            databaseId: parentId,
          });
        }
        break;

      case "page.deleted":
        if (idea) {
          await ctx.scheduler.runAfter(0, internal.notion.actions.handleNotionPageDeleted, {
            ideaId: idea._id,
            notionPageId: pageId,
          });
        }
        break;

      case "page.undeleted":
        if (idea) {
          await ctx.scheduler.runAfter(0, internal.notion.actions.syncIdeaFromNotionPage, {
            notionPageId: pageId,
            ideaId: idea._id,
            organizationId: idea.organizationId,
          });
        } else if (parentId && parentType === "database") {
          await ctx.scheduler.runAfter(0, internal.notion.actions.createIdeaFromNotionPage, {
            notionPageId: pageId,
            databaseId: parentId,
          });
        }
        break;

      case "page.locked":
      case "page.unlocked":
        break;

      default:
    }

    return new Response("ok", { status: 200 });
  }),
});

export default http;
