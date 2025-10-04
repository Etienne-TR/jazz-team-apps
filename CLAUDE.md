# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Jazz-powered Svelte application using Tailwind CSS and passkey authentication. Jazz is a TypeScript framework for building local-first collaborative applications with real-time sync capabilities.

## Core Architecture

### Jazz Framework Integration

- **Jazz Provider**: The app is wrapped in `JazzSvelteProvider` in `src/routes/+layout.svelte`, which configures the Jazz sync server and account schema
- **Sync Configuration**: Uses Jazz Cloud (`wss://cloud.jazz.tools`) with API key from `src/apiKey.ts` (reads from `PUBLIC_JAZZ_API_KEY` env var or falls back to default)
- **Account Schema**: Defined in `src/lib/schema.ts` as `JazzAccount` with:
  - `JazzProfile` (public): Contains user profile data visible to everyone (e.g., `firstName`)
  - `AccountRoot` (private): Contains private user data (e.g., `dateOfBirth`)
  - Account migration logic that initializes the profile and root on account creation/login

### Data Model (CoValues)

Jazz uses CoValues (Collaborative Values) for data structures:

- `co.profile()` for public profile data (shared with everyone)
- `co.map()` for key-value structures
- `co.list()` for ordered collections
- `co.account()` for account schemas with profile and root
- All schemas use Zod (`z`) for type validation
- Access `$jazz.set()` and `$jazz.has()` methods on CoValue instances to modify data

#### Loading CoValues with Resolve Options

When loading CoValues with references (using `.load()`, `AccountCoState`, or `useCoState`), use the `resolve` option to specify which nested data to load:

**Loading Lists:**

- ❌ **INVALID**: `myList: []` - Empty array is not a valid option and will cause errors
- ✅ **Shallow load**: `myList: true` - Loads the list itself but NOT its items
  - You can access `myList.length`
  - Items like `myList[0]` may be `undefined` or `null` (not loaded)
- ✅ **Deep load**: `myList: [{}]` or `myList: { $each: true }` - Loads the list AND all its items
  - All items are guaranteed to be loaded
  - Use this when you need to iterate over items or access their properties
- ✅ **Deep load with nested references**: `myList: [{ nestedField: true }]` or `myList: { $each: { nestedField: true } }`

**Handling Inaccessible Items with `$onError`:**

By default, if ANY item in a list is inaccessible, the entire load fails and returns `null`. Use `$onError: null` on `$each` to handle inaccessible items gracefully:

```ts
// Without $onError: if one item is inaccessible, entire load fails
const project = await Project.load(id, {
  tasks: { $each: true }, // Returns null if ANY task is inaccessible
});

// With $onError on $each: inaccessible items become null, rest loads normally
const project = await Project.load(id, {
  tasks: { $each: { $onError: null } }, // Inaccessible items become null
});
```

**Important:** Apply `$onError: null` to `$each` (items), not to the list itself. If you apply it to the list, the entire list becomes `null` when inaccessible, preventing operations like `.push()`.

**Examples:**

````ts
// Shallow load - list only
const invitation = await Invitation.load(id, {
  requests: true  // requests.length works, but requests[0] might not be loaded
});

// Deep load - list and all items (strict - fails if any item inaccessible)
const invitation = await Invitation.load(id, {
  requests: [{}]  // or: requests: { $each: true }
});

// Deep load with graceful error handling (recommended for shared lists)
const invitation = await Invitation.load(id, {
  requests: { $each: { $onError: null } }  // $onError on items only, not the list
});

// Deep load with nested references
const project = await Project.load(id, {
  tasks: [{ assignee: true }]  // or: tasks: { $each: { assignee: true } }
});
````

#### Using writeOnly Lists for Permission Requests

When implementing permission request systems (e.g., join requests), use `writeOnly` lists:

**Key Points:**
- **Permissions on the list**: `writeOnly` allows users to `.push()` items without reading the list content
- **Don't check if list exists**: With `writeOnly`, the list may appear as `null` but `.push()` still works
- **Push directly**: `invitation.requests.$jazz.push(item)` works even if `invitation.requests` appears falsy
- **Permissions on items**: Individual items in the list have their own group permissions (usually `everyone: "writer"`)

**Loading Invitation with writeOnly list (invitee side):**

```ts
// ✅ CORRECT: Load invitation WITHOUT explicitly loading the writeOnly list
const invitation = await Invitation.load(invitationId, {});
// requests field is accessible but appears null/undefined - this is normal!

// ✅ Push works even though requests appears null
invitation.requests.$jazz.push(joinRequest);

// ❌ WRONG: Don't try to load the writeOnly list explicitly
const invitation = await Invitation.load(invitationId, {
  requests: true // This will fail or return null for writeOnly lists
});
```

**Pattern for Join Requests:**

