import { store } from "./store.svelte.js";
import { blankDish } from "./data.js";

const THEME_KEY = "theme";
const SWAP_LANGUAGES_COOKIE = "swapLanguages";

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=31536000; path=/`;
}

class UiStore {
  activeTab = $state("database");
  modalOpen = $state(false);
  modalInitial = $state(blankDish());
  confirm = $state(null); // { message, confirmLabel, danger, onConfirm }
  theme = $state(getInitialTheme());
  // Defaults to English-first when no preference has been saved yet.
  swapLanguages = $state(getCookie(SWAP_LANGUAGES_COOKIE) !== "false");

  constructor() {
    document.documentElement.setAttribute("data-theme", this.theme);
  }

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, this.theme);
    document.documentElement.setAttribute("data-theme", this.theme);
  }

  toggleSwapLanguages() {
    this.swapLanguages = !this.swapLanguages;
    setCookie(SWAP_LANGUAGES_COOKIE, String(this.swapLanguages));
  }

  openAddDish() {
    this.modalInitial = blankDish();
    this.modalOpen = true;
  }

  openEditDish(id) {
    const dish = store.dishes.find((d) => d.id === id);
    if (!dish) return;
    // dish is a $state proxy — snapshot it to a plain object before it
    // leaves the store, otherwise the modal's draft would share live
    // references (e.g. the allergens/diets arrays) with stored data.
    const snap = $state.snapshot(dish);
    this.modalInitial = {
      ...snap,
      tags: snap.tags ? [...snap.tags] : [],
    };
    this.modalOpen = true;
  }

  openCopyDish(id) {
    const dish = store.dishes.find((d) => d.id === id);
    if (!dish) return;
    const { id: _drop, ...rest } = $state.snapshot(dish);
    this.modalInitial = {
      ...rest,
      tags: rest.tags ? [...rest.tags] : [],
    };
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
  }

  saveDish(form) {
    if (form.id) store.updateDish(form.id, form);
    else store.addDish(form);
    this.modalOpen = false;
  }

  confirmDeleteDish(id) {
    this.confirm = {
      message: "Do you really want to delete this item?",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => store.deleteDish(id),
    };
  }

  confirmDeleteAllCards() {
    this.confirm = {
      message: "Do you really want to remove all labels?",
      confirmLabel: "Remove all",
      danger: true,
      onConfirm: () => store.deleteAllCards(),
    };
  }

  resolveConfirm(accepted) {
    if (accepted && this.confirm) this.confirm.onConfirm();
    this.confirm = null;
  }
}

export const ui = new UiStore();
