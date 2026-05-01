import { $, on } from "../lib/dom.js";
import { createStore } from "../lib/storage.js";

/**
 * Flashcards (interactive)
 * - Card flips on click
 * - Next / Previous navigation
 *
 * Implements the user-provided snippet shape:
 * - let currentCard = 0;
 * - renderCard(cards)
 * - flipCard()
 */
export function initFlashcards() {
  // Works with either the requested minimal markup (#flashcard)
  // or the existing richer viewer (#flashcardBtn + #flashcardInner + #fcQ/#fcA).
  const flashcardMount = document.getElementById("flashcard");
  const flashcardBtn = $("#flashcardBtn");
  const flashcardInner = $("#flashcardInner");
  const fcQ = $("#fcQ");
  const fcA = $("#fcA");
  const meta = $("#flashcardMeta");
  const prevBtn = $("#prevCardBtn");
  const nextBtn = $("#nextCardBtn");

  if (!flashcardMount && !flashcardBtn) return;

  const store = createStore("swn.flashcards", {
    // fallback sample cards until doc processing is wired
    cards: [
      { question: "What topic are you studying?", answer: "Write a one-sentence goal for the next 25 minutes." },
      { question: "What is active recall?", answer: "Testing yourself instead of rereading." },
    ],
  });

  let currentCard = 0;

  function getCards() {
    const { cards } = store.get();
    return Array.isArray(cards) && cards.length ? cards : [];
  }

  function setMeta(cards) {
    if (!meta) return;
    if (!cards.length) {
      meta.textContent = "No flashcards yet. Upload a document first.";
      return;
    }
    meta.textContent = `Card ${currentCard + 1} of ${cards.length}`;
  }

  function renderCard(cards) {
    const safe = Array.isArray(cards) ? cards : [];
    if (safe.length === 0) {
      if (fcQ) fcQ.textContent = "No cards yet.";
      if (fcA) fcA.textContent = "Upload a document to generate flashcards.";
      if (flashcardMount) flashcardMount.innerHTML = "";
      setMeta([]);
      return;
    }

    currentCard = Math.max(0, Math.min(currentCard, safe.length - 1));
    const card = safe[currentCard];

    // Requested minimal markup path
    if (flashcardMount) {
      flashcardMount.innerHTML = `
        <div class="card-inner">
          <div class="front">${escapeHtml(card.question)}</div>
          <div class="back">${escapeHtml(card.answer)}</div>
        </div>
      `;
    }

    // Existing richer viewer path
    if (fcQ) fcQ.textContent = card.question;
    if (fcA) fcA.textContent = card.answer;

    // Reset flip state on navigation
    const inner = flashcardMount?.querySelector(".card-inner") || flashcardInner;
    if (inner) inner.classList.remove("flipped");

    setMeta(safe);
  }

  function flipCard() {
    const inner = flashcardMount?.querySelector(".card-inner") || flashcardInner;
    if (inner) inner.classList.toggle("flipped");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function go(delta) {
    const cards = getCards();
    if (!cards.length) return renderCard(cards);
    currentCard = (currentCard + delta + cards.length) % cards.length;
    renderCard(cards);
  }

  // Events
  if (flashcardBtn) on(flashcardBtn, "click", flipCard);
  if (flashcardMount) on(flashcardMount, "click", flipCard);
  if (prevBtn) on(prevBtn, "click", () => go(-1));
  if (nextBtn) on(nextBtn, "click", () => go(1));

  // Initial render
  renderCard(getCards());
}

