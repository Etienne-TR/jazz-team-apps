<script lang="ts">
  import { JazzAccount, Organization, JoinRequest } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";
  import { Account } from "jazz-tools";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        myInvitations: true, // Charger seulement les invitations, pas les requests
      },
    },
  });
  const me = $derived(account.current);

  let showArchived = $state(false);

  // État pour stocker les demandes chargées
  let loadedRequests = $state<Array<{
    request: ReturnType<typeof JoinRequest.create>;
    invitationId: string;
    organizationId: string;
  }>>([]);

  // Charger les requests de manière asynchrone
  $effect(() => {
    const loadRequests = async () => {
      if (!me?.root?.myInvitations) return;

      const requests: Array<{
        request: ReturnType<typeof JoinRequest.create>;
        invitationId: string;
        organizationId: string;
      }> = [];

      console.log("🔄 [PendingRequests] Loading requests asynchronously...");

      for (const invitation of me.root.myInvitations) {
        if (!invitation) continue;

        try {
          const requestsList = invitation.requests;
          if (!requestsList) continue;

          console.log("📋 [PendingRequests] Processing invitation:", {
            invitationId: invitation.$jazz.id,
            requestsLength: requestsList.length,
          });

          for (let i = 0; i < requestsList.length; i++) {
            try {
              // Charger chaque request individuellement
              const requestRef = requestsList[i];
              console.log(`🔍 [PendingRequests] Request ${i} raw:`, requestRef);

              const requestId = requestRef?.$jazz?.id;
              if (!requestId) {
                console.log(`⚠️ [PendingRequests] Request ${i} has no ID`, {
                  hasRef: !!requestRef,
                  type: typeof requestRef,
                  keys: requestRef ? Object.keys(requestRef) : null,
                });
                continue;
              }

              const request = await JoinRequest.load(requestId, {});

              if (!request) {
                console.log(`⚠️ [PendingRequests] Cannot load request ${requestId}`);
                continue;
              }

              console.log("📄 [PendingRequests] Loaded request:", {
                requestId,
                status: request.status,
                accountId: request.account?.$jazz.id,
              });

              // Vérifier que le compte existe
              if (!request.account) {
                console.log(`⚠️ [PendingRequests] Request has no account`);
                continue;
              }

              // Ajouter toutes les demandes (filtre appliqué dans le derived)
              requests.push({
                request: request as any, // Type assertion pour gérer les nulls
                invitationId: invitation.$jazz.id,
                organizationId: invitation.organizationId,
              });
            } catch (e) {
              console.log(`⚠️ [PendingRequests] Cannot access request ${i}:`, e);
            }
          }
        } catch (e) {
          console.log("⚠️ [PendingRequests] Cannot access invitation:", e);
        }
      }

      console.log("✅ [PendingRequests] Total pending requests loaded:", requests.length);
      loadedRequests = requests;
    };

    loadRequests();
  });

  // Filtrer les demandes selon le toggle
  const pendingRequests = $derived(
    showArchived
      ? loadedRequests
      : loadedRequests.filter(item => !item.request.archivedAt)
  );

  async function approveRequest(
    request: ReturnType<typeof JoinRequest.create>,
    organizationId: string
  ) {
    try {
      // Charger l'organisation
      const organization = await Organization.load(organizationId, {});

      if (!organization) {
        console.error("Organization not found");
        alert("Organisation introuvable.");
        return;
      }

      // Obtenir le groupe de l'organisation
      const organizationRaw = (organization.$jazz as any).getRaw();
      const targetGroup = organizationRaw.core?.getGroup?.();

      if (!targetGroup) {
        console.error("Cannot access organization group");
        alert("Impossible d'accéder au groupe de l'organisation.");
        return;
      }

      if (!request.account) {
        console.error("No account in request");
        alert("Aucun compte dans la demande.");
        return;
      }

      // Accéder à l'objet brut du compte via $jazz.raw
      const accountJazz = request.account.$jazz;
      const rawAccount = (accountJazz as any).raw;

      if (!rawAccount) {
        console.error("Cannot access raw account");
        alert("Impossible d'accéder à l'objet brut du compte.");
        return;
      }

      console.log("👤 [PendingRequests] Using rawAccount:", rawAccount);

      // Ajouter le membre au groupe avec l'objet brut
      targetGroup.addMember(rawAccount, "writer");

      // Marquer la demande comme approuvée
      request.$jazz.set("status", "approved");

      console.log("✅ Request approved successfully");
      alert(
        `Demande approuvée ! L'utilisateur a été ajouté au groupe de l'organisation.\n\n` +
        `L'utilisateur recevra automatiquement l'organisation dans sa liste.`
      );
    } catch (error) {
      console.error("Failed to approve request:", error);
      alert("Erreur lors de l'approbation de la demande.");
    }
  }

  function rejectRequest(request: ReturnType<typeof JoinRequest.create>) {
    try {
      request.$jazz.set("status", "rejected");
      console.log("Request rejected");
    } catch (error) {
      console.error("Failed to reject request:", error);
    }
  }

  function archiveRequest(request: ReturnType<typeof JoinRequest.create>) {
    try {
      request.$jazz.set("archivedAt", new Date());
      console.log("Request archived");
    } catch (error) {
      console.error("Failed to archive request:", error);
    }
  }

  function unarchiveRequest(request: ReturnType<typeof JoinRequest.create>) {
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
        Demandes d'accès ({pendingRequests.length}{#if !showArchived && loadedRequests.length > pendingRequests.length}/{loadedRequests.length}{/if})
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
      {#each pendingRequests as { request, invitationId, organizationId }}
        {@const account = request.account}
        {@const profile = account?.profile}
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
                  Demande de rejoindre l'organisation
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
                Demandé le {new Date(request.createdAt).toLocaleDateString()} à {new Date(request.createdAt).toLocaleTimeString()}
              </div>
              {#if isArchived}
                <div class="text-sm text-stone-600 mt-1">
                  Archivée le {new Date(request.archivedAt).toLocaleDateString()} à {new Date(request.archivedAt).toLocaleTimeString()}
                </div>
              {/if}
            </div>
            <div class="flex gap-2">
              {#if status === "pending"}
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  onclick={() => approveRequest(request, organizationId)}
                >
                  Approuver
                </button>
                <button
                  type="button"
                  class="text-sm px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  onclick={() => rejectRequest(request)}
                >
                  Refuser
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
    {#if pendingRequests.length === 0 && !showArchived}
      <p class="text-stone-500 text-sm mt-4">
        Aucune demande active. {#if loadedRequests.length > 0}Cochez "Afficher les archives" pour voir les demandes archivées.{/if}
      </p>
    {/if}
  </div>
{/if}
