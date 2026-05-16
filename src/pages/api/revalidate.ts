import { refreshStaticHome } from "../../server/static-home.ts";
import { clearServiceLookupCache } from "utils/config/service-helpers";

export default async function handler(req, res) {
  clearServiceLookupCache();
  await refreshStaticHome("api-revalidate");
  return res.json({ revalidated: true });
}
