import { defaultDishes, blankDish } from "./data.js";

const STORAGE_KEY = "dishes";

function stripNewlines(d) {
  const out = { ...d };
  if (typeof out.germanText === "string")
    out.germanText = out.germanText.replaceAll("\n", " ");
  if (typeof out.englishText === "string")
    out.englishText = out.englishText.replaceAll("\n", " ");
  return out;
}

function loadInitialDishes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed))
        return parsed.map(migrateDish).map(stripNewlines);
    }
  } catch (e) {
    console.warn("Could not read dishes from localStorage", e);
  }
  return structuredClone(defaultDishes);
}

function splitTags(value) {
  const raw = Array.isArray(value) ? value : (value || "").split(",");
  return raw.map((t) => (t || "").trim().toLowerCase()).filter(Boolean);
}

// Pre-merge-fields dishes had separate germanTextBold/englishTextBold
// heading fields; fold them into the merged germanText/englishText as a
// leading **bold** line so old data (localStorage or imported JSON) keeps
// looking the same after the field merge.
function mergeBoldFields(bold, rest) {
  const b = (bold || "").trim();
  const r = (rest || "").trim();
  if (!b) return r;
  if (!r) return `**${b}**`;
  return `**${b}**\n${r}`;
}

function migrateDish(d) {
  if (!("germanTextBold" in d) && !("englishTextBold" in d)) return d;
  const { germanTextBold, englishTextBold, ...rest } = d;
  return {
    ...rest,
    germanText: mergeBoldFields(germanTextBold, d.germanText),
    englishText: mergeBoldFields(englishTextBold, d.englishText),
  };
}

class LabelStore {
  dishes = $state(loadInitialDishes());
  cards = $state([]);
  search = $state("");
  categoryFilter = $state([]);
  tagFilter = $state([]);
  currentSort = $state("id");
  currentSortDir = $state("desc");

  get filteredDishes() {
    const q = this.search.toLowerCase();
    return this.dishes.filter((dish) => {
      if (this.categoryFilter.length || this.tagFilter.length) {
        const matchesCategory =
          this.categoryFilter.length &&
          this.categoryFilter.includes(dish.category);
        const dishTags = dish.tags || [];
        const matchesTag =
          this.tagFilter.length &&
          this.tagFilter.every((t) => dishTags.includes(t));
        if (!matchesCategory && !matchesTag) return false;
      }
      if (!q) return true;
      return (
        (dish.germanText || "").replaceAll("**", "").replaceAll("\n", " ").toLowerCase().includes(q) ||
        (dish.englishText || "").replaceAll("**", "").replaceAll("\n", " ").toLowerCase().includes(q) ||
        (dish.category || "").toLowerCase().includes(q) ||
        (dish.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }

  get sortedDishes() {
    const modifier = this.currentSortDir === "desc" ? -1 : 1;
    const key = this.currentSort;
    return [...this.filteredDishes].sort((a, b) => {
      if (key === "german") {
        return (
          (a.germanText || "").localeCompare(b.germanText || "") * modifier
        );
      } else if (key === "english") {
        return (
          (a.englishText || "").localeCompare(b.englishText || "") * modifier
        );
      } else if (key === "tags") {
        return (
          (a.tags ? a.tags.join(",") : "").localeCompare(
            b.tags ? b.tags.join(",") : "",
          ) * modifier
        );
      } else if (key === "category") {
        return (a.category || "").localeCompare(b.category || "") * modifier;
      } else {
        if (a[key] < b[key]) return -1 * modifier;
        if (a[key] > b[key]) return 1 * modifier;
        return 0;
      }
    });
  }

  // The most recently added dish, shown separately above the database table
  // regardless of the active sort/search/category/tag filters.
  get latestDish() {
    if (!this.dishes.length) return null;
    return this.dishes.reduce((max, d) => (d.id > max.id ? d : max));
  }

  get categories() {
    return [
      ...new Set(this.dishes.map((d) => d.category).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  get tags() {
    return [...new Set(this.dishes.flatMap((d) => d.tags || []))].sort(
      (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }

  toggleCategoryFilter(category) {
    const i = this.categoryFilter.indexOf(category);
    if (i === -1) this.categoryFilter.push(category);
    else this.categoryFilter.splice(i, 1);
  }

  toggleTagFilter(tag) {
    const i = this.tagFilter.indexOf(tag);
    if (i === -1) this.tagFilter.push(tag);
    else this.tagFilter.splice(i, 1);
  }

  clearFilters() {
    this.categoryFilter = [];
    this.tagFilter = [];
  }

  sort(name) {
    if (name === this.currentSort) {
      this.currentSortDir = this.currentSortDir === "asc" ? "desc" : "asc";
    }
    this.currentSort = name;
  }

  getLastId() {
    return this.dishes.length
      ? Math.max(...this.dishes.map((d) => d.id))
      : 0;
  }

  addDish(formDish) {
    const id = this.getLastId() + 1;
    this.dishes.push({ ...formDish, id, tags: splitTags(formDish.tags) });
    this.persist();
  }

  updateDish(id, formDish) {
    const index = this.dishes.findIndex((d) => d.id === id);
    if (index === -1) return;
    this.dishes[index] = { ...formDish, id, tags: splitTags(formDish.tags) };
    this.persist();
  }

  deleteDish(id) {
    this.dishes = this.dishes.filter((d) => d.id !== id);
    this.persist();
  }

  addToCards(dishId, multiply = false) {
    const dish = this.dishes.find((d) => d.id === dishId);
    if (!dish) return;
    const count = multiply ? 6 : 1;
    for (let i = 0; i < count; i++) this.cards.push(dish);
  }

  addAllToCards() {
    this.filteredDishes.forEach((dish) => this.cards.push(dish));
  }

  deleteCard(idx) {
    this.cards.splice(idx, 1);
  }

  deleteAllCards() {
    this.cards = [];
  }

  replaceDishes(arr) {
    this.dishes = arr
      .map(migrateDish)
      .map((d) => ({ ...d, tags: splitTags(d.tags) }));
    this.persist();
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.dishes));
  }
}

export const store = new LabelStore();
export { blankDish };
