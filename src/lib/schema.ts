/**
 * Learn about schemas here:
 * https://jazz.tools/docs/svelte/schemas/covalues
 */

import { Group, Account, co, z } from "jazz-tools";

export { co };

/** Activity CoMap */
export const Activity = co.map({
  name: z.string(),
});

/** JoinRequest - Demande d'accès à une organisation */
export const JoinRequest = co.map({
  account: Account,
  invitationId: z.string(), // ID de l'invitation (pour charger les infos via Invitation.load())
  status: z.enum(["pending", "approved", "rejected"]),
  createdAt: z.date(),
  archivedAt: z.date().optional(), // Quand la demande a été archivée (masquée de la vue)
});

/** Invitation CoMap - Système de demande d'accès
 * L'invitation contient une liste de demandes que tout le monde peut écrire
 * L'invitation elle-même est lisible par tous (everyone: reader) pour permettre
 * à user2 de la charger et d'ajouter une demande
 */
export const Invitation = co.map({
  organizationId: z.string(), // Charger Organization.load(organizationId) pour obtenir le nom
  requests: co.list(JoinRequest), // Liste avec everyone:writeOnly + créateur:admin
  createdAt: z.date(),
  revokedAt: z.date().optional(), // Quand l'invitation a été révoquée (bloque le lien)
  archivedAt: z.date().optional(), // Quand l'invitation a été archivée (masquée de la vue)
});

/** Organization CoMap */
export const Organization = co.map({
  name: z.string(),
  activities: co.list(Activity),
});

/** The account profile is an app-specific per-user public `CoMap`
 *  where you can store top-level objects for that user */
export const JazzProfile = co.profile({
  /**
   * Learn about CoValue field/item types here:
   * https://jazz.tools/docs/svelte/schemas/covalues#covalue-fielditem-types
   */
  firstName: z.string(),

  // Add public fields here
});

/** The account root is an app-specific per-user private `CoMap`
 *  where you can store top-level objects for that user */
export const AccountRoot = co.map({
  dateOfBirth: z.date(),
  organizations: co.list(Organization),
  myInvitations: co.list(Invitation), // Les invitations que j'ai créées
  myRequests: co.list(JoinRequest), // Mes demandes d'accès
});

export function getUserAge(root: co.loaded<typeof AccountRoot> | undefined) {
  if (!root) return null;

  const today = new Date();
  const birthDate = root.dateOfBirth;

  let age = today.getFullYear() - birthDate.getFullYear();

  // Check if the birthday hasn't occurred yet this year
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() > birthDate.getDate());

  if (!hasBirthdayPassed) {
    age--;
  }

  return age;
}

export const JazzAccount = co
  .account({
    profile: JazzProfile,
    root: AccountRoot,
  })
  .withMigration(async (account) => {
    /** The account migration is run on account creation and on every log-in.
     *  You can use it to set up the account root and any other initial CoValues you need.
     */
    if (!account.$jazz.has("root")) {
      account.$jazz.set(
        "root",
        AccountRoot.create({
          dateOfBirth: new Date("1/1/1990"),
          organizations: co.list(Organization).create([]),
          myInvitations: co.list(Invitation).create([]),
          myRequests: co.list(JoinRequest).create([]),
        }),
      );
    }

    // Migration pour les comptes existants sans myInvitations
    if (account.root && !account.root.$jazz.has("myInvitations")) {
      account.root.$jazz.set("myInvitations", co.list(Invitation).create([]));
    }

    // Migration pour les comptes existants sans myRequests
    if (account.root && !account.root.$jazz.has("myRequests")) {
      account.root.$jazz.set("myRequests", co.list(JoinRequest).create([]));
    }

    if (!account.$jazz.has("profile")) {
      const group = Group.create();
      group.addMember("everyone", "reader"); // The profile info is visible to everyone

      account.$jazz.set(
        "profile",
        JazzProfile.create(
          {
            name: "",
            firstName: "",
          },
          group,
        ),
      );
    }
  });
