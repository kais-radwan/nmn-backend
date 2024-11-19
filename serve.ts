import { app } from "./api.ts";

Deno.serve(app.fetch);
