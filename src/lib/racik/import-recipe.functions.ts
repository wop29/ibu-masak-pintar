import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  linkOrTextImport,
  photoImport,
  quotaStatus,
  resumeStatus,
  uploadImport,
} from "./import-pipeline";
import type { ImportResult, ResumeResult } from "./import-shared";
import type { QuotaInfo } from "./import-quota";

/*
 * Tambah Resep server functions. Thin on purpose: each handler hands over to
 * import-pipeline.ts, which the TanStack compiler strips from the browser
 * bundle together with the handler bodies. Shared helpers and types are
 * re-exported here for existing imports.
 */
export {
  canonicalUrl,
  isMediaHostAllowed,
  looksLikeMediaUrl,
  MAX_CAPTION_CHARS,
  MAX_MEDIA_BYTES,
  MIN_CAPTION_CHARS,
  mp4DurationSeconds,
  uploadMime,
  youtubeVideoId,
} from "./import-shared";
export type { ImportResult, ResumeResult } from "./import-shared";

const identitySchema = {
  deviceId: z.string().max(64).optional().catch(undefined),
  token: z.string().max(4_000).optional().catch(undefined),
  requestId: z.string().max(64).optional().catch(undefined),
  negara: z.enum(["ID", "MY", "PH"]).optional().catch(undefined),
};

const linkInput = z.object({
  url: z.string().max(2_000).optional().catch(undefined),
  caption: z.string().optional().catch(undefined),
  listen: z.boolean().optional().catch(undefined),
  ...identitySchema,
});
type LinkInput = z.infer<typeof linkInput>;

// Validators never throw: a bad input becomes an Indonesian message, not a Zod dump.
export const importRecipeFromVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): LinkInput => {
    const parsed = linkInput.safeParse(input);
    return parsed.success ? parsed.data : {};
  })
  .handler(({ data }): Promise<ImportResult> => linkOrTextImport(data));

export const importRecipeFromUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => (input instanceof FormData ? input : new FormData()))
  .handler(({ data }): Promise<ImportResult> => uploadImport(data));

export const importRecipeFromPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => (input instanceof FormData ? input : new FormData()))
  .handler(({ data }): Promise<ImportResult> => photoImport(data));

const identityInput = (input: unknown) => {
  const parsed = z.object(identitySchema).safeParse(input);
  return parsed.success ? parsed.data : {};
};

/** For the sheet's "Sisa 7 dari 10 bulan ini". */
export const getImportQuota = createServerFn({ method: "POST" })
  .inputValidator(identityInput)
  .handler(({ data }): Promise<{ disabled: boolean; quota: QuotaInfo | null }> =>
    quotaStatus(data),
  );

/** After a reload mid-import: pick up the finished recipe. */
export const resumeImport = createServerFn({ method: "POST" })
  .inputValidator(identityInput)
  .handler(({ data }): Promise<ResumeResult> => resumeStatus(data));
