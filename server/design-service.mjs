export function createDesignService({
  apiKey = process.env.FUKPAGES_AI_API_KEY,
  model = process.env.AI_MODEL || "gpt-4.1-mini",
  fetchImpl = fetch,
} = {}) {
  return {
    configured: !!apiKey,
    model,
    async generate({ prompt, image, brand }) {
      if (!apiKey)
        throw Object.assign(
          new Error(
            "AI sağlayıcısı yapılandırılmadı. FUKPAGES_AI_API_KEY güvenli ortam ayarı gerekli.",
          ),
          { status: 503 },
        );
      const schema =
        '{"schemaVersion":1,"type":"landing","name":"Design","nodes":[{"id":"unique-id","kind":"section","name":"Section","props":{},"styles":{"desktop":{},"tablet":{},"mobile":{}},"hidden":{"desktop":false,"tablet":false,"mobile":false},"children":[]}]}';
      const content = [
        { type: "text", text: String(prompt).slice(0, 3000) },
        ...(image
          ? [{ type: "image_url", image_url: { url: image, detail: "high" } }]
          : []),
      ];
      const response = await fetchImpl(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `Return only a valid FukPages PageDocument JSON, following this structure: ${schema}. Make editable nested sections using section,row,column,box,heading,text,image,button,divider. Never include JavaScript or claim real stock/reviews. Use supplied image URLs only. Rich text uses html; image uses src,alt; button text,href. CSS values are strings, no background-image URLs. Brand: ${JSON.stringify(brand)}. Give desktop/tablet/mobile overrides. Each ID unique. When an image is given recreate its layout with editable blocks; do not return a single flattened screenshot.`,
              },
              { role: "user", content },
            ],
          }),
        },
      );
      if (!response.ok)
        throw Object.assign(
          new Error(`AI hizmeti isteği tamamlanamadı (${response.status}).`),
          { status: 502 },
        );
      const data = await response.json();
      try {
        return JSON.parse(data.choices[0].message.content);
      } catch {
        throw Object.assign(
          new Error("AI yanıtı geçerli tasarım JSON’u değil."),
          { status: 502 },
        );
      }
    },
  };
}
