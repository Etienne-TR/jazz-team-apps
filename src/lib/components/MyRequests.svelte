<script lang="ts">
  import { JazzAccount, Organization } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        myRequests: true,
      },
    },
  });
  const me = $derived(account.current);

  let showArchived = $state(false);

  // État pour stocker les demandes avec leurs organisations
  let loadedRequests = $state<Array<{
    request: any;
    organizationName: string;
  }>>([]);

  // Charger les organisations de manière asynchrone
  $effect(() => {
    const loadOrganizations = async () => {
      if (!me?.root?.myRequests) return;

      const requests: Array<{
        request: any;
        organizationName: string;
      }> = [];

      for (const request of me.root.myRequests) {
        if (!request) continue;

        try {
          // Charger l'organisation pour obtenir son nom
          let organizationName = "Organisation inconnue";

          if (request.organizationId) {
            const organization = await Organization.load(request.organizationId, {});
            if (organization?.name) {
              organizationName = organization.name;
            }
          }

          requests.push({
            request,
            organizationName,
          });
        } catch (e) {
          console.log("⚠️ [MyRequests] Cannot load organization:", e);
          requests.push({
            request,
            organizationName: "Organisation inconnue",
          });
        }
      }

      loadedRequests = requests;
    };

    loadOrganizations();
  });

  // Filtrer les demandes selon le toggle
  const visibleRequests = $derived(
    showArchived
      ? loadedRequests
      : loadedRequests.filter(item => !item.request.archivedAt)
  );

  function archiveRequest(request: any) {
    try {
      request.$jazz.set("archivedAt", new Date());
      console.log("Request archived");
    } catch (error) {
      console.error("Failed to archive request:", error);
    }
  }

  function unarchiveRequest(request: any) {
    try {
      request.$jazz.delete("archivedAt");
      console.log("Request unarchived");
    } catch (error) {
      console.error("Failed to unarchive request:", error);
    }
  }
</script>

{#if loadedRequests.length > 0}
  <div class="border p-6 border-stone-200 rounded">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">
        Mes demandes d'accès ({visibleRequests.length}{#if !showArchived && loadedRequests.length > visibleRequests.length}/{loadedRequests.length}{/if})
      </h2>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          bind:checked={showArchived}
          class="rounded"
        />
        <span>Afficher les archives</span>
      </label>
    </div>
    <ul class="space-y-3">
      {#each visibleRequests as { request, organizationName }}
        {@const status = request.status}
        {@const isArchived = !!request.archivedAt}
        {@const borderColor = isArchived ? "border-stone-300" : (status === "approved" ? "border-green-200" : status === "rejected" ? "border-red-200" : "border-orange-200")}
        {@const bgColor = isArchived ? "bg-stone-50" : (status === "approved" ? "bg-green-50" : status === "rejected" ? "bg-red-50" : "bg-orange-50")}
        {@const statusLabel = status === "approved" ? "Approuvée" : status === "rejected" ? "Refusée" : "En attente"}
        {@const statusBadgeColor = status === "approved" ? "bg-green-600 text-white" : status === "rejected" ? "bg-red-600 text-white" : "bg-orange-600 text-white"}
        <li class="p-4 border {borderColor} {bgColor} rounded">
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <div class="font-medium">
                  Demande pour rejoindre "{organizationName}"
                </div>
                <span class="text-xs px-2 py-1 rounded {statusBadgeColor}">
                  {statusLabel}
                </span>
                {#if isArchived}
                  <span class="text-xs px-2 py-1 rounded bg-stone-600 text-white">
                    Archivée
                  </span>
                {/if}
              </div>
              <div class="text-sm text-stone-600 mt-1">
                Envoyée le {new Date(request.createdAt).toLocaleDateString()} à {new Date(request.createdAt).toLocaleTimeString()}
              </div>
              {#if isArchived}
                <div class="text-sm text-stone-600 mt-1">
                  Archivée le {new Date(request.archivedAt).toLocaleDateString()} à {new Date(request.archivedAt).toLocaleTimeString()}
                </div>
              {/if}
            </div>
            <div class="flex gap-2">
              {#if isArchived}
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-stone-600 text-white rounded hover:bg-stone-700 transition-colors"
                  onclick={() => unarchiveRequest(request)}
                >
                  Désarchiver
                </button>
              {:else}
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-stone-600 text-white rounded hover:bg-stone-700 transition-colors"
                  onclick={() => archiveRequest(request)}
                >
                  Archiver
                </button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
    {#if visibleRequests.length === 0 && !showArchived}
      <p class="text-stone-500 text-sm mt-4">
        Aucune demande active. {#if loadedRequests.length > 0}Cochez "Afficher les archives" pour voir les demandes archivées.{/if}
      </p>
    {/if}
  </div>
{/if}
