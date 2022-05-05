<script lang="ts">
  import { asyncable, ready } from "$lib";

  const store = asyncable(
    async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return "Some Data";
    },
    async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return "New Real";
    }
  );

  setTimeout(() => {
    store.update();
  }, 2000);
  setTimeout(() => {
    store.set("New Optimistic");
  }, 4000);
</script>

<table>
  <th> Strategy 1 </th>
  <th> Strategy 2 </th>
  <tr>
    <!-- Strategy 1 -->
    <td>
      {#if ready($store)}
        {$store}
      {:else}
        <!-- Is shown only the first time -->
        Loading
      {/if}
    </td>

    <!-- Strategy 2 -->
    <td>
      {#await $store}
        <!-- Is shown every time a new data starts loading -->
        Loading
      {:then data}
        {data}
      {/await}
    </td>
  </tr>
</table>

<style>
  table,
  th,
  td {
    padding: 1rem;
    border: solid 1px black;
    border-collapse: collapse;
  }
</style>
