/**
 * Who runs Racik and how to reach them, for /privasi and /syarat.
 *
 * FOUNDER: CHECK EVERY VALUE HERE BEFORE LAUNCH.
 *  - OPERATOR_NAME: the person or company legally responsible for the data
 *    (UU PDP "pengendali data pribadi"). "Racik" is a placeholder: use your
 *    legal name or your PT/CV name.
 *  - CONTACT_EMAIL: a real inbox you read. Play Console and UU PDP requests
 *    (access, deletion) arrive here. Placeholder until set.
 *  - SUPABASE_REGION: Supabase dashboard › Project Settings › General ›
 *    Region. Placeholder until checked.
 *  - EFFECTIVE_DATE: change it whenever the policy text changes.
 */
export const LEGAL = {
  OPERATOR_NAME: "Racik",
  CONTACT_EMAIL: "privasi@racik.online",
  SUPABASE_REGION: "Singapura",
  EFFECTIVE_DATE: "22 Oktober 2026",
  SITE: "racik.online",
} as const;
