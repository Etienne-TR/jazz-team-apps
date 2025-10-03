<script lang="ts">
  import { AccountCoState } from "jazz-tools/svelte";
  import { Group } from "jazz-tools";
  import { JazzAccount, Invitation, JoinRequest, co } from "$lib/schema";
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
        return;
      }

      // Éviter de traiter la même invitation plusieurs fois
      if (processedInvites.has(invitationId)) {
        return;
      }

      // Charger l'Invitation CoMap SANS la liste requests (elle n'existe peut-être pas encore)
      const invitation = await Invitation.load(invitationId, {});

      if (!invitation) {
        alert("Cette invitation n'est pas valide.");
        replaceState("", {});
        await goto("/");
        return;
      }

      // Vérifier si l'invitation a été révoquée
      if (invitation.revokedAt) {
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

      // Initialiser la liste requests si elle n'existe pas
      if (!invitation.$jazz.has("requests")) {
        console.log("Création de la liste requests pour cette invitation");

        // Obtenir le groupe de l'invitation pour que la liste hérite des mêmes permissions
        const invitationGroup = invitation.$jazz.owner;
        console.log("Groupe de l'invitation:", invitationGroup);

        invitation.$jazz.set("requests", co.list(JoinRequest).create([], { owner: invitationGroup }));
      }

      // Attendre que la liste soit créée et synchronisée
      await new Promise(resolve => setTimeout(resolve, 100));

      // Vérifier que la liste est maintenant accessible
      if (!invitation.requests) {
        console.error("Erreur: impossible d'accéder à la liste même après création");
        console.error("invitation.requests:", invitation.requests);
        console.error("Has requests?", invitation.$jazz.has("requests"));
        alert("Erreur lors de l'accès à la liste des demandes.");
        return;
      }

      try {
        console.log("Tentative d'ajout de la demande à la liste...");
        invitation.requests.$jazz.push(joinRequest);
        console.log("✓ Demande ajoutée à la liste de l'invitation");
      } catch (error) {
        console.error("Erreur lors de l'ajout à la liste:", error);
        alert("Erreur lors de l'ajout de votre demande. Vérifiez la console.");
        return;
      }

      // Ajouter la demande à ma liste personnelle pour pouvoir la surveiller
      if (me.root.myRequests) {
        me.root.myRequests.$jazz.push(joinRequest);
        console.log("✓ Demande ajoutée à myRequests");
      }

      // Marquer comme envoyé et nettoyer l'URL
      requestSent = true;
      replaceState("", {});

      console.log("✓ Processus d'invitation terminé avec succès !");

      // Attendre un peu puis rediriger
      setTimeout(async () => {
        await goto("/");
      }, 2000);

    } catch (error) {
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
