/*
* AI Crawler Traffic Worker
* Enables crawler logs by sending request data to Lumentir for analysis.
*/

// Allow only URLs or specific file types
const ALLOWED_EXT = /\.(html?|txt)$/i;

export default {

  async fetch(request, env, ctx) {

    try {
      const { pathname, search } = new URL(request.url);

      // Check if pathname has a file extension
      const hasExtension = /\.[^/]+$/.test(pathname);

      // Skip if it has an extension that is NOT allowed
      if (hasExtension && !ALLOWED_EXT.test(pathname)) {
        return fetch(request);
      }

      // Upstream request
      const response = await fetch(request);

      // Log HTML pages and txt files
      const contentType = response.headers.get("content-type").split(";")[0];
      if ((!['text/html', 'text/plain'].includes(contentType)) || response.status >= 600) {
        return response;
      }

      // Account variables
      const account = 1005;
      const project = 'e1b17573-075f6b26-6f9a';
      const region = 'eu1.s1.1';

      const country =
      request.cf && request.cf.country
        ? request.cf.country.toLowerCase()
        : null;

      const lang = (() => {
        const h = request.headers.get("Accept-Language");
        if (!h) return null;
        return h.split(",")[0].trim().toLowerCase().split("-")[0];
      })();

      const user_agent = request.headers.get("User-Agent") || null;

      // Analytics object
      const log = {
        account: account,
        project: project,
        db: region,
        status_code: response.status,
        method: request.method,
        url: request.url.length > 2000 ? request.url.slice(0, 2000) : request.url,
        user_agent: user_agent,
        referrer: request.headers.get("Referer") || null,
        country: country,
        lang: lang
      };

      const checkSignatures = ["Meta-ExternalAgent","Meta-ExternalFetcher","Bytespider","ChatGPT-User","Claude-Searchbot","Claude-User","Claudebot","Google-CloudVertexBot","GPTbot","MistralAI-User","OAI-SearchBot","PerplexityUser","PerplexityBot"
      ];
      
      const initialCheck = checkSignatures.some(sig =>
        user_agent.toLowerCase().includes(sig.toLowerCase())
      );

      // If it is an AI bot, upload analytics.
      // This never delays the visitor
      if(initialCheck) {
        ctx.waitUntil(
          fetch('https://data.ai-traffic-worker.com/collect?log_type=crawlers', {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(log),
          }).catch((err) => {
            console.error('Lumentir Worker Error', err);
          }), // swallow network errors
        );
      }

      return response;
    } catch(err) {
      console.error("General Worker Error:", err);
      return fetch(request);
    }
  },
};