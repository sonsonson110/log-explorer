# Run the web frontend developer server
dev-web:
	cd apps/web && npm run dev

# Run the server-node developer server
dev-node:
	cd apps/server-node && npm run dev

# Build all workspace packages
build:
	npm run build --workspaces

# Run typescript checks on all workspace packages
typecheck:
	npm run typecheck --workspaces
