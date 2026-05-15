import { validateConfigResponse } from "utils/config/validate";

export default async function handler(req, res) {
  res.send(validateConfigResponse());
}
