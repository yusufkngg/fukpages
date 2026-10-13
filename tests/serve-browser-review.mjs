// Test-only transport fault: commit the first successful upload, then lose its HTTP response.
import { createServer } from "node:http";
import { createApp } from "../server/index.mjs";
if (process.env.NODE_ENV !== "test")
  throw new Error("Transport faults are restricted to the test fixture.");
const { app } = createApp();
let lost = false;
createServer((req, res) => {
  if (
    !lost &&
    req.method === "POST" &&
    /^\/api\/stores\/[^/]+\/assets$/.test(req.url)
  ) {
    const end = res.end;
    res.end = function (...args) {
      if (!lost && res.statusCode === 201) {
        lost = true;
        res.flushHeaders();
        res.write('{"results":');
        setImmediate(() => req.socket.destroy());
        return res;
      }
      return end.apply(this, args);
    };
  }
  app(req, res);
}).listen(Number(process.env.PORT), "127.0.0.1");
