import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { listBotGroups, getOrCreateGroup, updateGroupConfig } from "./db";
import { cloneGroup } from "./bot/manager";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  botAdmin: router({
    listGroups: adminProcedure.query(() => listBotGroups()),
    getGroup: adminProcedure.input(z.object({ jid: z.string().min(1).max(191) })).query(({ input }) => getOrCreateGroup(input.jid)),
    updateGroup: adminProcedure.input(z.object({
      jid: z.string().min(1).max(191),
      rules: z.array(z.object({ id: z.string(), text: z.string().min(1).max(240), enabled: z.boolean() })).max(100),
      autoReplies: z.array(z.object({ trigger: z.string().min(1).max(40), response: z.string().min(1).max(500), enabled: z.boolean() })).max(100),
      featureConfig: z.object({ slowmodeSeconds: z.number().int().min(0).max(3600), antiFlood: z.boolean(), blockLinks: z.boolean(), logs: z.boolean(), warnings: z.record(z.string(), z.array(z.string())) }),
    })).mutation(({ input }) => updateGroupConfig(input.jid, { rules: input.rules, autoReplies: input.autoReplies, featureConfig: input.featureConfig }).then(() => ({ success: true }))),
    cloneGroup: adminProcedure.input(z.object({ sourceJid: z.string().regex(/@g\\.us$/), includeParticipants: z.boolean(), confirmation: z.literal("CLONAR") })).mutation(({ input }) => cloneGroup(input.sourceJid, { includeParticipants: input.includeParticipants })),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
