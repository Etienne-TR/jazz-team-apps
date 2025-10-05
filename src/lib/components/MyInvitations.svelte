<script lang="ts">
  import { JazzAccount, Organization, Invitation } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        myInvitations: [
          {
            requests: { $each: { $onError: null } }, // Charger les requests avec gestion d'erreur
          },
        ],
      },
    },
  });
  const me = $derived(account.current);

  let copiedInviteId = $state<string | null>(null);
  let showArchived = $state(false);

  // État pour stocker les invitations avec leurs organisations et requests
  type LoadedRequest = {
    request: any;
    isArchived: boolean;
  };

  type LoadedInvitation = {
    invitation: any;
    organizationName: string;
    requests: LoadedRequest[];
  };

  let showArchivedRequests = $state(false);

  // Charger les organisations de manière asynchrone
  let loadedInvitations = $state<LoadedInvitation[]>([]);

  $effect(() => {
    const currentInvitations = me?.root?.myInvitations;
    if (!currentInvitations) {
      loadedInvitations = [];
      return;
    }

    const loadOrganizations = async () => {
      const invitations: LoadedInvitation[] = [];

      for (const invitation of currentInvitations) {
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

        // Collecter les requests
        const requests: LoadedRequest[] = [];
        if (invitation.requests) {
          for (const request of invitation.requests) {
            if (!request) continue;
            requests.push({
              request,
              isArchived: !!request.archivedAt,
            });
          }
        }

        invitations.push({
          invitation,
          organizationName,
          requests,
        });
      }

      loadedInvitations = invitations;
    };

    loadOrganizations();
  });

  // Filtrer les invitations selon le toggle
  const visibleInvitations = $derived(
    showArchived
      ? loadedInvitations
      : loadedInvitations.filter((inv) => !inv.invitation.archivedAt),
  );

  // Debug: log des invitations visibles
  $effect(() => {
    console.log("loadedInvitations:", loadedInvitations.length);
    console.log("visibleInvitations:", visibleInvitations.length);

    // Compter combien d'invitations ont des requests
    const withRequests = loadedInvitations.filter(inv => inv.requests.length > 0);
    console.log("Invitations avec requests:", withRequests.length);

    if (withRequests.length > 0) {
      console.log("Première invitation avec requests:", withRequests[0]);
      console.log("Ses requests:", withRequests[0].requests);
    }
  });

  async function copyInviteLink(invitationId: string) {
    try {
      const baseURL = window.location.href.replace(/#.*$/, "");
      const inviteLink = `${baseURL}#/invite-token/${invitationId}`;

      await navigator.clipboard.writeText(inviteLink);
      copiedInviteId = invitationId;
      setTimeout(() => {
        copiedInviteId = null;
      }, 2000);
    } catch {
      // Error silently handled
    }
  }

  function revokeInvitation(invitationId: string) {
    try {
      if (!me?.root?.myInvitations) return;

      const confirmed = confirm(
        "Voulez-vous vraiment révoquer cette invitation ? Le lien ne fonctionnera plus et personne ne pourra l'utiliser.",
      );
      if (!confirmed) return;

      const invitation = me.root.myInvitations.find((inv) => inv?.$jazz.id === invitationId);

      if (invitation) {
        invitation.$jazz.set("revokedAt", new Date());
      }
    } catch {
      // Error silently handled
    }
  }

  function archiveInvitation(invitationId: string) {
    try {
      if (!me?.root?.myInvitations) return;

      const invitation = me.root.myInvitations.find((inv) => inv?.$jazz.id === invitationId);

      if (invitation) {
        invitation.$jazz.set("archivedAt", new Date());
      }
    } catch {
      // Error silently handled
    }
  }

  function unarchiveInvitation(invitationId: string) {
    try {
      if (!me?.root?.myInvitations) return;

      const invitation = me.root.myInvitations.find((inv) => inv?.$jazz.id === invitationId);

      if (invitation) {
        invitation.$jazz.delete("archivedAt");
      }
    } catch {
      // Error silently handled
    }
  }

  async function approveRequest(request: any, organizationId: string) {
    try {
      // Charger l'organisation
      const organization = await Organization.load(organizationId, {});

      if (!organization) {
        alert("Organisation introuvable.");
        return;
      }

      // Obtenir le groupe de l'organisation via son owner
      const targetGroup = organization.$jazz.owner;

      if (!targetGroup) {
        alert("Impossible d'accéder au groupe de l'organisation.");
        return;
      }

      if (!request.account) {
        alert("Aucun compte dans la demande.");
        return;
      }

      // Ajouter le membre au groupe directement avec l'Account
      targetGroup.addMember(request.account, "writer");

      // Marquer la demande comme approuvée
      request.$jazz.set("status", "approved");

      alert(
        `Demande approuvée ! L'utilisateur a été ajouté au groupe de l'organisation.\n\n` +
          `L'utilisateur peut maintenant ajouter l'organisation à sa liste depuis ses demandes approuvées.`,
      );
    } catch (error) {
      console.error("Erreur lors de l'approbation:", error);
      alert("Erreur lors de l'approbation de la demande.");
    }
  }

  function rejectRequest(request: any) {
    try {
      request.$jazz.set("status", "rejected");
    } catch {
      // Error silently handled
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

{#if loadedInvitations.length > 0}
  <div class="border p-6 border-stone-200 rounded">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">
        Mes liens d'invitation ({visibleInvitations.length}{#if !showArchived && loadedInvitations.length > visibleInvitations.length}/{loadedInvitations.length}{/if})
      </h2>
      <div class="flex gap-4">
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" bind:checked={showArchivedRequests} class="rounded" />
          <span>Afficher demandes archivées</span>
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" bind:checked={showArchived} class="rounded" />
          <span>Afficher invitations archivées</span>
        </label>
      </div>
    </div>
    <ul class="space-y-4">
      {#each visibleInvitations as { invitation, organizationName, requests }}
        {@const isRevoked = !!invitation.revokedAt}
        {@const isArchived = !!invitation.archivedAt}
        {@const borderColor = isRevoked
          ? "border-red-300"
          : isArchived
            ? "border-stone-300"
            : "border-blue-200"}
        {@const bgColor = isRevoked ? "bg-red-50" : isArchived ? "bg-stone-50" : "bg-blue-50"}
        {@const visibleRequests = showArchivedRequests
          ? requests
          : requests.filter((r) => !r.isArchived)}
        <li class="border {borderColor} {bgColor} rounded overflow-hidden">
          <!-- En-tête de l'invitation -->
          <div class="p-4 flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <div class="font-medium">
                  Invitation pour "{organizationName}"
                </div>
                {#if isRevoked}
                  <span class="text-xs px-2 py-1 rounded bg-red-600 text-white"> Révoquée </span>
                {/if}
                {#if isArchived}
                  <span class="text-xs px-2 py-1 rounded bg-stone-600 text-white"> Archivée </span>
                {/if}
              </div>
              <div class="text-sm text-stone-600 mt-1">
                Créée le {new Date(invitation.createdAt).toLocaleDateString()} à {new Date(
                  invitation.createdAt,
                ).toLocaleTimeString()}
              </div>
              {#if isRevoked}
                <div class="text-sm text-red-600 mt-1">
                  Révoquée le {new Date(invitation.revokedAt).toLocaleDateString()} à {new Date(
                    invitation.revokedAt,
                  ).toLocaleTimeString()}
                </div>
              {/if}
              {#if isArchived}
                <div class="text-sm text-stone-600 mt-1">
                  Archivée le {new Date(invitation.archivedAt).toLocaleDateString()} à {new Date(
                    invitation.archivedAt,
                  ).toLocaleTimeString()}
                </div>
              {/if}
            </div>
            <div class="flex gap-2">
              {#if !isRevoked}
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  onclick={() => copyInviteLink(invitation.$jazz.id)}
                >
                  {copiedInviteId === invitation.$jazz.id ? "✓ Copié" : "Copier le lien"}
                </button>
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  onclick={() => revokeInvitation(invitation.$jazz.id)}
                >
                  Révoquer
                </button>
              {/if}
              {#if isArchived}
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-stone-600 text-white rounded hover:bg-stone-700 transition-colors"
                  onclick={() => unarchiveInvitation(invitation.$jazz.id)}
                >
                  Désarchiver
                </button>
              {:else}
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-stone-600 text-white rounded hover:bg-stone-700 transition-colors"
                  onclick={() => archiveInvitation(invitation.$jazz.id)}
                >
                  Archiver
                </button>
              {/if}
            </div>
          </div>

          <!-- Liste des demandes -->
          {#if visibleRequests.length > 0}
            <div class="border-t border-stone-200 bg-white">
              <div class="px-4 py-2 bg-stone-100 text-sm font-medium">
                Demandes d'accès ({visibleRequests.length}{#if !showArchivedRequests && requests.length > visibleRequests.length}/{requests.length}{/if})
              </div>
              <ul class="divide-y divide-stone-200">
                {#each visibleRequests as { request, isArchived: reqArchived }}
                  {@const status = request.status}
                  {@const statusLabel =
                    status === "approved"
                      ? "Approuvée"
                      : status === "rejected"
                        ? "Refusée"
                        : "En attente"}
                  {@const statusBadgeColor =
                    status === "approved"
                      ? "bg-green-600 text-white"
                      : status === "rejected"
                        ? "bg-red-600 text-white"
                        : "bg-orange-600 text-white"}
                  <li class="p-3 {reqArchived ? 'bg-stone-50' : ''}">
                    <div class="flex items-center justify-between gap-4">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <span class="text-xs px-2 py-1 rounded {statusBadgeColor}">
                            {statusLabel}
                          </span>
                          {#if reqArchived}
                            <span class="text-xs px-2 py-1 rounded bg-stone-600 text-white">
                              Archivée
                            </span>
                          {/if}
                        </div>
                        <div class="text-sm text-stone-600 mt-1">
                          Demandé le {new Date(request.createdAt).toLocaleDateString()} à {new Date(
                            request.createdAt,
                          ).toLocaleTimeString()}
                        </div>
                        {#if reqArchived}
                          <div class="text-sm text-stone-600 mt-1">
                            Archivée le {new Date(request.archivedAt).toLocaleDateString()} à {new Date(
                              request.archivedAt,
                            ).toLocaleTimeString()}
                          </div>
                        {/if}
                      </div>
                      <div class="flex gap-2">
                        {#if status === "pending"}
                          <button
                            type="button"
                            class="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            onclick={() => approveRequest(request, invitation.organizationId)}
                          >
                            Approuver
                          </button>
                          <button
                            type="button"
                            class="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            onclick={() => rejectRequest(request)}
                          >
                            Refuser
                          </button>
                        {/if}
                        {#if reqArchived}
                          <button
                            type="button"
                            class="text-sm px-3 py-1 bg-stone-600 text-white rounded hover:bg-stone-700 transition-colors"
                            onclick={() => unarchiveRequest(request)}
                          >
                            Désarchiver
                          </button>
                        {:else}
                          <button
                            type="button"
                            class="text-sm px-3 py-1 bg-stone-600 text-white rounded hover:bg-stone-700 transition-colors"
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
            </div>
          {:else if requests.length > 0 && !showArchivedRequests}
            <div class="border-t border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
              Aucune demande active. Cochez "Afficher demandes archivées" pour voir les demandes
              archivées.
            </div>
          {:else}
            <div class="border-t border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
              Aucune demande reçue
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    {#if visibleInvitations.length === 0 && !showArchived}
      <p class="text-stone-500 text-sm mt-4">
        Aucune invitation active. {#if loadedInvitations.length > 0}Cochez "Afficher invitations
          archivées" pour voir les invitations archivées.{/if}
      </p>
    {/if}
  </div>
{/if}
