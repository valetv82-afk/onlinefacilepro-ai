import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/google/gemma-4-26b-a4b-it";

const SYSTEM_PROMPT = `
Sei l'assistente AI ufficiale di OnlineFacilePro.

Rispondi sempre in italiano, in modo chiaro, semplice, utile e concreto.

Puoi aiutare gli utenti con:

- intelligenza artificiale
- ChatGPT
- strumenti AI
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
		_ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		if (url.pathname === "/api/chat") {
			if (request.method !== "POST") {
				return new Response("Metodo non consentito", {
					status: 405,
				});
			}

			return handleChatRequest(request, env);
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

		const messages = [...(body.messages ?? [])];

		if (!messages.some((message) => message.role === "system")) {
			messages.unshift({
				role: "system",
				content: SYSTEM_PROMPT,
			});
		}

		const result = await env.AI.run(MODEL_ID, {
			messages,
			max_tokens: 512,
			stream: false,
		});

		return Response.json(result);
	} catch (error) {
		console.error("Errore Workers AI:", error);

		return Response.json(
			{
				error:
					"Si è verificato un errore durante l'elaborazione della richiesta.",
			},
			{
				status: 500,
			},
		);
	}
}
