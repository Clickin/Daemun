export default async function handler(req, res) {
  return res.json({ revalidated: true });
}
