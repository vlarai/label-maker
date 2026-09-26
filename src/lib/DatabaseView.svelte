<script>
  import Icon from "./Icon.svelte";
  import { store } from "./store.svelte.js";
  import { ui } from "./ui.svelte.js";
  import { parseBoldLines } from "./richText.js";

  let columns = $derived(
    ui.swapLanguages
      ? [
          { key: "id", label: "ID" },
          { key: "english", label: "English" },
          { key: "german", label: "German" },
          { key: "category", label: "Category" },
          { key: "tags", label: "Tags" },
        ]
      : [
          { key: "id", label: "ID" },
          { key: "german", label: "German" },
          { key: "english", label: "English" },
          { key: "category", label: "Category" },
          { key: "tags", label: "Tags" },
        ],
  );

  function sortIcon(col) {
    if (store.currentSort !== col) return "sort";
    return store.currentSortDir === "asc" ? "sortUp" : "sortDown";
  }

  let activeFilterCount = $derived(
    store.categoryFilter.length + store.tagFilter.length,
  );

  let filterOpen = $state(false);
  let filterMenuEl = $state();

  function onDocClick(e) {
    if (filterOpen && filterMenuEl && !filterMenuEl.contains(e.target)) {
      filterOpen = false;
    }
  }
</script>

<svelte:window onclickcapture={onDocClick} />

