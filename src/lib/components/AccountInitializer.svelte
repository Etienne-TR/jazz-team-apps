<script lang="ts">
  import { AccountCoState } from "jazz-tools/svelte";
  import { JazzAccount, Organization, Invitation, JoinRequest, co } from "$lib/schema";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {},
    },
  });
  const me = $derived(account.current);

  // Initialiser organizations pour les comptes existants
  $effect(() => {
    if (me?.root && !me.root.$jazz.has("organizations")) {
      me.root.$jazz.set("organizations", co.list(Organization).create([]));
    }
  });

  // Initialiser myInvitations pour les comptes existants
  $effect(() => {
    if (me?.root && !me.root.$jazz.has("myInvitations")) {
      me.root.$jazz.set("myInvitations", co.list(Invitation).create([]));
    }
  });

  // Initialiser myRequests pour les comptes existants
  $effect(() => {
    if (me?.root && !me.root.$jazz.has("myRequests")) {
      me.root.$jazz.set("myRequests", co.list(JoinRequest).create([]));
    }
  });
</script>
