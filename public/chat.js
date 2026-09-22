/**
 * OnlineFacilePro AI
 * Frontend Chat
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [
	{
		role: "assistant",
		content:
			"Ciao! 👋 Sono l'assistente AI di OnlineFacilePro. Posso aiutarti con AI, ChatGPT, strumenti digitali, lavoro online, TikTok, e-commerce, affiliate marketing e prodotti digitali. Cosa vuoi sapere?",
	},
];

let isProcessing = false;

userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (event) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);

async function sendMessage() {
	const message = userInput.value.trim();

	if (message === "" || isProcessing) {
		return;
	}

	isProcessing = true;

	userInput.disabled = true;
	sendButton.disabled = true;

	addMessageToChat("user", message);

	userInput.value = "";
	userInput.style.height = "auto";

	typingIndicator.classList.add("visible");

	chatHistory.push({
		role: "user",
		content: message,
	});

	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
			}),
		});

		if (!response.ok) {
			throw new Error(
				"Errore HTTP: " + response.status
			);
		}

		const data = await response.json();

		console.log("RISPOSTA COMPLETA DAL WORKER:", data);

		const responseText = extractResponseText(data);

		if (!responseText) {
			console.error(
				"Formato risposta non riconosciuto:",
				data
			);

			throw new Error(
				"L'AI non ha restituito testo."
			);
		}

		addMessageToChat(
			"assistant",
			responseText
		);

		chatHistory.push({
			role: "assistant",
			content: responseText,
		});
	} catch (error) {
		console.error("Errore chat:", error);

		addMessageToChat(
			"assistant",
			"Mi dispiace, si è verificato un errore. Riprova tra qualche secondo."
		);
	} finally {
		typingIndicator.classList.remove("visible");

		isProcessing = false;

		userInput.disabled = false;
		sendButton.disabled = false;

		userInput.focus();
	}
}

/**
 * Cerca il testo della risposta in tutti
 * i formati possibili restituiti dall'AI.
 */
function extractResponseText(data) {
	if (!data) {
		return "";
	}

	if (
		typeof data.response === "string" &&
		data.response.trim()
	) {
		return data.response;
	}

	if (
		data.response &&
		typeof data.response === "object"
	) {
		const nestedResponse =
			extractResponseText(data.response);

		if (nestedResponse) {
			return nestedResponse;
		}
	}

	if (
		data.result &&
		typeof data.result === "object"
	) {
		const resultResponse =
			extractResponseText(data.result);

		if (resultResponse) {
			return resultResponse;
		}
	}

	if (
		Array.isArray(data.choices) &&
		data.choices.length > 0
	) {
		const choice = data.choices[0];

		if (
			choice.message &&
			typeof choice.message.content === "string"
		) {
			return choice.message.content;
		}

		if (
			choice.delta &&
			typeof choice.delta.content === "string"
		) {
			return choice.delta.content;
		}
	}

	if (
		typeof data.text === "string" &&
		data.text.trim()
	) {
		return data.text;
	}

	if (typeof data === "object") {
		for (const key of Object.keys(data)) {
			const value = data[key];

			if (typeof value === "string") {
				if (
					value.trim() &&
					key !== "id" &&
					key !== "model"
				) {
					return value;
				}
			}

			if (
				value &&
				typeof value === "object"
			) {
				const found =
					extractResponseText(value);

				if (found) {
					return found;
				}
			}
		}
	}

	return "";
}

/**
 * Aggiunge un messaggio alla chat
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");

	messageEl.className =
		`message ${role}-message`;

	const paragraph =
		document.createElement("p");

	paragraph.textContent = content;

	messageEl.appendChild(paragraph);

	chatMessages.appendChild(messageEl);

	chatMessages.scrollTop =
		chatMessages.scrollHeight;
}

/**
 * DOMANDA PROVENIENTE DALLA HOME
 *
 * Se la Home apre:
 * https://ai.onlinefacilepro.it/?q=...
 *
 * la domanda viene inserita automaticamente
 * e inviata all'AI.
 */
document.addEventListener("DOMContentLoaded", function () {
	const params = new URLSearchParams(window.location.search);
	const question = params.get("q");

	if (!question || !question.trim()) {
		return;
	}

	const decodedQuestion = question.trim();

	userInput.value = decodedQuestion;

	userInput.style.height = "auto";
	userInput.style.height = userInput.scrollHeight + "px";

	setTimeout(function () {
		sendMessage();
	}, 400);
});
