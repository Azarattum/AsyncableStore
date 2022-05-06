<script lang="ts">
  import { asyncable, ready } from "$lib";

  let logs = "[ACTION]: Initialized.\n";
  const delay = 2000;

  const parent = asyncable(
    async () => {
      logs += "  Parent starts loading.\n";
      await new Promise((r) => setTimeout(r, delay));
      logs += "  Parent loaded.\n";
      return "Some Data";
    },
    async () => {
      logs += "  Parent starts updating.\n";
      await new Promise((r) => setTimeout(r, delay));
      logs += "  Parent updated.\n";
      return "New Real";
    }
  );
  const child = asyncable(
    [parent, true],
    async (_, [data]) => {
      await new Promise((r) => setTimeout(r, delay / 10));
      logs += "  Child derived data.\n";
      return `Derived: ${data}`;
    },
    () => {}
  );

  setTimeout(() => {
    logs += "[ACTION]: Force parent update.\n";
    parent.update();
  }, delay * 2);
  setTimeout(() => {
    logs += "[ACTION]: Set parent value.\n";
    parent.set("New Optimistic");
  }, delay * 4);
  setTimeout(() => {
    logs += "[ACTION]: Set child value.\n";
    child.set("Update from child!");
  }, delay * 6);
</script>

<table>
  <th> Strategy 1 </th>
  <th> Strategy 2 </th>
  <tr>
    <!-- Strategy 1 -->
    <td>
      {#if ready($parent)}
        {$parent}
      {:else}
        <!-- Is shown only the first time -->
        Loading
      {/if}
    </td>

    <!-- Strategy 2 -->
    <td>
      {#await $parent}
        <!-- Is shown every time a new data starts loading -->
        Loading
      {:then data}
        {data}
      {/await}
    </td>
  </tr>
  <tr>
    <td>
      {#if ready($child)}
        {$child}
      {:else}
        Loading
      {/if}
    </td>
    <td>
      {#await $child}
        Loading
      {:then data}
        {data}
      {/await}
    </td>
  </tr>
</table>
<textarea type="text" bind:value={logs} />

<style>
  table,
  th,
  td {
    padding: 1rem;
    border: solid 1px black;
    border-collapse: collapse;
    min-width: 11rem;
  }
  textarea {
    padding: 1rem;
    min-width: 385px;
    min-height: 30rem;
  }
</style>
