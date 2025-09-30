<script lang="ts">
  import { JazzAccount, Organization, Activity, co } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";
  import { Group } from "jazz-tools";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: true,
    },
  });
  const me = $derived(account.current);

  // Initialiser organizations pour les comptes existants qui n'ont pas ce champ
  $effect(() => {
    if (me?.root && !me.root.$jazz.has("organizations")) {
      me.root.$jazz.set("organizations", co.list(Organization).create([]));
    }
  });

  const organizations = $derived(me?.root?.organizations);

  let newOrgName = $state("");

  function handleCreateOrganization() {
    if (!me?.root?.organizations || !newOrgName.trim()) return;

    const group = Group.create();
    group.addMember("everyone", "reader");

    const organization = Organization.create(
      {
        name: newOrgName.trim(),
        activities: co.list(Activity).create([], group),
      },
      group,
    );

    me.root.organizations.$jazz.push(organization);
    newOrgName = "";
  }
</script>

<div class="grid gap-6 mt-6">
  {#if me}
    <div class="grid gap-6">
      <!-- Formulaire de création -->
      <div class="border p-6 border-stone-200 rounded">
        <h2 class="text-xl font-semibold mb-4">Créer une organization</h2>
        <div class="flex gap-3">
          <input
            type="text"
            placeholder="Nom de l'organization..."
            class="border border-stone-300 rounded shadow-xs py-2 px-3 flex-1"
            bind:value={newOrgName}
            onkeydown={(e) => e.key === "Enter" && handleCreateOrganization()}
          />
          <button
            type="button"
            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onclick={handleCreateOrganization}
            disabled={!newOrgName.trim()}
          >
            Créer
          </button>
        </div>
      </div>

      <!-- Liste des organizations -->
      <div class="border p-6 border-stone-200 rounded">
        <h2 class="text-xl font-semibold mb-4">Organizations</h2>
        {#if organizations?.length}
          <ul class="space-y-2">
            {#each organizations as organization}
              {#if organization}
                <li class="p-3 border border-stone-200 rounded">
                  <div class="font-medium">{organization.name}</div>
                  {#if organization.activities?.length}
                    <div class="mt-2 text-sm text-stone-600">
                      {organization.activities.length} activité(s)
                    </div>
                  {/if}
                </li>
              {/if}
            {/each}
          </ul>
        {:else}
          <p class="text-stone-500 italic">Aucune organization pour le moment</p>
        {/if}
      </div>
    </div>
  {:else}
    <div class="border p-6 border-stone-200 rounded">
      <p class="text-stone-500">Chargement...</p>
    </div>
  {/if}
</div>
