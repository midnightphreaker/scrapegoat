import { trpc } from "$lib/api/trpc";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  let library = null;

  try {
    const libraries = await trpc.listLibraries.query();
    library =
      libraries.find((l) => l.name.toLowerCase() === params.name.toLowerCase()) || null;
  } catch {
    // API not available - return null, page will handle gracefully
  }

  return {
    library,
    name: params.name,
  };
};
