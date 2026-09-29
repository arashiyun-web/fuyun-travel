// Minimal S3-compatible server for isolated tests of lib/operations/objectStore.ts.
// Path-style only (/bucket/key); supports PUT / HEAD / GET with x-amz-meta-* metadata and
// aws-chunked request bodies. It does NOT verify signatures — never use it outside tests.
// Usage: node scripts/test-support/s3-mock.mjs <port> <dataDir>
import http from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const [,, portArg = "9100", dataDir = path.resolve("s3-mock-data")] = process.argv;
mkdirSync(dataDir, { recursive: true });
const fileFor = (bucket, key) => path.join(dataDir, createHash("sha256").update(`${bucket}/${key}`).digest("hex"));

function decodeAwsChunked(buffer) {
  const out = [];
  let offset = 0;
  while (offset < buffer.length) {
    const lineEnd = buffer.indexOf("\r\n", offset);
    if (lineEnd < 0) break;
    const size = parseInt(buffer.subarray(offset, lineEnd).toString("latin1").split(";")[0], 16);
    offset = lineEnd + 2;
    if (!size) break;
    out.push(buffer.subarray(offset, offset + size));
    offset += size + 2;
  }
  return Buffer.concat(out);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const [, bucket, ...rest] = url.pathname.split("/");
  const key = decodeURIComponent(rest.join("/"));
  const file = fileFor(bucket, key);
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    if (req.method === "PUT" && key) {
      let body = Buffer.concat(chunks);
      if (String(req.headers["content-encoding"] || "").includes("aws-chunked") || String(req.headers["x-amz-content-sha256"] || "").startsWith("STREAMING")) body = decodeAwsChunked(body);
      const meta = Object.fromEntries(Object.entries(req.headers).filter(([h]) => h.startsWith("x-amz-meta-")));
      writeFileSync(file, body);
      writeFileSync(`${file}.json`, JSON.stringify({ contentType: req.headers["content-type"] || "application/octet-stream", meta, key }));
      res.writeHead(200, { ETag: `"${createHash("md5").update(body).digest("hex")}"` });
      return res.end();
    }
    if ((req.method === "GET" || req.method === "HEAD") && key) {
      if (!existsSync(file)) {
        res.writeHead(404, { "Content-Type": "application/xml" });
        return res.end(req.method === "HEAD" ? undefined : "<Error><Code>NoSuchKey</Code></Error>");
      }
      const body = readFileSync(file);
      const info = JSON.parse(readFileSync(`${file}.json`, "utf8"));
      res.writeHead(200, { "Content-Type": info.contentType, "Content-Length": body.length, ...info.meta });
      return res.end(req.method === "HEAD" ? undefined : body);
    }
    res.writeHead(400);
    res.end();
  });
});
server.listen(Number(portArg), "127.0.0.1", () => console.log(`s3-mock listening on 127.0.0.1:${portArg}`));
