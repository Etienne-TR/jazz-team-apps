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
        console.log("⚠️ [ApprovedRequestsHandler] No myRequests found");
        return;
      }

      console.log("🔍 [ApprovedRequestsHandler] Checking for approved requests...");
      console.log("Total requests:", me.root.myRequests.length);
      me.root.myRequests.forEach((r, i) => {
        console.log(`Request ${i}:`, {
          isNull: r === null,
          isUndefined: r === undefined,
          type: typeof r,
          raw: r,
          hasJazz: r?.$jazz ? true : false,
          id: r?.$jazz?.id,
          status: r?.status,
          organizationId: r?.organizationId,
        });
      });

      for (const request of me.root.myRequests) {
        if (!request) {
          console.log("⚠️ [ApprovedRequestsHandler] Request is null/undefined");
          continue;
        }

        console.log("🔎 [ApprovedRequestsHandler] Processing request:", {
          id: request.$jazz.id,
          status: request.status,
          organizationId: request.organizationId,
        });

        if (processedRequests.has(request.$jazz.id)) {
          console.log("⏭️ [ApprovedRequestsHandler] Request already processed:", request.$jazz.id);
          continue;
        }

        // Si la demande est approuvée et a un ID d'organisation
        if (request.status === "approved" && request.organizationId) {
          console.log("✅ [ApprovedRequestsHandler] Found approved request:", request.$jazz.id);

          // Marquer comme traitée
          processedRequests.add(request.$jazz.id);

          try {
            // Charger l'organisation
            const organization = await Organization.load(request.organizationId, {});

            if (organization) {
              // Vérifier si l'organisation n'est pas déjà dans la liste
              const alreadyAdded = me.root.organizations?.some(
                (org) => org?.$jazz.id === organization.$jazz.id
              );

              if (!alreadyAdded) {
                // Ajouter l'organisation à ma liste
                me.root.organizations?.$jazz.push(organization);
                console.log("🎉 [ApprovedRequestsHandler] Organization added to my list!");
                alert(
                  `Votre demande a été approuvée ! L'organisation a été ajoutée à votre liste.`
                );
              }
            }
          } catch (error) {
            console.error("[ApprovedRequestsHandler] Error loading organization:", error);
          }
        }
      }
    };

    checkApprovedRequests();
  });
</script>
