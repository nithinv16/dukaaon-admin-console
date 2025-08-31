Usage:
  supabase gen types [flags]

Examples:
  supabase gen types --local
  supabase gen types --linked --lang=go
  supabase gen types --project-id abc-def-123 --schema public --schema private
  supabase gen types --db-url 'postgresql://...' --schema public --schema auth

Flags:
      --db-url string                                Generate types from a database url.
  -h, --help                                         help for types
      --lang [ typescript | go | swift ]             Output language of the generated types. (default typescript)
      --linked                                       Generate types from the linked project.
      --local                                        Generate types from the local dev database.
      --postgrest-v9-compat                          Generate types compatible with PostgREST v9 and below. Only use together with --db-url.
      --project-id string                            Generate types from a project ID.
  -s, --schema strings                               Comma separated list of schema to include.
      --swift-access-control [ internal | public ]   Access control for Swift generated types. (default internal)

Global Flags:
      --create-ticket                                  create a support ticket for any CLI error
      --debug                                          output debug logs to stderr
      --dns-resolver [ native | https ]                lookup domain names using the specified resolver (default native)
      --experimental                                   enable experimental features
      --network-id string                              use the specified docker network instead of a generated one
  -o, --output [ env | pretty | json | toml | yaml ]   output format of status variables (default pretty)
      --profile string                                 use a specific profile for connecting to Supabase API (default "supabase")
      --workdir string                                 path to a Supabase project directory
      --yes                                            answer yes to all prompts

flag needs an argument: --project-id
Try rerunning the command with --debug to troubleshoot the error.
