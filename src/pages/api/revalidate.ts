import { refreshStaticHome } from "../../server/static-home.ts";

export default async function handler(req, res) {
  await refreshStaticHome("api-revalidate");
  return res.json({ revalidated: true });
}
