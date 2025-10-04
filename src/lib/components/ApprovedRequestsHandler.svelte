<script lang="ts">
  import { AccountCoState } from "jazz-tools/svelte";
  import { JazzAccount, Organization } from "$lib/schema";

  const account = new AccountCoState(JazzAccount, {
    resolve: {
      root: {
        organizations: true,
        myRequests: true,
      },
    },
  });
  const me = $derived(account.current);

  // État pour stocker les demandes déjà traitées
  let processedRequests = $state<Set<string>>(new Set());

  // Surveiller les demandes approuvées
  $effect(() => {
    const checkApprovedRequests = async () => {
      if (!me?.root?.myRequests) {
        return;
      }

      for (const request of me.root.myRequests) {
        if (!request) {
          continue;
        }

        if (processedRequests.has(request.$jazz.id)) {
          continue;
        }

        // Si la demande est approuvée et a un ID d'organisation
        if (request.status === "approved" && request.organizationId) {
          // Marquer comme traitée
          processedRequests.add(request.$jazz.id);

          try {
            // Charger l'organisation
            const organization = await Organization.load(request.organizationId, {});

            if (organization) {
              // Vérifier si l'organisation n'est pas déjà dans la liste
              const alreadyAdded = me.root.organizations?.some(
                (org) => org?.$jazz.id === organization.$jazz.id,
              );

              if (!alreadyAdded) {
                // Ajouter l'organisation à ma liste
                me.root.organizations?.$jazz.push(organization);
                alert(
                  `Votre demande a été approuvée ! L'organisation a été ajoutée à votre liste.`,
                );
              }
            }
          } catch {
            // Error silently handled
          }
        }
      }
    };

    checkApprovedRequests();
  });
</script>
