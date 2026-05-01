import { initRouter } from "./ui/router.js";
import { initPomodoro } from "./features/pomodoro.js";
import { initTodos } from "./features/todos.js";
import { initAmbient } from "./features/ambient.js";
import { initNeroChat } from "./features/chat.js";
import { initFlashcardsUI } from "./features/flashcards.js";
import { initAuthUI } from "./ui/auth.js";
import { initFocusMode } from "./ui/focus.js";

(() => {
  "use strict";

  initRouter();
  initFocusMode();
  initPomodoro();
  initAmbient();
  initTodos();
  initNeroChat();

  initFlashcardsUI();
  initAuthUI();
})();

