<script lang="ts">
  import { JazzAccount, Organization, Activity, Invitation, JoinRequest, co } from "$lib/schema";
  import { AccountCoState } from "jazz-tools/svelte";
  import { Group } from "jazz-tools";
  import PendingRequests from "./PendingRequests.svelte";
  import MyRequests from "./MyRequests.svelte";
  import MyInvitations from "./MyInvitations.svelte";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        organizations: true,
        // myInvitations sera résolu dans PendingRequests
      },
    },
  });
  const me = $derived(account.current);

  const organizations = $derived(me?.root?.organizations);

  let newOrgName = $state("");
  let copiedOrgId = $state<string | null>(null);

  async function handleCopyInviteLink(organization: NonNullable<typeof organizations>[number]) {
    if (!organization) return;

    try {
      // Créer UN groupe avec writer pour l'invitation
      const invitationGroup = Group.create();
      invitationGroup.addMember("everyone", "writer");

      const invitation = Invitation.create(
        {
          organizationId: organization.$jazz.id,
          // NE PAS créer la liste ici, laisser Jazz la créer automatiquement
          // requests: co.list(JoinRequest).create([]),
          createdAt: new Date(),
        },
        { owner: invitationGroup },
      );

      // Sauvegarder l'invitation dans ma liste pour pouvoir voir les demandes
      if (me?.root?.myInvitations) {
        me.root.myInvitations.$jazz.push(invitation);
      }

      // L'ID est accessible via $jazz.id
      const invitationId = invitation.$jazz.id;

      if (!invitationId) {
        return;
      }

      // Créer le lien vers l'Invitation (pas vers l'Organisation)
      const baseURL = window.location.href.replace(/#.*$/, "");
      const inviteLink = `${baseURL}#/invite-token/${invitationId}`;

      await navigator.clipboard.writeText(inviteLink);
      copiedOrgId = organization.$jazz.id;
      setTimeout(() => {
        copiedOrgId = null;
      }, 2000);
    } catch (error) {
      // Error silently handled
    }
  }

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

  function handleLeaveOrganization(organization: NonNullable<typeof organizations>[number]) {
    if (!organization || !me?.root?.organizations) return;

    const confirmed = confirm(
      `Voulez-vous vraiment quitter l'organisation "${organization.name}" ?`,
    );
    if (!confirmed) return;

    // Trouver l'index de l'organisation et la retirer de MA liste
    const index = me.root.organizations.findIndex((org) => org?.$jazz.id === organization.$jazz.id);

    if (index !== -1) {
      me.root.organizations.$jazz.splice(index, 1);
    }
  }
</script>

<div class="grid gap-6 mt-6">
  {#if me}
    <div class="grid gap-6">
      <!-- Liens d'invitation générés (pour user1 qui crée des invitations) -->
      <MyInvitations />

      <!-- Demandes d'accès en attente (pour user1 qui reçoit des demandes) -->
      <PendingRequests />

      <!-- Mes demandes envoyées (pour user2 qui a envoyé des demandes) -->
      <MyRequests />

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
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1">
                      <div class="font-medium">{organization.name}</div>
                      {#if organization.activities?.length}
                        <div class="mt-2 text-sm text-stone-600">
                          {organization.activities.length} activité(s)
                        </div>
                      {/if}
                    </div>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="text-sm px-3 py-1 bg-stone-100 hover:bg-stone-200 rounded transition-colors"
                        onclick={() => organization && handleCopyInviteLink(organization)}
                      >
                        {copiedOrgId === organization.$jazz.id ? "✓ Copié" : "Inviter"}
                      </button>
                      <button
                        type="button"
                        class="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                        onclick={() => organization && handleLeaveOrganization(organization)}
                      >
                        Quitter
                      </button>
                    </div>
                  </div>
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
