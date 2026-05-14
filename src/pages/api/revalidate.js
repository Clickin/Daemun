import { refreshStaticHome } from "../../server/static-home.js";

export default async function handler(req, res) {
  await refreshStaticHome("api-revalidate");
  return res.json({ revalidated: true });
}
