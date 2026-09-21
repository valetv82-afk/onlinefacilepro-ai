
import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/google/gemma-4-26b-a4b-it";

const SYSTEM_PROMPT = `
Sei l'assistente AI ufficiale di OnlineFacilePro.

Rispondi sempre in italiano, in modo chiaro, utile e concreto.

Puoi aiutare gli utenti con:
- intelligenza artificiale
- ChatGPT e strumenti AI
- strumenti digitali
- produttività
- TikTok e social media
- lavoro online
- e-commerce
- affiliate marketing
- prodotti digitali
- idee e opportunità nel mondo digitale

Non promettere guadagni facili o garantiti.
Non inventare informazioni.
Quando non sei sicuro di qualcosa, dichiaralo chiaramente.

Rispondi in modo sintetico ma completo.
Usa elenchi puntati quando rendono la risposta più facile da leggere.
`;

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		if (url.pathname === "/api/chat") {
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			return new Response("Metodo non consentito", {
				status: 405,
			});
		}

		return new Response("Pagina non trovata", {
			status: 404,
		});
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body = (await request.json()) as {
			messages?: ChatMessage[];
		};

		const messages = body.messages ?? [];

		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({
				role: "system",
				content: SYSTEM_PROMPT,
			});
		}

		const stream = await env.AI.run(
			MODEL_ID,
			{
				messages,
				max_tokens: 768,
				stream: true,
			},
		);

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Errore elaborazione richiesta AI:", error);

		return new Response(
			JSON.stringify({
				error: "Si è verificato un errore durante l'elaborazione della richiesta.",
			}),
			{
				status: 500,
				headers: {
					"content-type": "application/json; charset=utf-8",
				},
			},
		);
	}
}