```ts
// 1. Create invitation with writeOnly list
const invitationGroup = Group.create();
invitationGroup.addMember("everyone", "reader"); // Everyone can read invitation

const requestsGroup = Group.create();
requestsGroup.addMember("everyone", "writeOnly"); // Everyone can add requests (but not read others)
requestsGroup.addMember(adminAccount, "admin"); // Admin can read all requests

const invitation = Invitation.create({
  organizationId: org.$jazz.id,
  requests: co.list(JoinRequest).create([], { owner: requestsGroup }),
}, { owner: invitationGroup });

// 2. User adds request (works even though list is writeOnly)
const joinRequest = JoinRequest.create({
  account: me,
  organizationId: invitation.organizationId,
  organizationName: "Org Name",
  status: "pending",
}, requestGroup); // Individual item has its own permissions

invitation.requests.$jazz.push(joinRequest); // ✅ Works with writeOnly
me.root.myRequests.$jazz.push(joinRequest); // User saves ref to see status later

// 3. Admin reads and approves (has admin permission on list)
const requests = invitation.requests; // Admin can load the list
for (const request of requests) {
  if (request.status === "pending") {
    targetGroup.addMember(request.account, "writer");
    request.$jazz.set("status", "approved");
  }
}

// 4. User detects approval via their own reference
const myRequest = me.root.myRequests[0];
if (myRequest.status === "approved") {
  // User sees status update through myRequests, not through writeOnly list
}
```

**Why this works:**
- User cannot read other requests in the `writeOnly` list
- User can push their own request to the list
- User can read their request's status via `me.root.myRequests` (separate reference)
- Admin can read all requests and update status

### Svelte 5 Patterns

- Uses Svelte 5 runes: `$props()`, `$derived()`, `$state` (via Jazz's reactive patterns)
- `AccountCoState` from `jazz-tools/svelte` provides reactive account state
- Two-way binding pattern for Jazz data: `bind:value={() => getter, newValue => setter}`

### Local Development Server

- **HTTPS with custom domain**: Dev server runs on `https://myapp.local` (configured in `vite.config.ts`)
- SSL certificates: `localhost+3.pem` and `localhost+3-key.pem` (already generated, in .gitignore)
- **Important**: Development and database servers are already running externally - do NOT start them via Claude Code

## Common Commands

### Development
```bash
bun dev              # Start dev server (already running externally)
bun build            # Type-check and build for production
bun preview          # Preview production build
````

### Code Quality

```bash
bun check            # Run Svelte type checking
bun check:watch      # Run type checking in watch mode
bun format           # Format code with Prettier
bun lint             # Check formatting and run ESLint
bun format-and-lint  # Format and lint
bun format-and-lint:fix  # Format and auto-fix linting issues
```

### Testing

```bash
bun test:e2e         # Run Playwright e2e tests
bun test:e2e:ui      # Run Playwright tests with UI
```

Note: Playwright tests run on port 5173 with `bun preview` (configured in `playwright.config.ts`)

## Schema Development Workflow

When modifying `src/lib/schema.ts`:

1. **Define new fields** using appropriate CoValue types:
   - Add public fields to `JazzProfile` (visible to everyone)
   - Add private fields to `AccountRoot` (private to user)
   - Use Zod validators (`z.string()`, `z.date()`, `z.number()`, etc.)

2. **Update account migration** in `JazzAccount.withMigration()`:
   - Initialize new fields with default values
   - Check existence with `account.$jazz.has()` before setting
   - Set values with `account.$jazz.set()`
   - For profile fields, ensure proper Group permissions are set

3. **Create UI components** following the pattern in `src/lib/components/Form.svelte`:
   - Use `AccountCoState` with `resolve` to fetch data
   - Use `$derived()` for computed values
   - Use `bind:value` with getter/setter pattern for two-way binding
   - Use `$jazz.set()` to update values

4. **Helper functions**: Follow the pattern in `getUserAge()` - accept `co.loaded<typeof SchemaName>` types

## Jazz Documentation Reference

**IMPORTANT**: Always refer to `.cursor/docs/llms-full.md` for Jazz documentation and code examples.

- **Primary documentation source**: `.cursor/docs/llms-full.md` contains the complete, up-to-date Jazz documentation
- **Code examples**: When using examples from the documentation, ONLY use Svelte examples (ignore React, Vue, React Native examples)
- **Additional context**:
  - `.cursor/docs/jazz-schema-template.md`: Template for creating Jazz schemas
  - `.cursor/rules/jazz-general-help.mdc`: General Jazz help and troubleshooting patterns
  - `.cursor/rules/generate-jazz-schema.mdc`: Schema creation workflow and best practices

When implementing Jazz features:

1. Always consult `.cursor/docs/llms-full.md` first
2. Look for Svelte-specific sections and examples
3. Follow the patterns from this Svelte application's existing code

## Project Structure

```
src/
  routes/
    +layout.svelte         # Jazz provider setup, app shell
    +page.svelte           # Main page, uses AccountCoState
  lib/
    schema.ts              # Jazz CoValue schemas and account definition
    components/
      Form.svelte          # Example form with Jazz two-way binding
      Header.svelte        # App header
  apiKey.ts                # Jazz API key configuration
```

## Environment Variables

- `PUBLIC_JAZZ_API_KEY`: Jazz Cloud API key (falls back to "jazz-svelte-starter@garden.co")

## Important Notes

- **Svelte 5**: This project uses Svelte 5 with runes (`$props`, `$derived`, etc.)
- **TailwindCSS 4**: Uses Tailwind CSS v4 with PostCSS plugin
- **Package manager**: Uses `bun` (not npm/yarn/pnpm)
- **Jazz Inspector**: Available in dev mode via `<jazz-inspector>` custom element
- **Local sync server**: Can run `npx jazz-run sync` and change sync config to `{ peer: "ws://localhost:4200" }` for local development
