import { app } from "../api.ts";

app.get("/session/new", (c) => {
    return c.json({ msg: "hi" });
});
