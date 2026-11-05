import { getSupabaseClient } from "@/lib/supabase";

// Recipe covers come from the recipe-cover edge function (OpenAI, shared by
// dish). One request per recipe per app session: the ideas list and the detail
// screen both ask, and must not pay for the same cover twice.
const requests = new Map<string, Promise<string | null>>();

export function requestRecipeCover(recipeId: string): Promise<string | null> {
  let request = requests.get(recipeId);
  if (!request) {
    request = getSupabaseClient()
      .functions.invoke("recipe-cover", { body: { recipeId } })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data as { path?: string } | null)?.path ?? null;
      })
      .catch((error) => {
        if (__DEV__) console.warn("[recipe-cover] failed", error);
        // Forget failures so a later open can try again.
        requests.delete(recipeId);
        return null;
      });
    requests.set(recipeId, request);
  }
  return request;
}

export function recipeCoverUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return getSupabaseClient().storage.from("recipe-covers").getPublicUrl(path).data.publicUrl;
}
