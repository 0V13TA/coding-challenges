import html from "./index.html";

Bun.serve({
  port: 3000,
  routes: { "/": html },
  async fetch(req) {
    const file = Bun.file(`.${new URL(req.url).pathname}`);
    return (await file.exists())
      ? new Response(file)
      : new Response("404", { status: 404 });
  },
});
