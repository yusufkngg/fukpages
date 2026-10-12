import { createApp } from "../server/index.mjs";
import { createFixtureService } from "./fixtures/shopify.mjs";
if (process.env.NODE_ENV !== "test")
  throw new Error("Theme fixture server is test-only");
const { app } = createApp({ shopify: createFixtureService() });
app.listen(Number(process.env.PORT), "127.0.0.1");
