<script>
  import Icon from "./Icon.svelte";
  import { store } from "./store.svelte.js";
  import { ui } from "./ui.svelte.js";
  import { saveDishesAsJSON, loadDishesFromFile } from "./io.js";
  import { generateLabelsPdf } from "./pdf.js";
  import { diets, allergens } from "./data.js";

  let fileInput;

  function triggerLoad() {
    fileInput.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await loadDishesFromFile(file);
    } catch (err) {
      alert("That file isn't valid Label Maker JSON.");
    }
    e.target.value = "";
  }

  async function handlePrint() {
    if (!store.cards.length) return;
    await generateLabelsPdf(store.cards, diets, allergens);
  }
</script>

<header class="app-header">
  <div class="container header-top">
    <h1>
      <img
        class="logo"
        src={`${import.meta.env.BASE_URL}icons/label-maker-icon-${ui.theme}.svg`}
        alt=""
        width="36"
        height="36"
      />
      <span class="logo-text">Label Maker</span>
    </h1>
    <div class="actions">
      <button
        class="btn btn-icon btn-ghost"
        title="Swap German/English columns"
        onclick={() => ui.toggleSwapLanguages()}
      >
        <Icon name="swap" />
      </button>
      <button
        class="btn btn-icon btn-ghost"
        title={ui.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onclick={() => ui.toggleTheme()}
      >
        <Icon name={ui.theme === "dark" ? "sun" : "moon"} />
      </button>
      <button
        class="btn btn-icon btn-success"
        title="Add dish"
        onclick={() => ui.openAddDish()}
      >
        <Icon name="plus" />
      </button>
      <input
        type="file"
        accept=".json"
        bind:this={fileInput}
        onchange={handleFileChange}
        hidden
      />
      <button
        class="btn btn-icon btn-primary"
        title="Load JSON"
        onclick={triggerLoad}
      >
        <Icon name="upload" />
      </button>
      <button
        class="btn btn-icon btn-primary"
        title="Save JSON"
        onclick={saveDishesAsJSON}
      >
        <Icon name="download" />
      </button>
      <button
        class="btn btn-icon btn-danger"
        title="Create PDF"
        disabled={!store.cards.length}
        onclick={handlePrint}
      >
        <Icon name="pdf" />
      </button>
    </div>
  </div>
  <div class="container header-bottom">
    <nav class="tabs">
      <button
        class="tab"
        class:active={ui.activeTab === "database"}
        onclick={() => (ui.activeTab = "database")}
      >
        Database <span class="badge badge-accent">{store.dishes.length}</span>
      </button>
      <button
        class="tab"
        class:active={ui.activeTab === "print"}
        onclick={() => (ui.activeTab = "print")}
      >
        Preview <span class="badge badge-danger">{store.cards.length}</span>
      </button>
    </nav>
    {#if ui.activeTab === "database"}
      <div class="search-wrap">
        <Icon name="search" size={16} />
        <input
          type="search"
          placeholder="Search dishes…"
          bind:value={store.search}
        />
        {#if store.search}
          <button
            class="clear-btn"
            onclick={() => (store.search = "")}
            aria-label="Clear search"
          >
            <Icon name="close" size={13} />
          </button>
        {/if}
      </div>
    {/if}
  </div>
</header>

<style>
  .app-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 1.1rem;
    padding-bottom: 0.85rem;
    gap: 1rem;
  }

  h1 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    color: var(--text);
  }

  .logo {
    flex-shrink: 0;
    border-radius: 50%;
  }

  .logo-text {
    font-variant-caps: small-caps;
    letter-spacing: 0.02em;
  }

  .actions {
    display: flex;
    gap: 0.4rem;
  }

  .header-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .tabs {
    display: flex;
    gap: 0.25rem;
    background: var(--surface-2);
    padding: 0.25rem;
    border-radius: var(--radius-sm);
  }

  .tab {
    border: none;
    background: transparent;
    color: var(--text-muted);
    padding: 0.4rem 0.85rem;
    border-radius: calc(var(--radius-sm) - 2px);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  .tab.active {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }

  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 220px;
    flex: 1 1 260px;
    max-width: 360px;
    padding: 0 0.6rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
  }

  .search-wrap input {
    border: none;
    background: transparent;
    padding: 0.5rem 0.1rem;
    box-shadow: none !important;
  }

  .search-wrap input:focus {
    box-shadow: none !important;
  }

  .clear-btn {
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    padding: 0.2rem;
  }

  .clear-btn:hover {
    color: var(--text);
  }

  @media (max-width: 640px) {
    .header-top {
      flex-wrap: wrap;
    }

    .actions {
      margin-left: auto;
    }
  }
</style>