{#snippet tableCols()}
  <colgroup>
    <col class="col-id" />
    <col style="width: 32%" />
    <col style="width: 32%" />
    <col style="width: 16%" />
    <col style="width: 20%" />
    <col class="col-actions" />
  </colgroup>
{/snippet}

{#snippet germanCell(dish)}
  <td data-label="German">
    {#each parseBoldLines(dish.germanText) as line, i}
      {#if i > 0}<br />{/if}
      {#each line as run}
        {#if run.bold}<strong>{run.text}</strong>{:else}{run.text}{/if}
      {/each}
    {/each}
  </td>
{/snippet}

{#snippet englishCell(dish)}
  <td data-label="English">
    {#each parseBoldLines(dish.englishText) as line, i}
      {#if i > 0}<br />{/if}
      {#each line as run}
        {#if run.bold}<strong>{run.text}</strong>{:else}{run.text}{/if}
      {/each}
    {/each}
  </td>
{/snippet}

{#snippet dishRow(dish, pinned)}
  <tr class:pinned>
    <td class="col-id" data-label="ID">{dish.id}</td>
    {#if ui.swapLanguages}
      {@render englishCell(dish)}
      {@render germanCell(dish)}
    {:else}
      {@render germanCell(dish)}
      {@render englishCell(dish)}
    {/if}
    <td data-label="Category">{dish.category}</td>
    <td data-label="Tags">{dish.tags?.length ? dish.tags.join(", ") : ""}</td>
    <td class="col-actions">
      <div class="row-actions">
        <button
          class="btn btn-icon btn-danger"
          title="Delete"
          onclick={() => ui.confirmDeleteDish(dish.id)}
        >
          <Icon name="trash" size={15} />
        </button>
        <button
          class="btn btn-icon btn-warning"
          title="Duplicate"
          onclick={() => ui.openCopyDish(dish.id)}
        >
          <Icon name="copy" size={15} />
        </button>
        <button
          class="btn btn-icon btn-primary"
          title="Edit"
          onclick={() => ui.openEditDish(dish.id)}
        >
          <Icon name="edit" size={15} />
        </button>
        <button
          class="btn btn-icon btn-success"
          title="Add to preview (shift-click for ×6)"
          onclick={(e) => store.addToCards(dish.id, e.shiftKey)}
        >
          <Icon name="plus" size={15} />
        </button>
      </div>
    </td>
  </tr>
{/snippet}

<div class="toolbar">
  <div class="hint">
    <Icon name="tag" size={14} /> Always print the PDF at 100% scale — card dimensions
    are calibrated to the physical stock.
  </div>
  <div class="toolbar-actions">
    {#if store.categories.length || store.tags.length}
      <div class="filter-menu" bind:this={filterMenuEl}>
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => (filterOpen = !filterOpen)}
        >
          <Icon name="filter" size={14} /> Filter
          {#if activeFilterCount}
            <span class="badge badge-accent">{activeFilterCount}</span>
          {/if}
        </button>
        {#if filterOpen}
          <div
            class="filter-panel card-surface"
            role="presentation"
            onkeydown={(e) => e.key === "Escape" && (filterOpen = false)}
          >
            {#if activeFilterCount}
              <button
                type="button"
                class="btn btn-ghost clear-filters"
                onclick={() => store.clearFilters()}
              >
                <Icon name="close" size={13} /> Clear filters
              </button>
            {/if}
            {#if store.categories.length}
              <div class="filter-group">
                <h4>Category</h4>
                <div class="chip-row">
                  {#each store.categories as cat}
                    <button
                      type="button"
                      class="filter-chip"
                      class:active={store.categoryFilter.includes(cat)}
                      onclick={() => store.toggleCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
            {#if store.tags.length}
              <div class="filter-group">
                <h4>Tags</h4>
                <div class="chip-row">
                  {#each store.tags as tag}
                    <button
                      type="button"
                      class="filter-chip"
                      class:active={store.tagFilter.includes(tag)}
                      onclick={() => store.toggleTagFilter(tag)}
                    >
                      {tag}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
    <button
      class="btn btn-success"
      disabled={!store.filteredDishes.length}
      onclick={() => store.addAllToCards()}
    >
      <Icon name="plus" size={16} /> Add all to preview
    </button>
  </div>
</div>

{#if store.latestDish}
  <div class="table-wrap latest-wrap card-surface">
    <table>
      {@render tableCols()}
      <tbody>
        {@render dishRow(store.latestDish, true)}
      </tbody>
    </table>
  </div>
{/if}

<div class="table-wrap list-wrap card-surface">
  <table>
    {@render tableCols()}
    <thead>
      <tr>
        {#each columns as col}
          <th class="sortable" onclick={() => store.sort(col.key)}>
            <span>{col.label}</span>
            <Icon name={sortIcon(col.key)} size={13} />
          </th>
        {/each}
        <th class="col-actions">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#if store.sortedDishes.length}
        {#each store.sortedDishes as dish (dish.id)}
          {@render dishRow(dish, false)}
        {/each}
      {:else}
        <tr
          ><td colspan={columns.length + 1} class="empty-row">No dishes yet.</td
          ></tr
        >
      {/if}
    </tbody>
  </table>
</div>

<style>
  .toolbar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    margin: 1.25rem 0;
  }

  .hint {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: var(--text-muted);
    background: var(--surface-2);
    padding: 0.45rem 0.75rem;
    border-radius: var(--radius-sm);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-panel {
    position: absolute;
    z-index: 20;
    top: calc(100% + 0.4rem);
    right: 0;
    width: min(320px, 100%);
    max-height: 60vh;
    overflow-y: auto;
    padding: 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .filter-group h4 {
    margin: 0 0 0.5rem;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .filter-chip {
    font-size: 0.8rem;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      color 120ms ease,
      background-color 120ms ease;
  }

  .filter-chip:hover {
    color: var(--text);
  }

  .filter-chip.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--surface-2));
    color: var(--accent);
  }

  .clear-filters {
    align-self: flex-start;
    font-size: 0.8rem;
    padding: 0.4rem 0.7rem;
  }

  .table-wrap {
    overflow-x: auto;
    margin-bottom: 2rem;
  }

  .list-wrap {
    overflow-y: auto;
    /* Leaves room for the fixed app footer below the viewport. */
    max-height: calc(100vh - 21rem);
  }

  .latest-wrap {
    margin: 1.25rem 0;
  }

  table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.88rem;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 6;
    height: 2.5rem;
    text-align: left;
    background: var(--surface-2);
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.7rem 0.9rem;
    white-space: nowrap;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
    display: table-cell;
  }

  th.sortable span {
    margin-right: 0.15rem;
  }

  th.sortable:hover {
    color: var(--text);
  }

  td {
    padding: 0.65rem 0.9rem;
    border-top: 1px solid var(--border);
    vertical-align: top;
    overflow-wrap: break-word;
  }

  .col-id {
    color: var(--text-muted);
    width: 4rem;
  }

  tr.pinned {
    background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  }

  tr.pinned:hover {
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  }

  .col-actions {
    width: 11rem;
    text-align: center;
    white-space: nowrap;
  }

  .row-actions {
    display: inline-flex;
    gap: 0.3rem;
  }

  .empty-row {
    text-align: center;
    color: var(--text-muted);
    padding: 2rem;
  }

  tbody tr:hover {
    background: var(--surface-2);
  }

  @media (max-width: 640px) {
    .table-wrap {
      overflow-x: visible;
    }

    table,
    thead,
    tbody,
    tr,
    td {
      display: block;
    }

    thead {
      display: none;
    }

    tbody tr {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
      margin-bottom: 0.75rem;
      padding: 0.6rem 0.9rem;
    }

    tbody tr:hover {
      background: var(--surface);
    }

    td {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.15rem;
      width: auto;
      padding: 0.4rem 0;
      border-top: none;
      border-bottom: 1px solid var(--border);
    }

    td:last-child {
      border-bottom: none;
    }

    .col-id {
      display: none;
    }

    td::before {
      content: attr(data-label);
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }

    .col-actions {
      text-align: right;
    }

    .col-actions::before {
      content: none;
    }

    .row-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .empty-row {
      display: block;
      padding: 2rem 0.9rem;
    }
  }
</style>
