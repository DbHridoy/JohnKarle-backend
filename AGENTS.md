# AGENTS.md

## Scope

These instructions apply to the entire repository.

## API Changes

When you create, modify, or delete any API route, keep the Postman collection in sync with the implementation.

Update [postman/john-karle-backend.postman_collection.json](postman/john-karle-backend.postman_collection.json) for every affected endpoint, including:

- endpoint URL
- HTTP method
- request body
- query params
- headers
- auth requirements
- example responses

If a route is renamed, moved, protected by different auth, or its request or response shape changes, the Postman collection must be updated in the same task.

## Route Documentation

When you add or change a route, keep the related Swagger/OpenAPI annotations in sync with the implementation.

## Validation

After backend changes, prefer running the relevant checks before finishing:

- `pnpm typecheck`
- `pnpm test`

If you change route contracts, verify that tests and documentation still match the live route behavior.

## Change Discipline

- Do not leave API docs or Postman examples stale after route changes.
- Prefer minimal, targeted updates over unrelated refactors.
- Preserve existing route prefixes and versioning conventions unless the task explicitly requires changing them.
