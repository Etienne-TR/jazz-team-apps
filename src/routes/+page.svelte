<script lang="ts">
  import Form from "$lib/components/Form.svelte";
  import Organizations from "$lib/components/Organizations.svelte";
  import { getUserAge, JazzAccount } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      profile: true,
      root: true,
    },
  });
  const me = $derived(account.current);
</script>

<div class="text-center">
  <h1>
    Welcome{#if me?.profile?.firstName}, {me?.profile.firstName}{/if}!
  </h1>
  {#if me?.root}
    <p>As of today, you are {getUserAge(me?.root)} years old.</p>
  {/if}
</div>

<Form />

<Organizations />
