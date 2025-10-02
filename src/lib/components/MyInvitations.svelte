<script lang="ts">
  import { JazzAccount, Organization } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        myInvitations: true,
      },
    },
  });
  const me = $derived(account.current);

  let copiedInviteId = $state<string | null>(null);
  let showArchived = $state(false);

  // État pour stocker les invitations avec leurs organisations
  let loadedInvitations = $state<Array<{
    invitation: any;
    organizationName: string;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
  }>>([]);

  // Charger les organisations de manière asynchrone
  $effect(() => {
    const loadOrganizations = async () => {
      if (!me?.root?.myInvitations) return;

      const invitations: Array<{
        invitation: any;
        organizationName: string;
        pendingCount: number;
        approvedCount: number;
        rejectedCount: number;
      }> = [];

      for (const invitation of me.root.myInvitations) {
        if (!invitation) continue;

        try {
          // Charger l'organisation pour obtenir son nom
          let organizationName = "Organisation inconnue";

          if (invitation.organizationId) {
            const organization = await Organization.load(invitation.organizationId, {});
            if (organization?.name) {
              organizationName = organization.name;
            }
          }

          // Compter les demandes par statut
          let pendingCount = 0;
          let approvedCount = 0;
          let rejectedCount = 0;

          if (invitation.requests) {
            for (const request of invitation.requests) {
              if (!request) continue;
              if (request.status === "pending") pendingCount++;
              if (request.status === "approved") approvedCount++;
              if (request.status === "rejected") rejectedCount++;
            }
          }

          invitations.push({
            invitation,
            organizationName,
            pendingCount,
            approvedCount,
            rejectedCount,
          });
        } catch (e) {
          console.log("⚠️ [MyInvitations] Cannot load organization:", e);
          invitations.push({
            invitation,
            organizationName: "Organisation inconnue",
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
          });
        }
      }

      loadedInvitations = invitations;
    };

    loadOrganizations();
  });

  // Filtrer les invitations selon le toggle
  const visibleInvitations = $derived(
    showArchived
      ? loadedInvitations
      : loadedInvitations.filter(inv => !inv.invitation.archivedAt)
  );

  async function copyInviteLink(invitationId: string) {
    try {
      const baseURL = window.location.href.replace(/#.*$/, "");
      const inviteLink = `${baseURL}#/invite-token/${invitationId}`;

      await navigator.clipboard.writeText(inviteLink);
      copiedInviteId = invitationId;
      setTimeout(() => {
        copiedInviteId = null;
      }, 2000);
    } catch (error) {
      console.error("Failed to copy invite link:", error);
    }
  }

  function revokeInvitation(invitationId: string) {
    try {
      if (!me?.root?.myInvitations) return;

      const confirmed = confirm(
        "Voulez-vous vraiment révoquer cette invitation ? Le lien ne fonctionnera plus et personne ne pourra l'utiliser."
      );
      if (!confirmed) return;

      const invitation = me.root.myInvitations.find(
        (inv) => inv?.$jazz.id === invitationId
      );

      if (invitation) {
        invitation.$jazz.set("revokedAt", new Date());
        console.log("Invitation revoked");
      }
    } catch (error) {
      console.error("Failed to revoke invitation:", error);
    }
  }

  function archiveInvitation(invitationId: string) {
    try {
      if (!me?.root?.myInvitations) return;

      const invitation = me.root.myInvitations.find(
        (inv) => inv?.$jazz.id === invitationId
      );

      if (invitation) {
        invitation.$jazz.set("archivedAt", new Date());
        console.log("Invitation archived");
      }
    } catch (error) {
      console.error("Failed to archive invitation:", error);
    }
  }

  function unarchiveInvitation(invitationId: string) {
    try {
      if (!me?.root?.myInvitations) return;

      const invitation = me.root.myInvitations.find(
        (inv) => inv?.$jazz.id === invitationId
      );

      if (invitation) {
        invitation.$jazz.delete("archivedAt");
        console.log("Invitation unarchived");
      }
    } catch (error) {
      console.error("Failed to unarchive invitation:", error);
    }
  }
</script>

{#if loadedInvitations.length > 0}
  <div class="border p-6 border-stone-200 rounded">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">
        Mes liens d'invitation ({visibleInvitations.length}{#if !showArchived && loadedInvitations.length > visibleInvitations.length}/{loadedInvitations.length}{/if})
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
      {#each visibleInvitations as { invitation, organizationName, pendingCount, approvedCount, rejectedCount }}
        {@const totalRequests = pendingCount + approvedCount + rejectedCount}
        {@const isRevoked = !!invitation.revokedAt}
        {@const isArchived = !!invitation.archivedAt}
        {@const borderColor = isRevoked ? "border-red-300" : isArchived ? "border-stone-300" : "border-blue-200"}
        {@const bgColor = isRevoked ? "bg-red-50" : isArchived ? "bg-stone-50" : "bg-blue-50"}
        <li class="p-4 border {borderColor} {bgColor} rounded">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <div class="font-medium">
                  Invitation pour "{organizationName}"
                </div>
                {#if isRevoked}
                  <span class="text-xs px-2 py-1 rounded bg-red-600 text-white">
                    Révoquée
                  </span>
                {/if}
                {#if isArchived}
                  <span class="text-xs px-2 py-1 rounded bg-stone-600 text-white">
                    Archivée
                  </span>
                {/if}
              </div>
              <div class="text-sm text-stone-600 mt-1">
                Créée le {new Date(invitation.createdAt).toLocaleDateString()} à {new Date(invitation.createdAt).toLocaleTimeString()}
              </div>
              {#if isRevoked}
                <div class="text-sm text-red-600 mt-1">
                  Révoquée le {new Date(invitation.revokedAt).toLocaleDateString()} à {new Date(invitation.revokedAt).toLocaleTimeString()}
                </div>
              {/if}
              {#if isArchived}
                <div class="text-sm text-stone-600 mt-1">
                  Archivée le {new Date(invitation.archivedAt).toLocaleDateString()} à {new Date(invitation.archivedAt).toLocaleTimeString()}
                </div>
              {/if}
              {#if totalRequests > 0}
                <div class="flex gap-3 mt-2 text-xs">
                  {#if pendingCount > 0}
                    <span class="px-2 py-1 bg-orange-600 text-white rounded">
                      {pendingCount} en attente
                    </span>
                  {/if}
                  {#if approvedCount > 0}
                    <span class="px-2 py-1 bg-green-600 text-white rounded">
                      {approvedCount} approuvée(s)
                    </span>
                  {/if}
                  {#if rejectedCount > 0}
                    <span class="px-2 py-1 bg-red-600 text-white rounded">
                      {rejectedCount} refusée(s)
                    </span>
                  {/if}
                </div>
              {:else}
                <div class="text-sm text-stone-500 mt-2">
                  Aucune demande reçue
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
        </li>
      {/each}
    </ul>
    {#if visibleInvitations.length === 0 && !showArchived}
      <p class="text-stone-500 text-sm mt-4">
        Aucune invitation active. {#if loadedInvitations.length > 0}Cochez "Afficher les archives" pour voir les invitations archivées.{/if}
      </p>
    {/if}
  </div>
{/if}
