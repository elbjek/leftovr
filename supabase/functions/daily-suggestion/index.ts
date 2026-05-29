Deno.serve(() => {
  return Response.json({
    source: "mock",
    message: "daily-suggestion stub is ready for future push notification generation.",
  });
});

