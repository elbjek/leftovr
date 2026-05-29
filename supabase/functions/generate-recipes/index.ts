Deno.serve(() => {
  return Response.json({
    source: "mock",
    message: "generate-recipes stub is ready for a future Anthropic-backed implementation.",
  });
});

