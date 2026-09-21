/**
 * OnlineFacilePro AI - Frontend Chat
 */

// Elementi della pagina
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Cronologia della conversazione
let chatHistory = [
	{
		role: "assistant",
		content:
			"Ciao! 👋 Sono l'assistente AI di OnlineFacilePro. Posso aiutarti con AI, ChatGPT, strumenti digitali, lavoro online, TikTok, e-commerce, affiliate marketing e prodotti digitali. Cosa vuoi sapere?",
	},
];

let isProcessing = false;

// Ridimensiona automaticamente il campo di testo
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

// Invio con Enter
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Pulsante Invia
sendButton.addEventListener("click", sendMessage);

/**
 * Invia il messaggio all'AI
 */
async function sendMessage() {
	const message = userInput.value.trim();

	if (message === "" || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// Mostra messaggio dell'utente
	addMessageToChat("user", message);

	// Svuota campo
	userInput.value = "";
	userInput.style.height = "auto";

	// Mostra indicatore
	typingIndicator.classList.add("visible");

	// Aggiunge il messaggio alla cronologia
	chatHistory.push({
		role: "user",
		content: message,
	});

	let responseText = "";

	try {
		// Crea il contenitore della risposta AI
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = "<p></p>";

		chatMessages.appendChild(assistantMessageEl);

		const assistantTextEl = assistantMessageEl.querySelector("p");

		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Invia richiesta al Worker
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
			}),
		});

		// Controllo risposta
		if (!response.ok) {
			throw new Error("Errore nella risposta del server");
		}

		if (!response.body) {
			throw new Error("Risposta del server vuota");
		}

		// Lettura dello streaming
		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";
		let sawDone = false;

		const flushAssistantText = () => {
			assistantTextEl.textContent = responseText;
			chatMessages.scrollTop = chatMessages.scrollHeight;
		};

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				// Elabora eventuali dati rimasti nel buffer
				const parsed = consumeSseEvents(buffer + "\n\n");

				for (const data of parsed.events) {
					if (data === "[DONE]") {
						sawDone = true;
						break;
					}

					try {
						const jsonData = JSON.parse(data);

						let content = "";

						if (
							typeof jsonData.response === "string" &&
							jsonData.response.length > 0
						) {
							content = jsonData.response;
						} else if (
							jsonData.choices?.[0]?.delta?.content
						) {
							content =
								jsonData.choices[0].delta.content;
						}

						if (content) {
							responseText += content;
							flushAssistantText();
						}
					} catch (e) {
						console.warn(
							"Dati SSE non elaborati:",
							data,
						);
					}
				}

				break;
			}

			// Decodifica il blocco ricevuto
			buffer += decoder.decode(value, {
				stream: true,
			});

			const parsed = consumeSseEvents(buffer);

			buffer = parsed.buffer;

			for (const data of parsed.events) {
				if (data === "[DONE]") {
					sawDone = true;
					buffer = "";
					break;
				}

				try {
					const jsonData = JSON.parse(data);

					let content = "";

					// Formato Cloudflare Workers AI
					if (
						typeof jsonData.response === "string" &&
						jsonData.response.length > 0
					) {
						content = jsonData.response;
					}
					// Formato compatibile OpenAI
					else if (
						jsonData.choices?.[0]?.delta?.content
					) {
						content =
							jsonData.choices[0].delta.content;
					}

					if (content) {
						responseText += content;
						flushAssistantText();
					}
				} catch (e) {
					console.warn(
						"Dati SSE non elaborati:",
						data,
					);
				}
			}

			if (sawDone) {
				break;
			}
		}

		// Salva la risposta nella cronologia
		if (responseText.length > 0) {
			chatHistory.push({
				role: "assistant",
				content: responseText,
			});
		}
	} catch (error) {
		console.error("Errore:", error);

		/*
		 * Se l'AI ha già iniziato a rispondere,
		 * non mostrare un falso messaggio di errore.
		 */
		if (responseText.length === 0) {
			addMessageToChat(
				"assistant",
				"Mi dispiace, si è verificato un errore. Riprova tra qualche secondo.",
			);
		}
	} finally {
		// Nasconde indicatore
		typingIndicator.classList.remove("visible");

		// Riattiva input
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;

		userInput.focus();
	}
}

/**
 * Aggiunge un messaggio alla chat
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");

	messageEl.className = `message ${role}-message`;

	messageEl.innerHTML = `<p>${escapeHtml(content)}</p>`;

	chatMessages.appendChild(messageEl);

	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Protegge il testo inserito nell'HTML
 */
function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Elabora gli eventi SSE
 */
function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");

	const events = [];

	let eventEndIndex;

	while (
		(eventEndIndex = normalized.indexOf("\n\n")) !== -1
	) {
		const rawEvent = normalized.slice(
			0,
			eventEndIndex,
		);

		normalized = normalized.slice(
			eventEndIndex + 2,
		);

		const lines = rawEvent.split("\n");

		const dataLines = [];

		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(
					line.slice("data:".length).trimStart(),
				);
			}
		}

		if (dataLines.length === 0) continue;

		events.push(dataLines.join("\n"));
	}

	return {
		events,
		buffer: normalized,
	};
}
