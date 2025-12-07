# MCP Server Generator - PRD

## Goal
Create a generator that, at the end of the analysis conversation, scaffolds a minimal MCP server with deep knowledge of the analyzed dataset schema. This server can be plugged into an LLM-based chat to answer questions about similarly structured files (e.g., new quarterly CSV/Excel files with the same schema). We will continue using the Umwelten framework [[memory:8464234]].

## Inputs
- `parserConfig.json` produced by `writeConfigTool`
- `dataLoaderMetadata.json` produced by `writeConfigTool`
- `data.db` created by `createTableTool`/`importDataTool` (optional at generation time)

## Outputs (artifacts)
- Source: `src/mcp/server.ts` (Umwelten-compatible MCP implementation)
- Config: `server-config.json` (DB path, table name, optional indexes)
- Derived: `schema.sql` generated from `dataLoaderMetadata.json` for portability
- README: `docs/mcp-server-usage.md` (how to run/use)

## Non-goals (initial)
- Advanced auth
- Cross-database support beyond SQLite
- Complex query planners

## Functional Requirements
- Read `parserConfig.json` and `dataLoaderMetadata.json` at startup
- Connect to SQLite (`data.db`) lazily; path is configurable via `server-config.json`
- Expose MCP tools:
  1. `describe_schema` → tables, columns, types, nullability, indexes
  2. `list_tables` → names only
  3. `list_columns` → per table columns and types
  4. `run_query` → parameterized SELECT with safe allowlist of tables/columns
  5. `ingest_file` (optional) → use existing mappings to append data from a new file
- Provide structured errors (type/message/table/column) suitable for LLM reasoning

## Flow Alignment (current → future)
1) Analyze file via Umwelten CLI (`src/analyzeFile.ts`)
2) Write configs: `parserConfig.json`, `dataLoaderMetadata.json`
3) Create and populate SQLite: `createTableTool` then `importDataTool` (creates `data.db` if missing)
4) New: `generateMcpServerTool` scaffolds MCP server + config from step 2

## CLI & Runtime
- Package manager: pnpm
- Runtime: tsx (no build step)
- Tests: `node --test` for unit/integration [[memory:8463193]]
- Scripts to add:
  - `mcp:dev`: `tsx src/mcp/server.ts`
  - `mcp:test`: `node --test test/mcp/**/*.test.ts`

## Data Safety
- `run_query` limited to `SELECT` (no DDL/DML)
- Prepared statements with positional params
- Table/column allowlist derived from `dataLoaderMetadata.json`

## Open Questions
- Should `ingest_file` support CSV directly or funnel through `xlsx`?
- Do we add lightweight caching of `describe_schema`?
- Should `schema.sql` include indexes suggested by the LLM?

## Acceptance Criteria
- After running analysis and config-writing, a single tool call generates MCP server files
- Server boots with pnpm+tsx and can answer schema questions and run safe queries
- Optional ingestion works on a second file with identical structure
