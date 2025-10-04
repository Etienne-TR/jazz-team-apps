<script lang="ts">
  import { JazzAccount, JoinRequest, Organization, Invitation } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        myRequests: true,
        organizations: true,
      },
    },
  });
  const me = $derived(account.current);

  let showArchived = $state(false);

  const myRequests = $derived(me?.root?.myRequests || []);

  // État pour stocker les invitations et organisations chargées
  type RequestWithData = {
    request: any;
    invitation: any;
    organizationName: string;
  };
  let requestsWithInvitations = $state<RequestWithData[]>([]);

  // Charger les invitations et organisations pour chaque request
  $effect(() => {
    const loadInvitations = async () => {
      const loaded: RequestWithData[] = [];

      for (const request of myRequests) {
        if (!request || !request.invitationId) continue; // Skip old requests without invitationId

        try {
          const invitation = await Invitation.load(request.invitationId, {});
          if (!invitation) continue;

          // Charger l'organisation pour obtenir son nom
          let organizationName = "Organisation inconnue";
          if (invitation.organizationId) {
            try {
              const organization = await Organization.load(invitation.organizationId, {});
              if (organization?.name) {
                organizationName = organization.name;
              }
            } catch {
              // Keep default name
            }
          }

          loaded.push({ request, invitation, organizationName });
        } catch {
          // Skip requests with unavailable invitations
        }
      }

      requestsWithInvitations = loaded;
    };

    loadInvitations();
  });

  // Filtrer les demandes selon le toggle
  const visibleRequests = $derived(
    showArchived
      ? requestsWithInvitations
      : requestsWithInvitations.filter((item) => !item.request?.archivedAt),
  );

  async function addOrganizationToList(item: RequestWithData) {
    if (!item?.invitation?.organizationId || !me?.root?.organizations) return;

    try {
      // Charger l'organisation
      const organization = await Organization.load(item.invitation.organizationId, {});

      if (!organization) {
        alert("Organisation introuvable.");
        return;
      }

      // Vérifier si l'organisation n'est pas déjà dans la liste
      const alreadyExists = me.root.organizations.some(
        (org) => org?.$jazz.id === organization.$jazz.id,
      );

      if (alreadyExists) {
        alert("Cette organisation est déjà dans votre liste.");
        return;
      }

      // Ajouter l'organisation à la liste
      me.root.organizations.$jazz.push(organization);

      alert("Organisation ajoutée à votre liste !");
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'organisation:", error);
      alert("Erreur lors de l'ajout de l'organisation.");
    }
  }

  function archiveRequest(request: any) {
    try {
      request.$jazz.set("archivedAt", new Date());
    } catch {
      // Error silently handled
    }
  }

  function unarchiveRequest(request: any) {
    try {
      request.$jazz.delete("archivedAt");
    } catch {
      // Error silently handled
    }
  }
</script>

{#if requestsWithInvitations.length > 0}
  <div class="border p-6 border-stone-200 rounded">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">
        Mes demandes d'accès ({visibleRequests.length}{#if !showArchived && requestsWithInvitations.length > visibleRequests.length}/{requestsWithInvitations.length}{/if})
      </h2>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" bind:checked={showArchived} class="rounded" />
        <span>Afficher les archives</span>
      </label>
    </div>
    <ul class="space-y-3">
      {#each visibleRequests as { request, invitation, organizationName }}
        {@const status = request.status}
        {@const isArchived = !!request.archivedAt}
        {@const borderColor = isArchived
          ? "border-stone-300"
          : status === "approved"
            ? "border-green-200"
            : status === "rejected"
              ? "border-red-200"
              : "border-orange-200"}
        {@const bgColor = isArchived
          ? "bg-stone-50"
          : status === "approved"
            ? "bg-green-50"
            : status === "rejected"
              ? "bg-red-50"
              : "bg-orange-50"}
        {@const statusLabel =
          status === "approved" ? "Approuvée" : status === "rejected" ? "Refusée" : "En attente"}
        {@const statusBadgeColor =
          status === "approved"
            ? "bg-green-600 text-white"
            : status === "rejected"
              ? "bg-red-600 text-white"
              : "bg-orange-600 text-white"}
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
                  <span class="text-xs px-2 py-1 rounded bg-stone-600 text-white"> Archivée </span>
                {/if}
              </div>
              <div class="text-sm text-stone-600 mt-1">
                Envoyée le {new Date(request.createdAt).toLocaleDateString()} à {new Date(
                  request.createdAt,
                ).toLocaleTimeString()}
              </div>
              {#if isArchived}
                <div class="text-sm text-stone-600 mt-1">
                  Archivée le {new Date(request.archivedAt).toLocaleDateString()} à {new Date(
                    request.archivedAt,
                  ).toLocaleTimeString()}
                </div>
              {/if}
            </div>
            <div class="flex gap-2">
              {#if status === "approved" && !isArchived}
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  onclick={() => addOrganizationToList({ request, invitation, organizationName })}
                >
                  Ajouter à ma liste
                </button>
              {/if}
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
        Aucune demande active. {#if requestsWithInvitations.length > 0}Cochez "Afficher les archives"
          pour voir les demandes archivées.{/if}
      </p>
    {/if}
  </div>
{/if}
