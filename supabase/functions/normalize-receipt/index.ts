Deno.serve(() => {
  return Response.json({
    source: "mock",
    message: "normalize-receipt stub is ready for a future Anthropic-backed implementation.",
  });
});

