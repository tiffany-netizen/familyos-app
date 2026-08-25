-- Personal connector token for the Claude / ChatGPT MCP integration.
alter table public.profiles add column if not exists mcp_token text;
create index if not exists profiles_mcp_token_idx on public.profiles (mcp_token) where mcp_token is not null;
