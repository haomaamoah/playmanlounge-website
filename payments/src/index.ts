import { handleRequest } from "./handler.ts";
import type { Env } from "./theteller.ts";

const worker = {
  fetch(request: Request, env: Env) {
    return handleRequest(request, env);
  },
};

export default worker;
