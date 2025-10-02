<script lang="ts">
  import { AccountCoState } from "jazz-tools/svelte";
  import { Group } from "jazz-tools";
  import { JazzAccount, Invitation, JoinRequest } from "$lib/schema";
  import { goto, replaceState } from "$app/navigation";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        organizations: true,
        myRequests: true,
      },
    },
  });
  const me = $derived(account.current);

  let requestSent = $state(false);
  let processedInvites = $state(new Set<string>());

  async function handleInvite() {
    // Vérifier si l'URL contient un hash d'invitation token
    const hash = window.location.hash;
    if (!hash.includes("/invite-token/") || !me) {
      return;
    }

    try {
      // Extraire l'ID de l'Invitation depuis le hash
      const parts = hash.split("/");
      const invitationId = parts[parts.length - 1];

      if (!invitationId) {
        console.error("No invitation ID found in URL");
        return;
      }

      // Éviter de traiter la même invitation plusieurs fois
      if (processedInvites.has(invitationId)) {
        return;
      }

      // Charger l'Invitation CoMap (writeOnly - on ne peut que créer des demandes)
      const invitation = await Invitation.load(invitationId, {});

      console.log("📨 [InviteHandler] Invitation loaded:", {
        invitationId,
        invitation,
        organizationId: invitation?.organizationId,
        requestsLength: invitation?.requests?.length,
        revokedAt: invitation?.revokedAt,
      });

      if (!invitation) {
        console.error("Invitation not found or no access");
        alert("Cette invitation n'est pas valide.");
        replaceState("", {});
        await goto("/");
        return;
      }

      // Vérifier si l'invitation a été révoquée
      if (invitation.revokedAt) {
        console.log("❌ [InviteHandler] Invitation has been revoked");
        alert("Cette invitation a été révoquée et n'est plus valide.");
        replaceState("", {});
        await goto("/");
        return;
      }

      // Marquer comme traité
      processedInvites.add(invitationId);

      // Créer un groupe pour le JoinRequest qui permet au créateur de l'invitation de le modifier
      const joinRequestGroup = Group.create();
      joinRequestGroup.addMember("everyone", "writer"); // Tout le monde peut lire et écrire (pour que user1 puisse approuver)

      // Créer une demande d'accès
      const joinRequest = JoinRequest.create(
        {
          account: me,
          organizationId: invitation.organizationId, // Stocker l'ID pour que user2 puisse voir le nom
          status: "pending",
          createdAt: new Date(),
        },
        joinRequestGroup // Utiliser un groupe lisible
      );

      console.log("📝 [InviteHandler] JoinRequest created:", {
        joinRequestId: joinRequest.$jazz.id,
        accountId: me.$jazz.id,
        status: joinRequest.status,
      });

      // Ajouter la demande à la liste de l'invitation
      if (!invitation.requests) {
        console.error("❌ [InviteHandler] Invitation requests list not available");
        alert("Erreur: la liste des demandes n'est pas disponible.");
        return;
      }
      invitation.requests.$jazz.push(joinRequest);

      // Ajouter la demande à ma liste personnelle pour pouvoir la surveiller
      if (me.root.myRequests) {
        me.root.myRequests.$jazz.push(joinRequest);
        console.log("✅ [InviteHandler] Request added to myRequests", {
          requestId: joinRequest.$jazz.id,
          myRequestsLength: me.root.myRequests.length,
        });
      } else {
        console.error("❌ [InviteHandler] myRequests not available - request not added to user's list");
      }

      console.log("✅ [InviteHandler] Request pushed to invitation.requests");

      // Marquer comme envoyé et nettoyer l'URL
      requestSent = true;
      replaceState("", {});

      // Attendre un peu puis rediriger
      setTimeout(async () => {
        await goto("/");
      }, 2000);

    } catch (error) {
      console.error("Failed to send join request:", error);
      alert("Erreur lors de l'envoi de la demande d'accès.");
    }
  }

  // Écouter les changements de hash et l'authentification
  $effect(() => {
    if (me) {
      handleInvite();
    }
  });

  // Écouter les changements de hash
  $effect(() => {
    const onHashChange = () => {
      if (me) {
        handleInvite();
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  });
</script>

{#if requestSent}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-8 rounded-lg shadow-xl max-w-md">
      <div class="text-center">
        <div class="text-green-600 text-5xl mb-4">✓</div>
        <h2 class="text-2xl font-semibold mb-2">Demande envoyée !</h2>
        <p class="text-stone-600">
          Votre demande d'accès a été envoyée au créateur de l'organisation.
          Vous serez notifié une fois qu'elle sera approuvée.
        </p>
      </div>
    </div>
  </div>
{/if}
